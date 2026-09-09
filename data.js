/* ============================================================
   data.js — shared storage layer for the whole site
   Tier 0 (local storage) + Tier 1 (manual export / safe import)
   ============================================================ */

const STORE = {
  dayEntries: 'mm_dayEntries',   // day-list tasks
  series: 'mm_series',           // recurring-task bookkeeping (exclusion dates)
  habits: 'mm_habits',           // habit definitions
  habitLogs: 'mm_habitLogs',     // per-day habit records (done + note + duration + metric)
  models: 'mm_models',           // mental models (editable, seeded once from MENTAL_MODELS)
  modelsSeeded: 'mm_modelsSeeded',
  modelNotes: 'mm_modelNotes',   // freeform notes attached to a mental model, keyed by slug
  journal: 'mm_journal'          // one journal entry per date
};

function loadArr(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { console.error('Failed to read', key, e); return []; }
}
function loadObj(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { console.error('Failed to read', key, e); return {}; }
}
function saveArr(key, arr) { localStorage.setItem(key, JSON.stringify(arr)); }
function saveObj(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addDaysStr(dateStr, delta) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
function slugify(title) {
  const s = String(title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return s || 'model';
}

// 16 curated colors, then an effectively-unlimited generated sequence
// (golden-angle hue rotation) so dots stay visually distinct past 16 habits.
const HABIT_COLOR_PALETTE = [
  '#D4A24C', '#6E8FB0', '#B5502D', '#7A8B6F', '#B07AA8', '#4C9BD4',
  '#D4574C', '#4CAE8F', '#C9A227', '#8F6FB0', '#D4914C', '#5CA6A6',
  '#B0507A', '#7A9E4C', '#5C7CB0', '#A6784C'
];
function colorForIndex(i) {
  if (i < HABIT_COLOR_PALETTE.length) return HABIT_COLOR_PALETTE[i];
  const hue = Math.round((i * 137.508) % 360);
  return `hsl(${hue}, 55%, 55%)`;
}

const REPEAT_WINDOW_DAYS = 30;

const Data = {
  HABIT_COLOR_PALETTE,
  colorForIndex,

  // ================= DAY ENTRIES =================
  getDayEntries() { return loadArr(STORE.dayEntries); },
  addDayEntry(entry) {
    const arr = loadArr(STORE.dayEntries);
    const now = Date.now();
    const dateEntries = entry.date ? arr.filter(e => e.date === entry.date) : [];
    const maxOrder = dateEntries.reduce((m, e) => Math.max(m, e.order || 0), 0);
    arr.push(Object.assign({ id: uid(), createdAt: now, updatedAt: now, done: false, notes: '', repeatDaily: false, seriesId: null, order: maxOrder + 1, priority: null }, entry));
    saveArr(STORE.dayEntries, arr);
    return arr;
  },
  // plain patch — used for things that must NOT propagate to future occurrences (e.g. checking "done")
  updateDayEntry(id, patch) {
    const arr = loadArr(STORE.dayEntries);
    const idx = arr.findIndex(e => e.id === id);
    if (idx > -1) { arr[idx] = Object.assign({}, arr[idx], patch, { updatedAt: Date.now() }); saveArr(STORE.dayEntries, arr); }
    return arr;
  },
  // edits from the modal (name/time/duration/notes/repeat) — propagates to THIS + FUTURE
  // occurrences of the same series, and never touches past ones.
  updateDayEntryPropagating(id, patch) {
    const arr = loadArr(STORE.dayEntries);
    const idx = arr.findIndex(e => e.id === id);
    if (idx === -1) return arr;
    const entry = arr[idx];
    let seriesId = entry.seriesId;
    // turning repeat on for the first time on a previously plain entry: mint a series id now
    if (patch.repeatDaily && !seriesId) seriesId = uid();
    // turning repeat OFF: fully detach from the series, not just stop generating new occurrences.
    // Previously seriesId was left in place even after repeatDaily was set to false — so any
    // later, unrelated edit to this same entry (patch without touching repeatDaily at all) would
    // still trip the "drop future clones in this series" branch below using that stale id. A
    // plain task should behave like it never had a series once repeat is off.
    if (patch.repeatDaily === false) seriesId = null;
    const updated = Object.assign({}, entry, patch, { seriesId, updatedAt: Date.now() });
    arr[idx] = updated;
    let result = arr;
    if (entry.seriesId) {
      // drop stale future clones in this series — top-up (below) regenerates them with the new values
      result = arr.filter(e => !(e.seriesId === entry.seriesId && e.id !== id && e.date > entry.date));
    }
    saveArr(STORE.dayEntries, result);
    if (updated.repeatDaily) {
      if (seriesId && !loadArr(STORE.series).some(s => s.id === seriesId)) {
        const series = loadArr(STORE.series);
        series.push({ id: seriesId, excludedDates: [], createdAt: Date.now(), updatedAt: Date.now() });
        saveArr(STORE.series, series);
      }
      Data.ensureSeriesTopUp();
    }
    return loadArr(STORE.dayEntries);
  },
  // turns a freshly-created entry into the start of a daily-repeating series (never backfills the past)
  startRepeat(entryId) {
    const arr = loadArr(STORE.dayEntries);
    const idx = arr.findIndex(e => e.id === entryId);
    if (idx === -1) return;
    const seriesId = uid();
    arr[idx] = Object.assign({}, arr[idx], { repeatDaily: true, seriesId, updatedAt: Date.now() });
    saveArr(STORE.dayEntries, arr);
    const series = loadArr(STORE.series);
    if (!series.some(s => s.id === seriesId)) {
      series.push({ id: seriesId, excludedDates: [], createdAt: Date.now(), updatedAt: Date.now() });
      saveArr(STORE.series, series);
    }
    Data.ensureSeriesTopUp();
  },
  // deleting a single occurrence of an active series excludes just that date from future
  // top-ups, so it can't silently come back; deleting a non-repeating (or already-past/stopped) entry is a plain delete.
  deleteDayEntry(id) {
    const arr = loadArr(STORE.dayEntries);
    const entry = arr.find(e => e.id === id);
    if (entry && entry.seriesId && entry.repeatDaily) {
      const series = loadArr(STORE.series);
      const sIdx = series.findIndex(s => s.id === entry.seriesId);
      if (sIdx > -1) {
        if (!series[sIdx].excludedDates.includes(entry.date)) series[sIdx].excludedDates.push(entry.date);
        series[sIdx].updatedAt = Date.now();
        saveArr(STORE.series, series);
      }
    }
    const filtered = arr.filter(e => e.id !== id);
    saveArr(STORE.dayEntries, filtered);
    return filtered;
  },
  // rolling window: for every active series (repeatDaily:true on its latest occurrence),
  // materialize concrete entries from today through today+29, skipping any excluded dates.
  // never generates into the past. call on every page load.
  ensureSeriesTopUp() {
    const entries = loadArr(STORE.dayEntries);
    const seriesList = loadArr(STORE.series);
    const today = todayStr();
    const windowEnd = addDaysStr(today, REPEAT_WINDOW_DAYS - 1);

    const bySeries = {};
    entries.forEach(e => { if (e.seriesId) (bySeries[e.seriesId] = bySeries[e.seriesId] || []).push(e); });

    let changed = false;
    Object.keys(bySeries).forEach(seriesId => {
      const group = bySeries[seriesId].slice().sort((a, b) => a.date.localeCompare(b.date));
      const latest = group[group.length - 1];
      if (!latest.repeatDaily) return;
      const seriesRec = seriesList.find(s => s.id === seriesId);
      const excluded = new Set(seriesRec ? seriesRec.excludedDates : []);
      const existingDates = new Set(group.map(e => e.date));
      let cursor = latest.date;
      while (cursor < windowEnd) {
        cursor = addDaysStr(cursor, 1);
        if (cursor < today) continue;
        if (existingDates.has(cursor) || excluded.has(cursor)) continue;
        entries.push(Object.assign({}, latest, { id: uid(), date: cursor, done: false, createdAt: Date.now(), updatedAt: Date.now() }));
        existingDates.add(cursor);
        changed = true;
      }
    });
    if (changed) saveArr(STORE.dayEntries, entries);
    return changed;
  },

  // custom-mode drag reorder: caller passes the full list of entry ids for one date,
  // in the new visual order — reassigns sequential order values.
  reorderDayEntries(orderedIds) {
    const arr = loadArr(STORE.dayEntries);
    orderedIds.forEach((id, idx) => {
      const e = arr.find(x => x.id === id);
      if (e) { e.order = idx; e.updatedAt = Date.now(); }
    });
    saveArr(STORE.dayEntries, arr);
    return arr;
  },
  // priority-mode: set one entry's priority number. if another entry on the same date already
  // holds that number, it gets bumped to the next number — cascading forward as far as needed.
  setEntryPriority(date, entryId, newPriority) {
    let currentId = entryId;
    let num = newPriority;
    const visited = new Set();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const arr = loadArr(STORE.dayEntries);
      const occupant = arr.find(e => e.date === date && e.priority === num && e.id !== currentId);
      const idx = arr.findIndex(e => e.id === currentId);
      if (idx > -1) { arr[idx] = Object.assign({}, arr[idx], { priority: num, updatedAt: Date.now() }); saveArr(STORE.dayEntries, arr); }
      if (occupant) { currentId = occupant.id; num = num + 1; } else { currentId = null; }
    }
    return loadArr(STORE.dayEntries);
  },
  clearAllPriorities(date) {
    const arr = loadArr(STORE.dayEntries);
    arr.forEach(e => { if (e.date === date) { e.priority = null; e.updatedAt = Date.now(); } });
    saveArr(STORE.dayEntries, arr);
    return arr;
  },
  deleteAllUnprioritized(date) {
    const arr = loadArr(STORE.dayEntries);
    const kept = arr.filter(e => !(e.date === date && e.priority == null));
    saveArr(STORE.dayEntries, kept);
    return kept;
  },
  // day-list "archive": a manually-archived task (any date, any status) OR an unchecked,
  // non-repeating task stuck on a past date. Nothing here is ever truly lost from sight —
  // everything surfaced is restorable, and nothing here ever gets silently relocated off its
  // own day (see the removed rolloverUnfinishedRoughTasks note below). archiveDismissed (see
  // dismissDayEntryFromArchive below) suppresses an entry from this list even if it'd otherwise
  // still qualify via the stale-past-task rule.
  getArchivedDayEntries() {
    const today = todayStr();
    return loadArr(STORE.dayEntries).filter(e => !e.archiveDismissed && (e.archived === true || (!e.done && !e.repeatDaily && e.date < today)));
  },
  // explicit "put this out of sight for now" — used by the Tasks select-mode's Archive
  // action. The entry keeps its date; it just stops showing in the active day list until restored.
  archiveDayEntry(id) {
    const arr = loadArr(STORE.dayEntries);
    const idx = arr.findIndex(e => e.id === id);
    if (idx > -1) { arr[idx] = Object.assign({}, arr[idx], { archived: true, updatedAt: Date.now() }); saveArr(STORE.dayEntries, arr); }
    return arr;
  },
  // pulls a copy into today's active list — a manual escape hatch for anything that got left
  // behind (or was manually archived). Real bug found: this used to mutate the original entry's
  // own `date` to today, which "restored" it by relocating it — silently erasing it from
  // whatever day it actually belonged to, which is exactly backwards for a task that's meant to
  // record what happened on a given day. Now it leaves the original entry's date untouched and
  // creates a fresh copy dated today instead; the original just quietly steps out of Archive
  // (the same soft-dismiss used by the Archive dropdown's own "delete", since restoring it here
  // counts as having acted on it) rather than disappearing from its own day.
  restoreDayEntryToToday(id) {
    const arr = loadArr(STORE.dayEntries);
    const idx = arr.findIndex(e => e.id === id);
    if (idx > -1) {
      const original = arr[idx];
      arr[idx] = Object.assign({}, original, { archived: false, archiveDismissed: true, updatedAt: Date.now() });
      const today = todayStr();
      const now = Date.now();
      const todayEntries = arr.filter(e => e.date === today);
      const maxOrder = todayEntries.reduce((m, e) => Math.max(m, e.order || 0), 0);
      arr.push(Object.assign({}, original, {
        id: uid(), date: today, done: false, archived: false, archiveDismissed: false,
        repeatDaily: false, seriesId: null, order: maxOrder + 1, createdAt: now, updatedAt: now
      }));
      saveArr(STORE.dayEntries, arr);
    }
    return arr;
  },
  // the Archive dropdown's own "delete" is a soft dismiss, same idea as a deleted habit: it
  // only clears the entry from showing under Archive (unsets the manual archived flag and
  // sets archiveDismissed so the stale-past-task rule won't just re-surface it) — the entry
  // itself is untouched and still sits normally on its own date. The real, permanent removal
  // is deleteDayEntry (above), used by that date's own row in the regular Day List.
  dismissDayEntryFromArchive(id) {
    const arr = loadArr(STORE.dayEntries);
    const idx = arr.findIndex(e => e.id === id);
    if (idx > -1) { arr[idx] = Object.assign({}, arr[idx], { archived: false, archiveDismissed: true, updatedAt: Date.now() }); saveArr(STORE.dayEntries, arr); }
    return arr;
  },

  // Real bug found: a non-repeating task without any time set ("rough") used to get physically
  // relocated onto today once it went a day unfinished — e.getDate mutated in place — which is
  // exactly the "still repeats to the next day, just vanishes from where it started" behavior
  // reported. That's now removed entirely: a rough task just stays on the day it was created,
  // done or not, and getArchivedDayEntries' own stale-past-task rule (above) is what surfaces it
  // for attention instead — without ever moving it. This function (and both of its call sites in
  // app.js) has been deleted along with the mechanic.

  // ================= HABITS =================
  getHabits() { return loadArr(STORE.habits); },
  getHabit(id) { return loadArr(STORE.habits).find(h => h.id === id) || null; },
  addHabit(habit) {
    const arr = loadArr(STORE.habits);
    const now = Date.now();
    const color = habit.color || colorForIndex(arr.length);
    const maxOrder = arr.reduce((m, h) => Math.max(m, h.order || 0), 0);
    const newHabit = Object.assign({ id: uid(), createdAt: now, updatedAt: now, archived: false, metric: '', order: maxOrder + 1 }, habit, { color });
    arr.push(newHabit);
    saveArr(STORE.habits, arr);
    return newHabit; // was returning the whole array — harmless today since no caller currently
    // reads the return value, but a real latent bug (any future `const h = Data.addHabit(...);
    // location.href = 'habit.html?id=' + h.id` would silently link to id=undefined)
  },
  updateHabit(id, patch) {
    const arr = loadArr(STORE.habits);
    const idx = arr.findIndex(h => h.id === id);
    if (idx > -1) { arr[idx] = Object.assign({}, arr[idx], patch, { updatedAt: Date.now() }); saveArr(STORE.habits, arr); }
    return arr;
  },
  // custom drag reorder — a single persistent order shared across every day (habits aren't
  // day-scoped, unlike day-list tasks), so rearranging once holds for tomorrow too.
  reorderHabits(orderedIds) {
    const arr = loadArr(STORE.habits);
    orderedIds.forEach((id, idx) => {
      const h = arr.find(x => x.id === id);
      if (h) { h.order = idx; h.updatedAt = Date.now(); }
    });
    saveArr(STORE.habits, arr);
    return arr;
  },
  // "Delete" is a soft delete: the habit record stays (so its id keeps resolving) but is
  // flagged deleted+archived so it disappears from every active list (Habits page, its
  // Archived section, Today's habit list, name search). Its habitLogs are deliberately left
  // untouched — a day you already logged it on keeps showing it if you navigate back to
  // that exact date (see getHabitsForDate), until that specific day's log is removed there.
  deleteHabit(id) {
    // A habit with zero logged days has no history worth preserving as a soft-deleted "ghost" —
    // soft-deleting it anyway would just leave a permanent, invisible tombstone (and, if it were
    // ever surfaced somewhere like the Calendar legend, a "(deleted)" entry with nothing real
    // behind it). Hard-delete those outright instead; a habit that's been logged at least once
    // still goes through the normal soft-delete/ghost path so that real history stays visible.
    const hasAnyLog = loadArr(STORE.habitLogs).some(l => l.habitId === id);
    if (!hasAnyLog) { Data.hardDeleteHabit(id); return; }
    const arr = loadArr(STORE.habits);
    const idx = arr.findIndex(h => h.id === id);
    if (idx > -1) { arr[idx] = Object.assign({}, arr[idx], { archived: true, deleted: true, updatedAt: Date.now() }); saveArr(STORE.habits, arr); }
  },
  // full, permanent removal — the habit record AND every one of its log entries, gone for
  // good. Only ever offered once a habit is already soft-deleted (the "ghost" row) — this is
  // that ghost's own cleanup action, not a substitute for the normal delete above.
  hardDeleteHabit(id) {
    saveArr(STORE.habits, loadArr(STORE.habits).filter(h => h.id !== id));
    saveArr(STORE.habitLogs, loadArr(STORE.habitLogs).filter(l => l.habitId !== id));
  },

  // ================= HABIT LOGS =================
  // (a record can exist for a note/metric without being "done" — see upsertHabitLog)
  getHabitLogs() { return loadArr(STORE.habitLogs); },
  getHabitLog(habitId, date) { return loadArr(STORE.habitLogs).find(l => l.habitId === habitId && l.date === date) || null; },
  // removes just one day's log for one habit — the "unless deleted there" escape hatch for
  // a historical ghost row (see getHabitsForDate) once you're done with it for good.
  deleteHabitLog(habitId, date) {
    saveArr(STORE.habitLogs, loadArr(STORE.habitLogs).filter(l => !(l.habitId === habitId && l.date === date)));
  },
  // habits to show when viewing one specific date's snapshot (Today page's backward-navigable
  // habit list): every active habit, PLUS any deleted habit that still has a log entry for
  // exactly this date — so a deleted habit's history survives on the day it actually happened.
  // Merely-archived-but-not-deleted habits stay hidden here, same as before.
  getHabitsForDate(date) {
    const all = loadArr(STORE.habits);
    const active = all.filter(h => !h.archived);
    const logs = loadArr(STORE.habitLogs);
    const ghosts = all.filter(h => h.deleted && logs.some(l => l.habitId === h.id && l.date === date));
    return active.concat(ghosts);
  },

  upsertHabitLog(habitId, date, patch) {
    const arr = loadArr(STORE.habitLogs);
    const idx = arr.findIndex(l => l.habitId === habitId && l.date === date);
    if (idx > -1) {
      arr[idx] = Object.assign({}, arr[idx], patch, { updatedAt: Date.now() });
    } else {
      const habit = Data.getHabit(habitId);
      const defaultMetric = (habit && habit.metric) || '';
      arr.push(Object.assign(
        { id: uid(), habitId, date, done: false, note: '', durationMin: null, metric: defaultMetric, createdAt: Date.now(), updatedAt: Date.now() },
        patch
      ));
    }
    saveArr(STORE.habitLogs, arr);
    return arr;
  },
  toggleHabitDone(habitId, date) {
    const log = Data.getHabitLog(habitId, date);
    return Data.upsertHabitLog(habitId, date, { done: !(log && log.done) });
  },

  getHabitStats(habitId) {
    const logs = loadArr(STORE.habitLogs).filter(l => l.habitId === habitId);
    const doneLogs = logs.filter(l => l.done);
    const totalMin = doneLogs.reduce((s, l) => s + (l.durationMin || 0), 0);
    const dates = doneLogs.map(l => l.date).sort();

    // current streak: consecutive done days counting back from today (or yesterday, so
    // "not done yet today" doesn't look like a broken streak mid-day)
    const doneSet = new Set(dates);
    let streak = 0;
    let cursor = doneSet.has(todayStr()) ? todayStr() : addDaysStr(todayStr(), -1);
    while (doneSet.has(cursor)) { streak++; cursor = addDaysStr(cursor, -1); }

    return { daysDone: doneLogs.length, totalMin, firstDate: dates[0] || null, lastDate: dates[dates.length - 1] || null, streak };
  },

  // ================= MENTAL MODELS =================
  getModels() {
    if (localStorage.getItem(STORE.modelsSeeded) !== 'true') {
      const seed = (typeof MENTAL_MODELS !== 'undefined' ? MENTAL_MODELS : []).map(m => ({
        slug: m.slug, title: m.title, img: m.img, caption: m.caption, pinned: !!m.pinned, createdAt: Date.now(), updatedAt: Date.now()
      }));
      saveArr(STORE.models, seed);
      localStorage.setItem(STORE.modelsSeeded, 'true');
      return seed;
    }
    return loadArr(STORE.models);
  },
  getModel(slug) { return Data.getModels().find(m => m.slug === slug) || null; },
  getPinnedModels() { return Data.getModels().filter(m => m.pinned); },
  addModel({ title, img, caption }) {
    const models = Data.getModels();
    let base = slugify(title), slug = base, i = 2;
    while (models.some(m => m.slug === slug)) { slug = base + '-' + i; i++; }
    const model = { slug, title, img, caption: caption || '', pinned: false, createdAt: Date.now(), updatedAt: Date.now() };
    models.push(model);
    saveArr(STORE.models, models);
    return model;
  },
  deleteModel(slug) {
    saveArr(STORE.models, Data.getModels().filter(m => m.slug !== slug));
    const notes = loadObj(STORE.modelNotes);
    delete notes[slug];
    saveObj(STORE.modelNotes, notes);
  },
  setModelPinned(slug, pinned) {
    const models = Data.getModels();
    if (pinned && models.filter(m => m.pinned).length >= 2) return false;
    const idx = models.findIndex(m => m.slug === slug);
    if (idx > -1) { models[idx].pinned = pinned; models[idx].updatedAt = Date.now(); saveArr(STORE.models, models); }
    return true;
  },
  unpinAllModels() {
    saveArr(STORE.models, Data.getModels().map(m => Object.assign({}, m, { pinned: false, updatedAt: Date.now() })));
  },

  // ---- mental model notes ----
  getModelNotes(slug) { return loadObj(STORE.modelNotes)[slug] || []; },
  addModelNote(slug, text) {
    const all = loadObj(STORE.modelNotes);
    if (!all[slug]) all[slug] = [];
    all[slug].unshift({ id: uid(), text, createdAt: Date.now() });
    saveObj(STORE.modelNotes, all);
    return all[slug];
  },
  deleteModelNote(slug, noteId) {
    const all = loadObj(STORE.modelNotes);
    if (all[slug]) all[slug] = all[slug].filter(n => n.id !== noteId);
    saveObj(STORE.modelNotes, all);
    return all[slug] || [];
  },

  // ================= JOURNAL (one entry per date) =================
  getJournalEntries() { return loadArr(STORE.journal).sort((a, b) => b.date.localeCompare(a.date)); },
  getJournalEntry(date) { return loadArr(STORE.journal).find(j => j.date === date) || null; },
  upsertJournalEntry(date, text) {
    const arr = loadArr(STORE.journal);
    const idx = arr.findIndex(j => j.date === date);
    if (text.trim() === '') {
      if (idx > -1) { arr.splice(idx, 1); saveArr(STORE.journal, arr); }
      return null;
    }
    if (idx > -1) {
      arr[idx] = Object.assign({}, arr[idx], { text, updatedAt: Date.now() });
    } else {
      arr.push({ id: uid(), date, text, createdAt: Date.now(), updatedAt: Date.now() });
    }
    saveArr(STORE.journal, arr);
    return arr;
  },

  // ================= EXPORT / IMPORT (Tier 1) =================
  exportAll() {
    const payload = {
      version: 3,
      exportedAt: new Date().toISOString(),
      dayEntries: loadArr(STORE.dayEntries),
      series: loadArr(STORE.series),
      habits: loadArr(STORE.habits),
      habitLogs: loadArr(STORE.habitLogs),
      models: Data.getModels(),
      modelNotes: loadObj(STORE.modelNotes),
      journal: loadArr(STORE.journal)
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    // local time, not UTC — so the filename matches the clock the person actually saw when they clicked "download"
    const now = new Date();
    const p2 = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}_${p2(now.getHours())}-${p2(now.getMinutes())}`;
    a.href = url; a.download = `signal-backup-${stamp}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },

  _mergeByKey(current, incoming, keyField) {
    const byKey = new Map(current.map(r => [r[keyField], r]));
    let added = 0, updated = 0;
    (incoming || []).forEach(rec => {
      if (!rec || rec[keyField] == null) return;
      const existing = byKey.get(rec[keyField]);
      if (!existing) { byKey.set(rec[keyField], rec); added++; }
      else if ((rec.updatedAt || 0) > (existing.updatedAt || 0)) { byKey.set(rec[keyField], rec); updated++; }
    });
    return { merged: Array.from(byKey.values()), added, updated };
  },
  _mergeById(current, incoming) { return Data._mergeByKey(current, incoming, 'id'); },

  importFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const incoming = JSON.parse(reader.result);

          const de = Data._mergeByKey(loadArr(STORE.dayEntries), incoming.dayEntries, 'id');
          const sr = Data._mergeByKey(loadArr(STORE.series), incoming.series, 'id');
          const hb = Data._mergeByKey(loadArr(STORE.habits), incoming.habits, 'id');
          const hl = Data._mergeByKey(loadArr(STORE.habitLogs), incoming.habitLogs, 'id');
          const md = Data._mergeByKey(Data.getModels(), incoming.models, 'slug');
          const jr = Data._mergeByKey(loadArr(STORE.journal), incoming.journal, 'id');
          saveArr(STORE.dayEntries, de.merged);
          saveArr(STORE.series, sr.merged);
          saveArr(STORE.habits, hb.merged);
          saveArr(STORE.habitLogs, hl.merged);
          saveArr(STORE.models, md.merged);
          saveArr(STORE.journal, jr.merged);
          localStorage.setItem(STORE.modelsSeeded, 'true');

          const currentNotes = loadObj(STORE.modelNotes);
          const incomingNotes = incoming.modelNotes || {};
          let notesAdded = 0;
          Object.keys(incomingNotes).forEach(slug => {
            const cur = currentNotes[slug] || [];
            const byId = new Map(cur.map(n => [n.id, n]));
            incomingNotes[slug].forEach(n => { if (!byId.has(n.id)) { byId.set(n.id, n); notesAdded++; } });
            currentNotes[slug] = Array.from(byId.values());
          });
          saveObj(STORE.modelNotes, currentNotes);

          resolve({ dayEntries: de, habits: hb, habitLogs: hl, models: md, journal: jr, notesAdded });
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
};

function wireBackupControls() {
  const exportBtn = document.getElementById('exportBtn');
  const importBtn = document.getElementById('importBtn');
  const importInput = document.getElementById('importFileInput');
  const importBtnLabel = importBtn ? importBtn.querySelector('.label') : null;
  if (exportBtn) exportBtn.addEventListener('click', () => Data.exportAll());
  let awaitingRestoreClick = false;
  if (importBtn && importInput) {
    importBtn.addEventListener('click', async () => {
      // second click of a two-step flow (see below) — goes straight to the file picker with
      // no more dialogs first, since this needs to be a genuinely fresh, uninterrupted click
      if (awaitingRestoreClick) {
        awaitingRestoreClick = false;
        if (importBtnLabel) importBtnLabel.textContent = 'Restore from backup';
        importInput.click();
        return;
      }
      // ask BEFORE the file picker opens, not after — deciding whether to protect yourself
      // should come before picking what to restore, not as an interruption in between
      const wantsBackup = await SignalConfirm('Save a safety backup of your current data before restoring? (Recommended, but your call.)');
      if (wantsBackup) {
        Data.exportAll();
        // Chaining the file picker directly off the tail of this — even now that this is a
        // non-blocking custom modal instead of native confirm()/alert() — still isn't worth
        // risking: the earlier native-dialog version of this exact chain (confirm + alert +
        // file picker, all off one click) silently failed once too much had happened since the
        // original click. Rather than gamble a modal-based version behaves differently, this
        // still asks for one more real click — that fresh click is what actually opens the
        // picker, same proven-reliable shape as before, just without the ugly native alert().
        awaitingRestoreClick = true;
        if (importBtnLabel) importBtnLabel.textContent = 'Click to choose file →';
      } else {
        importInput.click();
      }
    });
    importInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const r = await Data.importFile(file);
        alert(
          'Import complete.\n\n' +
          `Day list: +${r.dayEntries.added} new, ${r.dayEntries.updated} updated\n` +
          `Habits: +${r.habits.added} new, ${r.habits.updated} updated\n` +
          `Habit logs: +${r.habitLogs.added} new, ${r.habitLogs.updated} updated\n` +
          `Journal: +${r.journal.added} new, ${r.journal.updated} updated\n` +
          `Mental models: +${r.models.added} new, ${r.models.updated} updated\n` +
          `Model notes: +${r.notesAdded} new`
        );
        window.location.reload();
      } catch (err) {
        alert('Could not read that file — make sure it is a backup JSON exported from this site.');
        console.error(err);
      }
      importInput.value = '';
    });
  }
}
document.addEventListener('DOMContentLoaded', wireBackupControls);
