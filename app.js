/* ============================================================
   app.js — home page interactivity
   relies on Data (data.js), MENTAL_MODELS (models-data.js, seed only),
   EMOJI_LIST (emoji-data.js), NAV_ICON (nav.js)
   ============================================================ */

// ---------- small helpers ----------
function pad(n) { return String(n).padStart(2, '0'); }
function parseDateStr(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(dateStr, delta) { const d = parseDateStr(dateStr); d.setDate(d.getDate() + delta); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function minutesLabel(min) {
  if (!min) return '';
  if (min < 60) return min + 'm';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
function darken(hex, amt) {
  if (!hex || hex[0] !== '#' || hex.length !== 7) return hex;
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, r - amt); g = Math.max(0, g - amt); b = Math.max(0, b - amt);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const TASK_COLORS = ['#D4A24C', '#7A8B6F', '#B5502D', '#6E8FB0', '#B07AA8'];

function friendlyDate(dateStr, abbreviateOnMobile) {
  const d = parseDateStr(dateStr);
  const today = todayStr();
  const y = addDays(today, -1), t = addDays(today, 1);
  const mobile = abbreviateOnMobile && window.matchMedia('(max-width: 760px)').matches;
  let prefix = '';
  if (dateStr === today) prefix = 'Today · ';
  else if (dateStr === y) prefix = (mobile ? 'Yest' : 'Yesterday') + ' · ';
  else if (dateStr === t) prefix = (mobile ? 'Tom' : 'Tomorrow') + ' · ';
  return prefix + DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
}
function formatLongDate(dateStr) {
  const d = parseDateStr(dateStr);
  return d.getDate() + ordinalSuffix(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

// ---------- shared widgets ----------
function buildColorPicker(container, initialColor, onChange) {
  let selected = initialColor;
  container.innerHTML = '';
  const swatches = [];
  Data.HABIT_COLOR_PALETTE.forEach(c => {
    const sw = document.createElement('div');
    sw.className = 'color-swatch';
    sw.style.background = c;
    sw.addEventListener('click', () => { selected = c; custom.value = c; syncSelected(); onChange(selected); });
    swatches.push({ el: sw, color: c });
    container.appendChild(sw);
  });
  const custom = document.createElement('input');
  custom.type = 'color';
  custom.className = 'color-native';
  custom.value = selected && selected.startsWith('#') ? selected : '#D4A24C';
  custom.title = 'Custom color';
  // Real bug found (was also happening on desktop, not just mobile): this used to call draw()
  // right here, which wipes and rebuilds the whole container — including this very
  // <input type=color> node — on every 'input' event. A native color panel fires 'input'
  // continuously while the finger/cursor is still down inside it, not just once on release, so
  // recreating the input mid-drag was destroying the exact element the browser's color panel was
  // anchored to, which is what closed it instantly instead of letting you keep browsing colors.
  // Now 'input' only updates state and toggles a class on the existing preset swatches — nothing
  // in the DOM is torn down while the picker is open, so it stays open through the whole drag;
  // only the browser's own eventual close (on release) ends it, same as any other page.
  custom.addEventListener('input', () => { selected = custom.value; syncSelected(); onChange(selected); });
  container.appendChild(custom);
  function syncSelected() { swatches.forEach(({ el, color }) => el.classList.toggle('selected', color === selected)); }
  syncSelected();
  return {
    get: () => selected,
    set: (c) => { selected = c; if (c && c.startsWith('#')) custom.value = c; syncSelected(); }
  };
}

function buildTaskColorPicker(container, initialColor) {
  let selected = initialColor || TASK_COLORS[0];
  function draw() {
    container.innerHTML = '';
    TASK_COLORS.forEach(c => {
      const sw = document.createElement('div');
      sw.className = 'color-swatch' + (c === selected ? ' selected' : '');
      sw.style.background = c;
      sw.addEventListener('click', () => { selected = c; draw(); });
      container.appendChild(sw);
    });
  }
  draw();
  return { get: () => selected, set: (c) => { selected = c || TASK_COLORS[0]; draw(); } };
}

// Shared metric-display control (mirrors the one in habit-detail.js): plain text showing
// the day's metric (or the habit's default). Logged day → click edits just that day inline.
// Not logged yet → click hands off to onDefaultEditRequested (here: go change the default
// on the habit's own page).
function renderMetricCell(el, { habitId, date, habit, getLog, onSingleDaySaved, onDefaultEditRequested }) {
  function draw() {
    const log = getLog();
    const logged = !!log;
    const value = (log && log.metric) || habit.metric || '';
    el.innerHTML = '';
    const span = document.createElement('span');
    span.className = 'metric-display' + (logged ? ' is-logged' : ' is-default');
    span.textContent = value ? value : (logged ? '+ add metric' : '+ set metric');
    span.title = logged ? 'Click to edit the metric for just this day' : "Click to change this habit's default metric";
    span.addEventListener('click', () => {
      if (logged) {
        const input = document.createElement('input');
        input.type = 'text'; input.className = 'metric-edit-input'; input.value = value;
        el.innerHTML = ''; el.appendChild(input); input.focus(); input.select();
        let done = false;
        function save() {
          if (done) return; done = true;
          Data.upsertHabitLog(habitId, date, { metric: input.value });
          if (onSingleDaySaved) onSingleDaySaved();
          draw();
        }
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); save(); }
          else if (e.key === 'Escape') { done = true; draw(); }
        });
        input.addEventListener('blur', save);
      } else if (onDefaultEditRequested) {
        onDefaultEditRequested();
      }
    });
    el.appendChild(span);
  }
  draw();
  return { refresh: draw };
}

function wireEmojiPicker(triggerEl, inputEl, popupEl) {
  if (popupEl.dataset.filled !== '1') {
    popupEl.innerHTML = EMOJI_LIST.map(e => `<button type="button">${e}</button>`).join('');
    popupEl.dataset.filled = '1';
    popupEl.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => { inputEl.value = btn.textContent; popupEl.style.display = 'none'; inputEl.focus(); });
    });
  }
  triggerEl.addEventListener('click', () => { popupEl.style.display = popupEl.style.display === 'none' ? 'grid' : 'none'; });
  document.addEventListener('click', (e) => { if (!popupEl.contains(e.target) && e.target !== triggerEl) popupEl.style.display = 'none'; });
}

function wireDurUnit(valueId, unitId) {
  const unitSel = document.getElementById(unitId);
  const valInput = document.getElementById(valueId);
  function apply() {
    // Real bug found: the inline Today-page add-task form is a genuine <form> (#addEntryForm),
    // so submitting it runs the browser's own native constraint validation first — which,
    // with step=0.25, treats anything that isn't an exact quarter-hour (1.37, etc) as invalid
    // and blocks the submit with its own "please enter a valid value" bubble before this file's
    // JS ever runs. The edit-task modal isn't a <form> at all (plain buttons/divs), so it never
    // goes through native validation and silently accepted any typed decimal — which is actually
    // the behavior wanted here too. step="any" tells the browser exactly that: any decimal is a
    // valid hour value, no snapping, matching the modal. (Minutes stay whole-number steps — this
    // is only for hour mode.) iOS's on-screen keypad shows a decimal-point key for any step
    // that isn't a whole integer, "any" included, so that part of the earlier fix still holds.
    valInput.step = unitSel.value === 'hour' ? 'any' : 1;
    valInput.min = 0;
  }
  unitSel.addEventListener('change', apply);
  apply();
}

// AM/PM convenience toggle beside a native <input type=time> (which still stores 24h HH:MM)
function wireAmpmToggle(timeInputId, toggleId) {
  const timeInput = document.getElementById(timeInputId);
  const toggle = document.getElementById(toggleId);
  function sync() {
    const val = timeInput.value;
    const hh = val ? Number(val.split(':')[0]) : null;
    const isPM = hh !== null && hh >= 12;
    toggle.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', hh !== null && (b.dataset.period === 'PM') === isPM);
    });
  }
  toggle.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      let val = timeInput.value || '09:00';
      let [hh, mm] = val.split(':').map(Number);
      const wantPM = btn.dataset.period === 'PM';
      if (wantPM && hh < 12) hh += 12;
      if (!wantPM && hh >= 12) hh -= 12;
      timeInput.value = pad(hh) + ':' + pad(mm);
      sync();
    });
  });
  timeInput.addEventListener('change', sync);
  sync();
  return { sync };
}

// ---------- mental models preview (pinned only) ----------
function renderHomeModels() {
  const grid = document.getElementById('homeModelsGrid');
  const emptyNote = document.getElementById('noPinnedNote');
  const section = document.getElementById('models');
  const divider = document.getElementById('modelsRetraceDivider');
  if (!grid) return;
  const pinned = Data.getPinnedModels();
  if (pinned.length === 0) {
    section.style.display = 'none';
    if (divider) divider.style.display = 'none';
    return;
  }
  section.style.display = '';
  if (divider) divider.style.display = '';
  grid.style.display = '';
  emptyNote.style.display = 'none';
  grid.innerHTML = '';
  pinned.forEach(m => {
    const card = document.createElement('a');
    card.className = 'model-card';
    card.href = `model.html?slug=${encodeURIComponent(m.slug)}`;
    card.innerHTML = `<div class="frame"><img src="${m.img}" alt="${escapeHtml(m.title)}"></div>
      <div class="cap"><h3>${escapeHtml(m.title)}</h3><p>${escapeHtml(m.caption)}</p></div>`;
    grid.appendChild(card);
  });
}

// ================= DAY LIST =================
let currentDate = todayStr();
const ROW_H = 38; // px per half-hour row (must match .grid-slot height in CSS)
let entryColorCtrl, modalColorCtrl, entryAmpmCtrl, modalAmpmCtrl;
let dayListMode = localStorage.getItem('mm_dayListMode') || 'custom';
let tasksCollapsed = localStorage.getItem('mm_tasksCollapsed') === '1';
let chronoCollapsed = localStorage.getItem('mm_chronoCollapsed') === '1';

function renderDayNav() {
  document.getElementById('currentDateLabel').textContent = friendlyDate(currentDate, true);
  // Keeps the hidden date input's value synced to whatever day is actually showing, on every
  // render — not just inside the 📅 button's own click handler. Now that a real tap lands
  // directly on this input (see .open-day-picker in styles.css), the button's click handler
  // often never runs at all, so this can't be the only place the value gets set anymore, or the
  // picker would open pre-selected to whatever it was last left showing instead of today's view.
  document.getElementById('dayOpenPicker').value = currentDate;
}
function refreshDay() {
  // Re-run the recurring-task top-up on every refresh (not just page load) — closes the gap
  // where a series' next occurrence could go missing after navigating around and only reappear
  // on an actual browser refresh. The rough-task rollover that used to run alongside this has
  // been removed entirely (see data.js) — it was relocating unfinished tasks onto today instead
  // of leaving them on their own day, which is exactly the bug that was reported.
  Data.ensureSeriesTopUp();
  renderDayEntries();
  renderDayGrid();
  renderArchiveSection();
}

// ---------- Tasks select mode (mass mark-done / archive-toggle / delete) ----------
// Selection spans BOTH the regular list and the Archive dropdown, so archived tasks are
// selectable too — the toggle button adapts to whichever kind (active or archived) was
// selected first, same pattern as the Habits page, to avoid showing an Archive AND an
// Unarchive button at once.
let taskSelectMode = false;
let taskSelectedIds = new Set();
function updateTaskMassToggleBtn() {
  const btn = document.getElementById('taskMassToggleArchiveBtn');
  if (taskSelectedIds.size === 0) { btn.textContent = 'Archive selected'; return; }
  const firstId = taskSelectedIds.values().next().value;
  const allArchived = Data.getArchivedDayEntries();
  const firstIsArchived = allArchived.some(e => e.id === firstId);
  btn.textContent = firstIsArchived ? 'Restore selected to today' : 'Archive selected';
  btn.dataset.targetArchived = firstIsArchived ? '0' : '1';
}
function updateTaskSelectModeUI() {
  // Date-nav stays visible now (see .nav-disabled) instead of disappearing outright — just
  // muted + non-interactive while there's nothing there to do with a row selection anyway.
  document.getElementById('taskDateNavGroup').classList.toggle('nav-disabled', taskSelectMode);
  // Take Action pill: muted in place (same .nav-disabled treatment) rather than hidden, per
  // request — now that Cancel's own positioning is solid on both mobile and desktop (see
  // styles.css), there's no longer a crowding reason to remove it from the row entirely.
  document.getElementById('flowShortcutBtn').classList.toggle('nav-disabled', taskSelectMode);
  document.getElementById('taskNavActions').style.display = taskSelectMode ? 'none' : 'flex';
  // Class toggle, not inline style.display — mobile needs the mass bar's children to escape into
  // #taskToolsRow's own grid (via display:contents once .mass-bar-open is on, see styles.css) so
  // the 3 real actions can span the row's full width below Cancel/Take Action, instead of being
  // squeezed into a narrow column next to Take Action's full, un-shrunk label. An inline style
  // here would out-specificity that CSS regardless of viewport.
  document.getElementById('taskMassBar').classList.toggle('mass-bar-open', taskSelectMode);
  // Adding a new task while picking existing ones for a bulk action doesn't make sense — block
  // the whole add-form (inputs included, not just the Add button) the same muted+inert way the
  // date-nav and Take Action pill already are above.
  const addForm = document.getElementById('addEntryForm');
  addForm.classList.toggle('nav-disabled', taskSelectMode);
  if (taskSelectMode && addForm.contains(document.activeElement)) document.activeElement.blur();
  if (!taskSelectMode) { taskSelectedIds.clear(); }
  else { archiveOpen = true; } // so archived tasks are visible (and selectable) as soon as Select is on
  updateTaskMassToggleBtn();
}
function exitTaskSelectMode() {
  // guards against a stale selection surviving a date change — the checked ids belong
  // to whichever day was on screen when they were picked, not wherever you navigate to next
  taskSelectMode = false;
  updateTaskSelectModeUI();
}
document.getElementById('taskSelectBtn').addEventListener('click', () => {
  taskSelectMode = true;
  updateTaskSelectModeUI();
  refreshDay();
});
document.getElementById('taskMassCancelBtn').addEventListener('click', () => {
  taskSelectMode = false;
  updateTaskSelectModeUI();
  refreshDay();
});
document.getElementById('taskMassDoneBtn').addEventListener('click', () => {
  if (taskSelectedIds.size === 0) { alert('Select at least one task first.'); return; }
  taskSelectedIds.forEach(id => Data.updateDayEntry(id, { done: true }));
  exitTaskSelectMode();
  refreshDay();
});
document.getElementById('taskMassToggleArchiveBtn').addEventListener('click', (ev) => {
  if (taskSelectedIds.size === 0) { alert('Select at least one task first.'); return; }
  const targetArchived = ev.target.dataset.targetArchived !== '0';
  if (targetArchived) {
    taskSelectedIds.forEach(id => Data.archiveDayEntry(id));
  } else {
    taskSelectedIds.forEach(id => Data.restoreDayEntryToToday(id));
  }
  exitTaskSelectMode();
  refreshDay();
});
document.getElementById('taskMassDeleteBtn').addEventListener('click', async () => {
  if (taskSelectedIds.size === 0) { alert('Select at least one task first.'); return; }
  if (!await SignalConfirm(`Remove ${taskSelectedIds.size} task(s)? Ones picked from the Archive are just cleared from Archive — they still exist on their own day. Ones picked from today's list are fully deleted, same as their own × button.`, { okLabel: 'Remove', danger: true })) return;
  const archivedIds = new Set(Data.getArchivedDayEntries().map(e => e.id));
  taskSelectedIds.forEach(id => {
    if (archivedIds.has(id)) Data.dismissDayEntryFromArchive(id); else Data.deleteDayEntry(id);
  });
  exitTaskSelectMode();
  refreshDay();
});

// used by each task row's small ⏱ button — pre-selects that task as the Flow timer's
// "real task" (same localStorage shape flow.js itself reads/writes) and jumps straight there.
function sendEntryToFlow(entryId) {
  let t;
  try { t = JSON.parse(localStorage.getItem('mm_flowTask')); } catch (err) { t = null; }
  t = Object.assign({ mode: null, entryId: null, customText: '', setAt: null }, t || {});
  t.mode = 'real';
  t.entryId = entryId;
  t.setAt = Date.now();
  localStorage.setItem('mm_flowTask', JSON.stringify(t));
  window.location.href = 'flow.html';
}

function renderEntryRow(e) {
  const row = document.createElement('div');
  row.className = 'entry' + (e.done ? ' done' : '');
  row.dataset.id = e.id;
  const color = e.color || TASK_COLORS[0];
  row.style.setProperty('--task-color-strong', color);

  if (taskSelectMode) {
    const checked = taskSelectedIds.has(e.id);
    row.innerHTML = `
      <input type="checkbox" class="habit-select-checkbox" ${checked ? 'checked' : ''} tabindex="-1">
      <span class="entry-time">${e.time || ''}</span>
      <span class="entry-text">${escapeHtml(e.text)}</span>
      ${e.repeatDaily ? '<span class="entry-repeat-badge" title="Repeats daily">🔁</span>' : ''}
    `;
    row.addEventListener('click', () => {
      if (taskSelectedIds.has(e.id)) taskSelectedIds.delete(e.id); else taskSelectedIds.add(e.id);
      updateTaskMassToggleBtn();
      renderDayEntries();
    });
    return row;
  }

  row.draggable = dayListMode === 'custom';
  const handleHtml = dayListMode === 'custom' ? '<span class="entry-drag-handle" title="Drag to reorder">⠿</span>' : '';
  const priorityHtml = dayListMode === 'priority' ? `<input type="number" class="entry-priority-input" value="${e.priority != null ? e.priority : ''}" placeholder="#" min="1">` : '';
  // Flow only ever lists today's own tasks, so this quick-send button only makes sense
  // (and only shows up) while you're actually looking at today.
  const flowBtnHtml = currentDate === todayStr() ? `<button class="entry-flow-btn" title="Send to the Flow timer">⏱</button>` : '';
  row.innerHTML = `
    ${handleHtml}
    <button class="entry-check" data-id="${e.id}">${e.done ? '✓' : ''}</button>
    <span class="entry-time">${e.time || ''}</span>
    <span class="entry-text">${escapeHtml(e.text)}</span>
    ${e.repeatDaily ? '<span class="entry-repeat-badge" title="Repeats daily">🔁</span>' : ''}
    ${priorityHtml}
    <span class="entry-dur">${minutesLabel(e.durationMin)}</span>
    ${flowBtnHtml}
    <button class="entry-del-x" title="Delete">×</button>
  `;
  row.querySelector('.entry-check').addEventListener('click', (ev) => {
    ev.stopPropagation();
    Data.updateDayEntry(e.id, { done: !e.done });
    refreshDay();
  });
  const flowBtn = row.querySelector('.entry-flow-btn');
  if (flowBtn) {
    flowBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      sendEntryToFlow(e.id);
    });
  }
  row.querySelector('.entry-del-x').addEventListener('click', async (ev) => {
    ev.stopPropagation();
    const warn = e.repeatDaily ? 'Delete this task? Only this day is removed — the rest of the repeat series is untouched.' : 'Delete this task?';
    if (await SignalConfirm(warn, { okLabel: 'Delete', danger: true })) { Data.deleteDayEntry(e.id); refreshDay(); }
  });
  const priorityInput = row.querySelector('.entry-priority-input');
  if (priorityInput) {
    priorityInput.addEventListener('click', (ev) => ev.stopPropagation());
    priorityInput.addEventListener('change', (ev) => {
      const num = parseInt(ev.target.value, 10);
      if (!num || num < 1) Data.updateDayEntry(e.id, { priority: null });
      else Data.setEntryPriority(currentDate, e.id, num);
      renderDayEntries();
    });
  }
  row.addEventListener('click', () => openEntryModal(e));
  return row;
}

function sortEntriesForMode(entries, mode) {
  const byOrder = (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt);
  if (mode === 'timed') {
    const timed = entries.filter(e => e.time).sort((a, b) => a.time.localeCompare(b.time) || byOrder(a, b));
    const untimed = entries.filter(e => !e.time).sort(byOrder);
    return { primary: timed, secondary: untimed };
  }
  if (mode === 'priority') {
    const withP = entries.filter(e => e.priority != null).sort((a, b) => a.priority - b.priority);
    const withoutP = entries.filter(e => e.priority == null).sort(byOrder);
    return { primary: withP, secondary: withoutP };
  }
  return { primary: entries.slice().sort(byOrder), secondary: [] };
}

function renderDayEntries() {
  const all = Data.getDayEntries().filter(e => e.date === currentDate && !e.archived);
  const container = document.getElementById('dayEntriesContainer');
  container.className = 'day-entries mode-' + dayListMode;
  container.innerHTML = '';
  document.getElementById('priorityTools').style.display = dayListMode === 'priority' ? 'flex' : 'none';
  if (all.length === 0) {
    container.innerHTML = '<div class="empty-note">Nothing planned yet — add the first thing you\'ll actually do.</div>';
    return;
  }
  const { primary, secondary } = sortEntriesForMode(all, dayListMode);
  primary.forEach(e => container.appendChild(renderEntryRow(e)));
  if (dayListMode === 'timed' && primary.length && secondary.length) {
    const div = document.createElement('div');
    div.className = 'entry-inline-divider';
    container.appendChild(div);
  }
  secondary.forEach(e => container.appendChild(renderEntryRow(e)));
}

// ---------- archive: unchecked, non-repeating tasks left behind on a past day ----------
// A collapsible dropdown under the Tasks list, unaffected by which of the 3 list modes is
// active — nothing here is truly hidden or lost, just tucked out of the way until wanted back.
let archiveOpen = localStorage.getItem('mm_archiveOpen') === '1';
function renderArchiveSection() {
  const archived = Data.getArchivedDayEntries().sort((a, b) => b.date.localeCompare(a.date));
  const toggleBtn = document.getElementById('archiveToggleBtn');
  const arrow = document.getElementById('archiveArrow');
  const countEl = document.getElementById('archiveCount');
  const listEl = document.getElementById('archiveList');

  if (archived.length === 0) {
    toggleBtn.style.display = 'none';
    listEl.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }
  toggleBtn.style.display = 'flex';
  arrow.textContent = archiveOpen ? '▾' : '▸';
  countEl.textContent = `(${archived.length})`;
  listEl.style.display = archiveOpen ? 'flex' : 'none';
  if (!archiveOpen) return;

  if (taskSelectMode) {
    listEl.innerHTML = archived.map(e => {
      const checked = taskSelectedIds.has(e.id);
      return `
      <div class="archive-row select-mode" data-id="${e.id}">
        <input type="checkbox" class="habit-select-checkbox" ${checked ? 'checked' : ''} tabindex="-1">
        <span class="ar-date">${ddmmyyyyShort(e.date)}</span>
        <span class="ar-text">${escapeHtml(e.text)}</span>
      </div>
    `;
    }).join('');
    listEl.querySelectorAll('.archive-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        if (taskSelectedIds.has(id)) taskSelectedIds.delete(id); else taskSelectedIds.add(id);
        updateTaskMassToggleBtn();
        renderArchiveSection();
      });
    });
    return;
  }

  // No "mark done" checkbox here on purpose — an archived task isn't an active item to log
  // progress against; the only actions on it are "go look at its day" (the date, now clickable
  // — jumps Day List's own date-nav there so its actual siblings for that day show up), restore
  // it back to today, or remove it from this Archive view (soft — see the × title/Data layer).
  listEl.innerHTML = archived.map(e => `
    <div class="archive-row" data-id="${e.id}">
      <button class="ar-date" type="button" data-date="${e.date}" title="Go to ${ddmmyyyyShort(e.date)}">${ddmmyyyyShort(e.date)}</button>
      <span class="ar-text">${escapeHtml(e.text)}</span>
      <button class="ar-restore" type="button" data-id="${e.id}">Restore to today</button>
      <button class="entry-del-x" title="Remove from Archive (it stays on its own day — delete it fully from there)">×</button>
    </div>
  `).join('');
  listEl.querySelectorAll('.ar-date').forEach(btn => {
    btn.addEventListener('click', () => goToDate(btn.dataset.date));
  });
  listEl.querySelectorAll('.ar-restore').forEach(btn => {
    btn.addEventListener('click', () => { Data.restoreDayEntryToToday(btn.dataset.id); refreshDay(); });
  });
  listEl.querySelectorAll('.entry-del-x').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.archive-row');
      if (await SignalConfirm("Remove this from Archive? It's not deleted — it still exists on its own day. To fully delete it, go to that day and delete it there.", { okLabel: 'Remove' })) { Data.dismissDayEntryFromArchive(row.dataset.id); refreshDay(); }
    });
  });
}
function ddmmyyyyShort(dateStr) { const [y, m, d] = dateStr.split('-'); return `${d}-${m}-${y}`; }
document.getElementById('archiveToggleBtn').addEventListener('click', () => {
  archiveOpen = !archiveOpen;
  localStorage.setItem('mm_archiveOpen', archiveOpen ? '1' : '0');
  renderArchiveSection();
});

function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll('.entry:not(.dragging)')];
  return els.reduce((closest, el) => {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: el };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}
function wireDragReorder(container) {
  let draggingEl = null;
  container.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.entry');
    if (!row || !row.draggable) return;
    draggingEl = row;
    requestAnimationFrame(() => row.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.id);
  });
  container.addEventListener('dragend', () => {
    if (draggingEl) draggingEl.classList.remove('dragging');
    draggingEl = null;
    const ids = [...container.querySelectorAll('.entry')].map(el => el.dataset.id);
    Data.reorderDayEntries(ids);
  });
  container.addEventListener('dragover', (e) => {
    if (!draggingEl) return;
    e.preventDefault();
    const afterEl = getDragAfterElement(container, e.clientY);
    if (afterEl == null) container.appendChild(draggingEl);
    else if (afterEl !== draggingEl) container.insertBefore(draggingEl, afterEl);
  });
}

function applyTasksCollapse() {
  document.getElementById('tasksBody').style.display = tasksCollapsed ? 'none' : '';
  document.getElementById('tasksCollapseBtn').innerHTML = `<span class="sc-arrow">${tasksCollapsed ? '▸' : '▾'}</span> Tasks`;
}
function applyChronoCollapse() {
  document.getElementById('chronoBody').style.display = chronoCollapsed ? 'none' : '';
  document.getElementById('chronoCollapseBtn').innerHTML = `<span class="sc-arrow">${chronoCollapsed ? '▸' : '▾'}</span> Timeline`;
}
function updateModeTabsUI() {
  document.querySelectorAll('#listModeTabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === dayListMode);
  });
}

function formatHourLabel(hh) {
  const period = hh < 12 ? 'AM' : 'PM';
  let h12 = hh % 12; if (h12 === 0) h12 = 12;
  return h12 + ' ' + period;
}
function formatTimeLabel(timeStr) {
  const [hh, mm] = timeStr.split(':').map(Number);
  return formatHourLabel(hh) + (mm ? ':' + pad(mm) : '');
}
function timeToMin(t) { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm; }

function computeOverlapLayout(items) {
  const sorted = items.slice().sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const clusters = [];
  let current = [], clusterEnd = -Infinity;
  sorted.forEach(item => {
    if (current.length === 0 || item.startMin < clusterEnd) {
      current.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(current);
      current = [item];
      clusterEnd = item.endMin;
    }
  });
  if (current.length) clusters.push(current);

  const result = new Map();
  clusters.forEach(cluster => {
    const colEnds = [];
    cluster.forEach(item => {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (item.startMin >= colEnds[c]) { colEnds[c] = item.endMin; result.set(item.id, { col: c }); placed = true; break; }
      }
      if (!placed) { colEnds.push(item.endMin); result.set(item.id, { col: colEnds.length - 1 }); }
    });
    const totalCols = colEnds.length;
    cluster.forEach(item => { result.get(item.id).totalCols = totalCols; });
  });
  return result;
}

function renderDayGrid() {
  const wrap = document.getElementById('gridSlots');
  wrap.innerHTML = '';
  for (let i = 0; i < 48; i++) {
    const totalMin = i * 30;
    const hh = Math.floor(totalMin / 60), mm = totalMin % 60;
    const timeStr = pad(hh) + ':' + pad(mm);
    const slot = document.createElement('div');
    slot.className = 'grid-slot' + (mm === 0 ? ' hour-line' : '');
    const showLabel = mm === 0;
    slot.innerHTML = `<span class="slot-label">${showLabel ? formatHourLabel(hh) : ''}</span><span class="slot-plus-fill">+ add at ${formatTimeLabel(timeStr)}</span>`;
    slot.addEventListener('click', () => openEntryModal(null, timeStr));
    wrap.appendChild(slot);
  }
  renderGridTasks();
  // deliberately no scroll-position change here — this runs on every task add/edit/delete,
  // and resetting scroll on each of those was the "timeline jumps" bug. See scrollGridToAnchor().
}

// Only called when the viewed DATE actually changes (date-nav clicks, initial load) —
// never from a plain re-render, so editing/adding a task no longer moves the timeline.
function scrollGridToAnchor() {
  const scrollWrap = document.querySelector('.day-grid-wrap');
  if (!scrollWrap) return;
  let anchorRow;
  if (currentDate === todayStr()) {
    const now = new Date();
    anchorRow = (now.getHours() * 60 + now.getMinutes()) / 30; // current half-hour row, for "today"
  } else {
    anchorRow = 7 * 2; // 7 AM, for any other date
  }
  scrollWrap.scrollTop = Math.max(anchorRow * ROW_H - 120, 0);
}

function renderGridTasks() {
  const overlay = document.getElementById('gridTasks');
  overlay.innerHTML = '';
  overlay.style.height = (48 * ROW_H) + 'px';
  const entries = Data.getDayEntries().filter(e => e.date === currentDate && e.time);
  const items = entries.map(e => {
    const startMin = timeToMin(e.time);
    const durMin = e.durationMin || 30;
    return { id: e.id, entry: e, startMin, endMin: startMin + Math.max(durMin, 15) };
  });
  const layout = computeOverlapLayout(items);

  items.forEach(item => {
    const e = item.entry;
    const { col, totalCols } = layout.get(item.id);
    const top = (item.startMin / 30) * ROW_H;
    const height = Math.max(((item.endMin - item.startMin) / 30) * ROW_H, 20);
    const color = e.color || TASK_COLORS[0];
    const block = document.createElement('div');
    block.className = 'task-block' + (e.done ? ' done' : '');
    block.style.top = top + 'px';
    block.style.height = height + 'px';
    block.style.left = `calc(${(col / totalCols) * 100}% + 1px)`;
    block.style.width = `calc(${100 / totalCols}% - 2px)`;
    block.style.setProperty('--task-color', color);
    block.style.setProperty('--task-color-strong', darken(color, 45));
    block.innerHTML = `<span class="tb-time">${e.time}</span><span class="tb-text">${escapeHtml(e.text)}</span>${e.repeatDaily ? '<span class="tb-repeat" title="Repeats daily">🔁</span>' : ''}`;
    block.addEventListener('click', () => openEntryModal(e));
    overlay.appendChild(block);
  });
}

// Shared "jump the Day List's date-nav to this exact date" helper — used by prev/next/today/the
// open-day picker, and now also the Archive section's clickable dates (simple day-nav: land on
// that date and show everything else that day too, not just the one archived task).
function goToDate(dateStr) {
  if (taskSelectMode) exitTaskSelectMode();
  // Real bug found: fast repeated clicks on the day-nav arrows made the page visibly jump/scroll
  // on its own. renderDayEntries()/renderDayGrid()/renderArchiveSection() below all tear down and
  // rebuild their containers from scratch, and different dates can have very different amounts
  // of content — a short day's list is a lot shorter than a busy one. Rebuilding a shorter list
  // while the page is scrolled down past where its new (shorter) height ends leaves nothing there
  // to scroll to anymore, so the browser snaps the page back up on its own — which reads as a
  // random jump, and gets worse the faster you click through days. renderHabitToday() already
  // guards against exactly this for its own re-renders; goToDate() just never had the same guard
  // for its own page-level scroll position.
  const scrollY = window.scrollY;
  currentDate = dateStr;
  renderDayNav(); refreshDay(); scrollGridToAnchor();
  window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
}

// Shared "actually open a hidden native <input type=date>'s picker" helper. These date inputs
// are deliberately kept visually invisible (see .open-day-picker in styles.css) since only their
// own small 📅 button should trigger them, never the input itself directly.
// Real root cause of "confirmed working on desktop, never once on iPhone" finally tracked down —
// it's not a bug in this code at all, it's an open, unresolved WebKit bug (bugs.webkit.org/
// show_bug.cgi?id=261703). Per a WebKit engineer directly on that thread: showPicker() simply
// isn't implemented for date inputs on iOS Safari at all — calling it doesn't throw, it just
// silently does nothing ("Nothing will happen," their own words, not an exception). That's
// exactly why the try/catch below never fell through to .click() on an iPhone: nothing ever
// throws there for it to catch. Desktop Safari, Chrome, and Firefox all implement showPicker()
// properly, which is why this looked "fixed" the moment it was checked on a laptop. iOS needs to
// skip showPicker() entirely and go straight to .click() — which, per that same WebKit thread,
// is effectively what showPicker() would have to be anyway on iOS ("a wrapper around focus(),
// since native iOS pickers are tied to element focus"), so this isn't a downgrade there, just
// skipping a broken middle step. Detecting "iOS" instead of retesting the (currently working)
// desktop path with feature-detection alone, since the standard `typeof showPicker === 'function'`
// check reports true on iOS too — the method exists there, it's just a no-op for this input type.
function openDatePicker(picker) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (!isIOS && typeof picker.showPicker === 'function') {
    try { picker.showPicker(); return; } catch (err) { /* fall through to .click() below */ }
  }
  picker.click();
}

document.getElementById('flowShortcutBtn').addEventListener('click', () => { window.location.href = 'flow.html'; });
document.getElementById('dayPrev').addEventListener('click', () => goToDate(addDays(currentDate, -1)));
document.getElementById('dayNext').addEventListener('click', () => goToDate(addDays(currentDate, 1)));
document.getElementById('dayToday').addEventListener('click', () => goToDate(todayStr()));
document.getElementById('dayOpenBtn').addEventListener('click', () => {
  const picker = document.getElementById('dayOpenPicker');
  picker.value = currentDate;
  openDatePicker(picker);
});
document.getElementById('dayOpenPicker').addEventListener('change', (e) => {
  if (!e.target.value) return;
  goToDate(e.target.value);
});

document.getElementById('daySearchToggleBtn').addEventListener('click', () => {
  const wrap = document.getElementById('daySearchWrap');
  const showing = wrap.style.display !== 'none';
  wrap.style.display = showing ? 'none' : '';
  if (!showing) document.getElementById('daySearchInput').focus();
});

document.getElementById('addEntryForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const text = document.getElementById('entryText').value.trim();
  const time = document.getElementById('entryTime').value || null;
  const durVal = document.getElementById('entryDurValue').value;
  const durUnit = document.getElementById('entryDurUnit').value;
  const durationMin = durVal ? Math.round(durUnit === 'hour' ? Number(durVal) * 60 : Number(durVal)) : null;
  const notes = document.getElementById('entryNotes').value;
  const color = entryColorCtrl.get();
  if (!text) return;
  Data.addDayEntry({ date: currentDate, text, time, durationMin, notes, color });
  document.getElementById('entryText').value = '';
  document.getElementById('entryTime').value = '';
  document.getElementById('entryDurValue').value = '';
  document.getElementById('entryNotes').value = '';
  entryColorCtrl.set(TASK_COLORS[0]);
  entryAmpmCtrl.sync();
  refreshDay();
});

// ---- entry modal (add/edit) ----
let editingEntryId = null;
function openEntryModal(entry, prefillTime) {
  editingEntryId = entry ? entry.id : null;
  document.getElementById('entryModalTitle').textContent = entry ? 'Edit task' : 'Add task';
  document.getElementById('modalText').value = entry ? entry.text : '';
  document.getElementById('modalTime').value = entry ? (entry.time || '') : (prefillTime || '');
  modalAmpmCtrl.sync();
  const dur = entry ? entry.durationMin : null;
  if (dur && dur % 60 === 0 && dur >= 60) {
    document.getElementById('modalDurValue').value = dur / 60;
    document.getElementById('modalDurUnit').value = 'hour';
  } else {
    document.getElementById('modalDurValue').value = dur || '';
    document.getElementById('modalDurUnit').value = 'min';
  }
  modalColorCtrl.set(entry ? (entry.color || TASK_COLORS[0]) : TASK_COLORS[0]);
  document.getElementById('modalNotes').value = entry ? (entry.notes || '') : '';
  document.getElementById('modalDelete').style.display = entry ? 'inline-block' : 'none';
  document.getElementById('modalArchive').style.display = entry ? 'inline-block' : 'none';
  const repeatBox = document.getElementById('modalRepeat');
  repeatBox.checked = entry ? !!entry.repeatDaily : false;
  const hint = document.getElementById('modalRepeatHint');
  hint.textContent = entry && entry.seriesId
    ? 'Editing this saves it for this day and every future day in the series — past days keep their original time.'
    : 'Repeats every day from here forward (never backfills earlier days).';
  document.getElementById('entryModalOverlay').style.display = 'flex';
  document.getElementById('modalText').focus();
}
function closeEntryModal() {
  document.getElementById('entryModalOverlay').style.display = 'none';
  editingEntryId = null;
}
document.getElementById('modalCancel').addEventListener('click', closeEntryModal);
document.getElementById('entryModalOverlay').addEventListener('click', (e) => { if (e.target.id === 'entryModalOverlay') closeEntryModal(); });
document.getElementById('modalSave').addEventListener('click', () => {
  const text = document.getElementById('modalText').value.trim();
  if (!text) { alert('Give it a name first.'); return; }
  const time = document.getElementById('modalTime').value || null;
  const durVal = document.getElementById('modalDurValue').value;
  const durUnit = document.getElementById('modalDurUnit').value;
  const durationMin = durVal ? Math.round(durUnit === 'hour' ? Number(durVal) * 60 : Number(durVal)) : null;
  const notes = document.getElementById('modalNotes').value;
  const repeatDaily = document.getElementById('modalRepeat').checked;
  const color = modalColorCtrl.get();

  if (editingEntryId) {
    Data.updateDayEntryPropagating(editingEntryId, { text, time, durationMin, notes, repeatDaily, color });
  } else {
    const arr = Data.addDayEntry({ date: currentDate, text, time, durationMin, notes, repeatDaily: false, color });
    const newEntry = arr[arr.length - 1];
    if (repeatDaily && time) Data.startRepeat(newEntry.id);
  }
  closeEntryModal();
  refreshDay();
});
document.getElementById('modalDelete').addEventListener('click', async () => {
  if (!editingEntryId) return;
  const entry = Data.getDayEntries().find(e => e.id === editingEntryId);
  const warn = entry && entry.repeatDaily ? 'Delete this task? Only this day is removed — the rest of the repeat series is untouched.' : 'Delete this task?';
  if (await SignalConfirm(warn, { okLabel: 'Delete', danger: true })) { Data.deleteDayEntry(editingEntryId); closeEntryModal(); refreshDay(); }
});
document.getElementById('modalArchive').addEventListener('click', () => {
  if (!editingEntryId) return;
  Data.archiveDayEntry(editingEntryId);
  closeEntryModal();
  refreshDay();
});

function runDaySearch() {
  const q = document.getElementById('daySearchInput').value.trim().toLowerCase();
  const box = document.getElementById('daySearchResults');
  if (!q) { box.innerHTML = ''; return; }
  const matches = Data.getDayEntries().filter(e => e.text.toLowerCase().includes(q) || (e.notes && e.notes.toLowerCase().includes(q)));
  if (matches.length === 0) { box.innerHTML = `<div class="empty-note">No matches for "${escapeHtml(q)}" yet.</div>`; return; }
  const days = new Set(matches.map(m => m.date));
  const totalMin = matches.reduce((s, m) => s + (m.durationMin || 0), 0);
  matches.sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
  let html = `<div class="search-summary">${matches.length} match${matches.length === 1 ? '' : 'es'} across ${days.size} day${days.size === 1 ? '' : 's'}${totalMin ? ' · ' + minutesLabel(totalMin) + ' total logged' : ''}</div>`;
  matches.forEach(m => {
    html += `<div class="search-row">
      <span class="sr-date">${m.date}${m.time ? ' · ' + m.time : ''}</span>
      <span class="sr-text">${escapeHtml(m.text)}${m.notes ? ' — ' + escapeHtml(m.notes) : ''}</span>
      <span class="sr-meta">${m.done ? 'done' : 'open'}${m.durationMin ? ' · ' + minutesLabel(m.durationMin) : ''}</span>
    </div>`;
  });
  box.innerHTML = html;
}
document.getElementById('daySearchBtn').addEventListener('click', runDaySearch);
document.getElementById('daySearchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runDaySearch(); } });

// ================= HABIT (today snapshot, backward-navigable) =================
let addHabitColorCtrl;
let habitLogDate = todayStr();

function renderHabitDayNav() {
  document.getElementById('habitDateLabel').textContent = friendlyDate(habitLogDate, true);
  const nextBtn = document.getElementById('habitNext');
  const atToday = habitLogDate >= todayStr();
  nextBtn.disabled = atToday;
  nextBtn.classList.toggle('next-disabled', atToday);
  document.getElementById('habitOpenPicker').max = todayStr(); // habit tracker doesn't allow
  // viewing future days — matches habitNext's own limit. Set here (whenever the nav re-renders)
  // rather than inside the open-picker click handler itself — setting an attribute on the input
  // in the same synchronous handler as calling showPicker() on it is a plausible source of the
  // "picker doesn't open on iOS" report (Day List's equivalent button, which has no such
  // attribute to set, was never reported broken), so the handler below now only sets .value and
  // calls showPicker(), matching that already-working pattern exactly.
  // Same reasoning as renderDayNav()'s dayOpenPicker sync above — kept in step with
  // habitLogDate on every render now that a real tap goes straight to this input, bypassing the
  // click handler that used to be the only place .value got set.
  document.getElementById('habitOpenPicker').value = habitLogDate;
}
document.getElementById('habitPrev').addEventListener('click', () => { habitLogDate = addDays(habitLogDate, -1); renderHabitDayNav(); renderHabitToday(); });
document.getElementById('habitNext').addEventListener('click', () => {
  if (habitLogDate >= todayStr()) return;
  habitLogDate = addDays(habitLogDate, 1); renderHabitDayNav(); renderHabitToday();
});
document.getElementById('habitToday').addEventListener('click', () => { habitLogDate = todayStr(); renderHabitDayNav(); renderHabitToday(); });
document.getElementById('habitOpenBtn').addEventListener('click', () => {
  const picker = document.getElementById('habitOpenPicker');
  picker.value = habitLogDate;
  openDatePicker(picker);
});
document.getElementById('habitOpenPicker').addEventListener('change', (e) => {
  if (!e.target.value) return;
  habitLogDate = e.target.value > todayStr() ? todayStr() : e.target.value;
  renderHabitDayNav(); renderHabitToday();
});

document.getElementById('habitSearchToggleBtn').addEventListener('click', () => {
  const wrap = document.getElementById('habitSearchWrap');
  const showing = wrap.style.display !== 'none';
  wrap.style.display = showing ? 'none' : '';
  if (!showing) document.getElementById('habitSearchInput').focus();
});

function showNewHabitForm() {
  document.getElementById('addHabitForm').style.display = 'flex';
  document.getElementById('newHabitBtn').style.display = 'none';
  document.getElementById('habitCancelBtn').style.display = 'inline-flex';
  document.getElementById('habitName').focus();
}
function hideNewHabitForm() {
  document.getElementById('addHabitForm').style.display = 'none';
  document.getElementById('newHabitBtn').style.display = '';
  document.getElementById('habitCancelBtn').style.display = 'none';
  document.getElementById('habitName').value = '';
  document.getElementById('habitIcon').value = '';
  document.getElementById('habitMetric').value = '';
}
document.getElementById('newHabitBtn').addEventListener('click', showNewHabitForm);
document.getElementById('habitCancelBtn').addEventListener('click', hideNewHabitForm);

// ---------- Habits (Today section) select mode (mass archive / delete) ----------
let habitTodaySelectMode = false;
let habitTodaySelectedIds = new Set();
function updateHabitTodaySelectModeUI() {
  // Same "mute + disable in place, don't hide" treatment as the Day List's date-nav above.
  document.getElementById('habitDateNavGroup').classList.toggle('nav-disabled', habitTodaySelectMode);
  document.getElementById('habitNavActions').style.display = habitTodaySelectMode ? 'none' : 'flex';
  // Class toggle, not inline style.display: desktop needs this to become `display:contents`
  // (freeing Cancel/the actions row to join #habitDayNavRow's own grid directly — see styles.css)
  // while mobile still wants a real `display:flex` on this element itself. An inline style here
  // would out-specificity either CSS rule regardless of viewport, so the show/hide *and* the
  // display-mode-per-breakpoint both live in styles.css now instead.
  document.getElementById('habitTodayMassBar').classList.toggle('mass-bar-open', habitTodaySelectMode);
  // Adding a new habit while picking existing ones for a bulk action doesn't make sense either —
  // same muted+inert block as the add-task form above.
  document.getElementById('newHabitBtn').classList.toggle('nav-disabled', habitTodaySelectMode);
  if (!habitTodaySelectMode) habitTodaySelectedIds.clear();
}
document.getElementById('habitSelectBtn').addEventListener('click', () => {
  hideNewHabitForm(); // in case the add-habit form was open — don't let both be active together
  habitTodaySelectMode = true;
  updateHabitTodaySelectModeUI();
  renderHabitToday();
});
document.getElementById('habitTodayMassCancelBtn').addEventListener('click', () => {
  habitTodaySelectMode = false;
  updateHabitTodaySelectModeUI();
  renderHabitToday();
});
document.getElementById('habitTodayMassDoneBtn').addEventListener('click', () => {
  if (habitTodaySelectedIds.size === 0) { alert('Select at least one habit first.'); return; }
  habitTodaySelectedIds.forEach(id => Data.upsertHabitLog(id, habitLogDate, { done: true }));
  habitTodaySelectMode = false;
  updateHabitTodaySelectModeUI();
  renderHabitToday();
  if (document.getElementById('habitCalendarView').style.display !== 'none') renderCalendar();
});
document.getElementById('habitTodayMassArchiveBtn').addEventListener('click', async () => {
  if (habitTodaySelectedIds.size === 0) { alert('Select at least one habit first.'); return; }
  if (!await SignalConfirm(`Move ${habitTodaySelectedIds.size} habit(s) to archive? Nothing is deleted — restore them any time from the All Habits page.`, { okLabel: 'Archive' })) return;
  habitTodaySelectedIds.forEach(id => Data.updateHabit(id, { archived: true }));
  habitTodaySelectMode = false;
  updateHabitTodaySelectModeUI();
  renderHabitToday();
  renderCalLegend();
  if (document.getElementById('habitCalendarView').style.display !== 'none') renderCalendar();
});
document.getElementById('habitTodayMassDeleteBtn').addEventListener('click', async () => {
  if (habitTodaySelectedIds.size === 0) { alert('Select at least one habit first.'); return; }
  if (!await SignalConfirm(`Delete ${habitTodaySelectedIds.size} habit(s) and all their history? This can't be undone (unless you restore a backup).`, { okLabel: 'Delete', danger: true })) return;
  habitTodaySelectedIds.forEach(id => Data.deleteHabit(id));
  habitTodaySelectMode = false;
  updateHabitTodaySelectModeUI();
  renderHabitToday();
  renderCalLegend();
  if (document.getElementById('habitCalendarView').style.display !== 'none') renderCalendar();
});

function renderHabitToday() {
  const scrollY = window.scrollY; // habit-list re-renders shouldn't ever move the rest of the page
  const logs = Data.getHabitLogs();
  const byOrder = (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt);
  // getHabitsForDate also folds in "ghost" rows: habits that were later deleted, but only for
  // the specific date(s) they actually have a log on — so navigating back to that day still
  // shows what happened, even though the habit itself is gone everywhere else.
  const habits = Data.getHabitsForDate(habitLogDate).sort(byOrder);
  const isDoneToday = (h) => { const l = logs.find(x => x.habitId === h.id && x.date === habitLogDate); return !!(l && l.done); };
  // not-done habits float up, done ones sink down and mute — same convention as a completed task
  const ordered = habits.filter(h => !isDoneToday(h)).concat(habits.filter(h => isDoneToday(h)));
  const list = document.getElementById('habitTodayList');
  list.innerHTML = '';
  if (habits.length === 0) {
    list.innerHTML = '<div class="empty-note">No habits yet — add the first one you want to keep showing up for.</div>';
    window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
    return;
  }
  ordered.forEach(h => {
    const log = logs.find(l => l.habitId === h.id && l.date === habitLogDate);
    const done = !!(log && log.done);
    const row = document.createElement('div');
    row.className = 'habit-row' + (done ? ' done' : '');
    row.dataset.id = h.id;

    // a deleted habit surfaced only because it has history on this exact date — show it
    // read-only (no drag, no re-toggling, no link back to a page that no longer exists for
    // it) with just a way to clear this one day's record, per "unless deleted there"
    if (h.deleted) {
      row.classList.add('habit-row-ghost');
      row.innerHTML = `
        <span class="habit-icon-badge" style="background:${h.color}22;border-color:${h.color}">${escapeHtml(h.icon || '●')}</span>
        <span class="habit-name habit-ghost-name" title="Permanently delete this habit and all its history">${escapeHtml(h.name)} <span class="ghost-tag">deleted</span></span>
        <span class="ghost-note">${escapeHtml((log && log.note) || '')}${log && log.metricValue != null && log.metricValue !== '' ? ` · ${escapeHtml(String(log.metricValue))}` : ''}</span>
        <span class="ghost-done">${done ? '✓' : ''}</span>
        <button class="entry-del-x" title="Remove this day's record">×</button>
      `;
      row.querySelector('.habit-ghost-name').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (await SignalConfirm(`Delete "${h.name}" from all records permanently? This removes the habit and every logged day it has, everywhere — not just this one day. Can't be undone (unless you restore a backup).`, { okLabel: 'Delete permanently', danger: true })) {
          Data.hardDeleteHabit(h.id);
          renderHabitToday();
          if (document.getElementById('habitCalendarView').style.display !== 'none') renderCalendar();
        }
      });
      row.querySelector('.entry-del-x').addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (await SignalConfirm(`Remove ${h.name}'s record for this day? (The habit itself is already deleted — this just clears this one day.)`, { okLabel: 'Remove' })) {
          Data.deleteHabitLog(h.id, habitLogDate);
          renderHabitToday();
        }
      });
      list.appendChild(row);
      return;
    }

    if (habitTodaySelectMode) {
      const checked = habitTodaySelectedIds.has(h.id);
      row.classList.add('habit-row-select');
      row.innerHTML = `
        <input type="checkbox" class="habit-select-checkbox" ${checked ? 'checked' : ''} tabindex="-1">
        <span class="habit-icon-badge" style="background:${h.color}22;border-color:${h.color}">${escapeHtml(h.icon || '●')}</span>
        <span class="habit-name">${escapeHtml(h.name)}</span>
      `;
      row.addEventListener('click', () => {
        if (habitTodaySelectedIds.has(h.id)) habitTodaySelectedIds.delete(h.id); else habitTodaySelectedIds.add(h.id);
        renderHabitToday();
      });
      list.appendChild(row);
      return;
    }

    row.draggable = true;
    // Mobile shows this plain-text mirror of the metric value under the habit name instead of
    // the full interactive .metric-cell (see styles.css) — desktop keeps the real control below.
    const metricMini = (log && log.metric) || h.metric || '';
    row.innerHTML = `
      <span class="entry-drag-handle" title="Drag to reorder">⠿</span>
      <a class="habit-identity" href="habit.html?id=${h.id}" title="View / edit ${escapeHtml(h.name)}">
        <span class="habit-icon-badge" style="background:${h.color}22;border-color:${h.color}">${escapeHtml(h.icon || '●')}</span>
        <span class="habit-identity-text">
          <span class="habit-name">${escapeHtml(h.name)}</span>
          <span class="habit-metric-mini">${escapeHtml(metricMini)}</span>
        </span>
      </a>
      <div class="metric-cell"></div>
      <input type="text" class="habit-note-input" placeholder="note…" value="${escapeHtml((log && log.note) || '')}">
      <button class="habit-toggle" style="background:${done ? h.color : 'transparent'};border-color:${h.color};" title="${done ? 'Mark not done' : 'Mark done'}">${done ? '✓' : ''}</button>
    `;
    renderMetricCell(row.querySelector('.metric-cell'), {
      habitId: h.id,
      date: habitLogDate,
      habit: h,
      getLog: () => Data.getHabitLogs().find(l => l.habitId === h.id && l.date === habitLogDate),
      onDefaultEditRequested: () => { location.href = `habit.html?id=${h.id}&editMetric=1`; }
    });
    row.querySelector('.habit-note-input').addEventListener('change', (e) => {
      Data.upsertHabitLog(h.id, habitLogDate, { note: e.target.value });
    });
    row.querySelector('.habit-toggle').addEventListener('click', (ev) => {
      ev.stopPropagation();
      Data.toggleHabitDone(h.id, habitLogDate);
      renderHabitToday();
      if (document.getElementById('habitCalendarView').style.display !== 'none') renderCalendar();
    });
    list.appendChild(row);
  });
  fitHabitNames(list);
  window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
}

// Long habit names on a phone previously just got truncated with "..." once CSS Grid gave the
// name column a real (non-fixed) width to work with — better than clipping mid-letter, but still
// loses real information for anything past a word or two. This measures each rendered name
// against the space it actually has and, in order: (1) leaves it alone if it already fits, (2)
// shrinks font-size in small steps if it doesn't, down to a floor before the text gets too small
// to read comfortably, (3) only if it *still* doesn't fit at that floor AND the name has more
// than one word, lets it wrap onto a second line instead of continuing to shrink or truncate —
// .habit-metric-mini sits below the name in the same column regardless, so it just moves down
// with it. Desktop's fixed-width identity column + ellipsis is untouched (this is scoped to the
// same mobile width where the CSS Grid identity column — see styles.css — replaces it).
const HABIT_NAME_BASE_FONT = 13.5; // px — must match .habit-name's own font-size in styles.css
const HABIT_NAME_MIN_FONT = 11.5;  // px — floor before falling back to a second line instead
function fitHabitNames(container) {
  if (!window.matchMedia('(max-width: 760px)').matches) return;
  container.querySelectorAll('.habit-name').forEach(nameEl => {
    nameEl.style.fontSize = '';
    nameEl.classList.remove('habit-name-wrap');
    if (nameEl.scrollWidth <= nameEl.clientWidth) return; // fits already at the base size
    let size = HABIT_NAME_BASE_FONT;
    while (nameEl.scrollWidth > nameEl.clientWidth && size > HABIT_NAME_MIN_FONT) {
      size -= 0.5;
      nameEl.style.fontSize = size + 'px';
    }
    if (nameEl.scrollWidth > nameEl.clientWidth && /\s/.test(nameEl.textContent.trim())) {
      nameEl.classList.add('habit-name-wrap');
    }
  });
}

function getDragAfterElementGeneric(container, y, selector) {
  const els = [...container.querySelectorAll(selector + ':not(.dragging)')];
  return els.reduce((closest, el) => {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: el };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}
function wireHabitDragReorder(container) {
  let draggingEl = null;
  container.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.habit-row');
    if (!row) return;
    draggingEl = row;
    requestAnimationFrame(() => row.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.id);
  });
  container.addEventListener('dragend', () => {
    if (draggingEl) draggingEl.classList.remove('dragging');
    draggingEl = null;
    const ids = [...container.querySelectorAll('.habit-row')].map(el => el.dataset.id);
    Data.reorderHabits(ids);
  });
  container.addEventListener('dragover', (e) => {
    if (!draggingEl) return;
    e.preventDefault();
    const afterEl = getDragAfterElementGeneric(container, e.clientY, '.habit-row');
    if (afterEl == null) container.appendChild(draggingEl);
    else if (afterEl !== draggingEl) container.insertBefore(draggingEl, afterEl);
  });
}

document.getElementById('addHabitForm').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const name = document.getElementById('habitName').value.trim();
  if (!name) return;
  const scrollY = window.scrollY;
  const icon = document.getElementById('habitIcon').value.trim();
  const metric = document.getElementById('habitMetric').value.trim();
  const color = addHabitColorCtrl.get();
  Data.addHabit({ name, icon, color, metric });
  addHabitColorCtrl.set(Data.colorForIndex(Data.getHabits().length));
  // form stays open on purpose (only Cancel closes it) — so several habits can be
  // added back-to-back without reopening it each time
  document.getElementById('habitName').value = '';
  document.getElementById('habitIcon').value = '';
  document.getElementById('habitMetric').value = '';
  document.getElementById('habitName').focus();
  renderHabitToday();
  renderCalLegend();
  window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
});

document.getElementById('tabToday').addEventListener('click', () => {
  document.getElementById('tabToday').classList.add('active');
  document.getElementById('tabCalendar').classList.remove('active');
  document.getElementById('habitTodayView').style.display = '';
  document.getElementById('habitCalendarView').style.display = 'none';
});
document.getElementById('tabCalendar').addEventListener('click', () => {
  document.getElementById('tabCalendar').classList.add('active');
  document.getElementById('tabToday').classList.remove('active');
  document.getElementById('habitCalendarView').style.display = '';
  document.getElementById('habitTodayView').style.display = 'none';
  renderCalendar();
});

let calMonth = new Date(); calMonth.setDate(1);
let calSelectedDate = null;
let calShowDeleted = false;
let calHiddenIds = new Set(); // habits toggled off in the legend — hides just their dots in the month grid, not their entry in the day-detail panel below

function calHabits() {
  // deleted habits are soft-deleted (Data.deleteHabit) — their record and logs both survive.
  // Hidden here by default (this calendar previously silently dropped their dots/detail rows
  // entirely, even though the underlying log data was still there); "Show deleted" reveals them.
  return Data.getHabits().filter(h => !h.archived || (calShowDeleted && h.deleted));
}

function renderCalLegend() {
  const habits = calHabits();
  const wrap = document.getElementById('calLegend');
  wrap.className = 'cal-legend big';
  // "(deleted)" is its own clickable span now, not just a label suffix — same permanent hard-delete
  // confirm as the ghost row's name uses elsewhere, so a legend entry with real history behind it
  // (which is why it's soft-deleted and showing up here at all) can still be cleared for good once
  // you're done with it, without having to dig up a day it was logged on just to reach the ghost row.
  wrap.innerHTML = habits.map(h => `<label class="li${h.deleted ? ' deleted' : ''}"><input type="checkbox" class="cal-legend-check" data-id="${h.id}" ${calHiddenIds.has(h.id) ? '' : 'checked'}><span class="sw" style="background:${h.color}"></span>${escapeHtml(h.icon || '')} ${escapeHtml(h.name)}${h.deleted ? ` <span class="legend-hard-del" data-id="${h.id}" title="Permanently delete this habit and all its history">(deleted)</span>` : ''}</label>`).join('');
  wrap.querySelectorAll('.cal-legend-check').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      if (e.target.checked) calHiddenIds.delete(id); else calHiddenIds.add(id);
      renderCalGrid(); // just the dots need to redraw — no need to rebuild the legend itself mid-click
    });
  });
  wrap.querySelectorAll('.legend-hard-del').forEach(span => {
    span.addEventListener('click', async (ev) => {
      ev.preventDefault(); ev.stopPropagation(); // it's inside the <label> — don't let this toggle the checkbox too
      const id = span.dataset.id;
      const h = Data.getHabit(id);
      if (!h) return;
      if (await SignalConfirm(`Delete "${h.name}" from all records permanently? This removes the habit and every logged day it has, everywhere — not just this one day. Can't be undone (unless you restore a backup).`, { okLabel: 'Delete permanently', danger: true })) {
        Data.hardDeleteHabit(id);
        renderCalendar();
        renderHabitToday();
      }
    });
  });
}
function renderCalDetail(dateStr) {
  const habits = calHabits();
  const logs = Data.getHabitLogs().filter(l => l.date === dateStr && (l.done || (l.note && l.note.trim())));
  const box = document.getElementById('calDetail');
  box.style.display = '';
  let html = `<h4>${friendlyDate(dateStr)}</h4>`;
  const rows = logs.map(l => ({ l, h: habits.find(h => h.id === l.habitId) })).filter(r => r.h);
  if (rows.length === 0) { html += '<div class="empty-note">No habits logged this day.</div>'; }
  else {
    rows.forEach(({ l, h }) => {
      html += `<div class="item${h.deleted ? ' deleted' : ''}"><span class="sw" style="background:${h.color}"></span>${escapeHtml(h.icon || '')} ${escapeHtml(h.name)}${h.deleted ? ' (deleted)' : ''}${l.done ? ' ✓' : ' (noted)'}${l.metric ? ' · ' + escapeHtml(l.metric) : ''}${l.note ? ' — ' + escapeHtml(l.note) : ''}${h.deleted ? `<button type="button" class="cal-log-del" data-habit="${h.id}" data-date="${dateStr}" title="Permanently remove this leftover log entry">×</button>` : ''}</div>`;
    });
  }
  box.innerHTML = html;
  box.querySelectorAll('.cal-log-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await SignalConfirm('Permanently remove this log entry? The habit is already deleted — this just clears its leftover record for this one day.', { okLabel: 'Remove', danger: true })) {
        Data.deleteHabitLog(btn.dataset.habit, btn.dataset.date);
        renderCalendar();
      }
    });
  });
}
function renderCalGrid() {
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  grid.style.removeProperty('--cal-cell-size');
  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const habits = calHabits();
  const logs = Data.getHabitLogs().filter(l => l.done);
  const today = todayStr();
  const mobile = window.matchMedia('(max-width: 760px)').matches;

  function makeDowCell(letter) { const el = document.createElement('div'); el.className = 'cal-dow'; el.textContent = letter; return el; }
  function makeEmptyCell() { const el = document.createElement('div'); el.className = 'cal-cell empty'; return el; }
  function makeDayCell(day) {
    const dateStr = year + '-' + pad(month + 1) + '-' + pad(day);
    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (dateStr === today ? ' today' : '') + (dateStr === calSelectedDate ? ' selected' : '');
    const dayLogs = logs.filter(l => l.date === dateStr && !calHiddenIds.has(l.habitId));
    const dotsHtml = dayLogs.map(l => {
      const h = habits.find(h => h.id === l.habitId);
      return h ? `<span class="d" style="background:${h.color}" title="${escapeHtml(h.name)}"></span>` : '';
    }).join('');
    cell.innerHTML = `<span class="cal-daynum">${day}</span><div class="cal-dots big">${dotsHtml}</div>`;
    cell.addEventListener('click', () => {
      calSelectedDate = dateStr;
      habitLogDate = dateStr; // clicking a calendar day here also moves the Today-snapshot day-nav to that date, same as the habit-detail page's own month calendar
      renderHabitDayNav();
      renderCalGrid();
      renderCalDetail(dateStr);
    });
    return { cell, dayLogs };
  }

  let busiestCell = null, maxDots = -1;

  if (!mobile) {
    // Desktop/tablet: unchanged from how this always worked — a flat 7-column grid (days of the
    // week as columns), weeks stacking downward as rows.
    DOW.forEach(d => grid.appendChild(makeDowCell(d[0])));
    for (let i = 0; i < firstDow; i++) grid.appendChild(makeEmptyCell());
    for (let day = 1; day <= daysInMonth; day++) {
      const { cell, dayLogs } = makeDayCell(day);
      grid.appendChild(cell);
      if (dayLogs.length > maxDots) { maxDots = dayLogs.length; busiestCell = cell; }
    }
  } else {
    // Mobile: transposed — weekdays become a sticky leading column, weeks become columns that
    // scroll (and pinch-zoom, see the touch handler below) horizontally instead of every row
    // growing the whole page taller on a busy month. Built as one flex column per week (each a
    // fixed 7-cell stack) rather than reshaping the same flat grid with grid-auto-flow:column —
    // that CSS-only version positioned every cell correctly, but Chromium (going by how
    // fundamental the mismatch was, quite possibly Safari too) computed the grid container's own
    // auto height shorter than the sum of its own row tracks once aspect-ratio and an implicit,
    // custom-property-sized column were both in play, silently clipping the bottom rows —
    // reintroducing the exact vertical cut-off this whole change was meant to fix. Nested flex
    // columns size on the much more ordinary "tallest child" cross-axis calculation instead, with
    // no aspect-ratio or auto-track-sizing involved anywhere.
    grid.classList.add('cal-grid-mobile');
    const labelCol = document.createElement('div');
    labelCol.className = 'cal-week-col cal-week-col-labels';
    DOW.forEach(d => labelCol.appendChild(makeDowCell(d[0])));
    grid.appendChild(labelCol);
    let day = 1, weeksCount = 0, firstWeek = true;
    while (day <= daysInMonth) {
      const weekCol = document.createElement('div');
      weekCol.className = 'cal-week-col';
      const startPad = firstWeek ? firstDow : 0;
      for (let i = 0; i < startPad; i++) weekCol.appendChild(makeEmptyCell());
      for (let i = startPad; i < 7 && day <= daysInMonth; i++, day++) {
        const { cell, dayLogs } = makeDayCell(day);
        weekCol.appendChild(cell);
        if (dayLogs.length > maxDots) { maxDots = dayLogs.length; busiestCell = cell; }
      }
      grid.appendChild(weekCol);
      firstWeek = false; weeksCount++;
    }
    // Default cell size: divide the width actually available (not a CSS 1fr guess) evenly across
    // however many week-columns this specific month needs, so a light month still fills the
    // screen nicely by default — same starting point the growth/zoom logic below then builds on.
    const gap = 6, labelWidth = labelCol.getBoundingClientRect().width || 22;
    const availForWeeks = grid.clientWidth - labelWidth - gap;
    const natural = Math.max(38, Math.floor((availForWeeks - (weeksCount - 1) * gap) / weeksCount));
    grid.style.setProperty('--cal-cell-size', natural + 'px');
  }

  // Grows every cell uniformly, both width and height together (via --cal-cell-size, which both
  // the desktop .cal-grid column width and the mobile .cal-week-col width above read from), once
  // the busiest day this month needs more room than its current size gives it — a busy cell stays
  // a true square instead of a width-fixed, only-taller rectangle. Measured directly against the
  // real rendered busiest cell — nudging the shared size a step at a time until that cell's own
  // height stops exceeding its width — rather than computed from a formula guessing at this
  // cell's padding, line-height, gap, etc. from outside; much less fragile than trying to
  // hand-keep a formula in sync with the actual CSS, and self-corrects if any of that ever
  // changes.
  if (busiestCell && maxDots > 0) {
    let guard = 0;
    while (guard++ < 25) {
      const rect = busiestCell.getBoundingClientRect();
      if (rect.height <= rect.width + 1) break; // square enough
      const current = parseFloat(getComputedStyle(grid).getPropertyValue('--cal-cell-size')) || rect.width;
      grid.style.setProperty('--cal-cell-size', (current + 4) + 'px');
    }
  }
}

function renderCalendar() {
  renderCalLegend();
  document.getElementById('calLabel').textContent = MONTHS[calMonth.getMonth()] + ' ' + calMonth.getFullYear();
  // Habit logging doesn't allow future days at all (see habitNext's own atToday guard above) —
  // matches that same limit at the month level: can't navigate the calendar past the current
  // month either, since there's nothing to show there.
  const nextBtn = document.getElementById('calNext');
  const now = new Date();
  const atCurrentMonth = calMonth.getFullYear() === now.getFullYear() && calMonth.getMonth() === now.getMonth();
  nextBtn.disabled = atCurrentMonth;
  nextBtn.classList.toggle('next-disabled', atCurrentMonth);
  renderCalGrid();
  if (calSelectedDate) renderCalDetail(calSelectedDate);
}
document.getElementById('calPrev').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
document.getElementById('calNext').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });
document.getElementById('calShowDeletedBtn').addEventListener('click', (e) => {
  calShowDeleted = !calShowDeleted;
  e.target.classList.toggle('active', calShowDeleted);
  e.target.textContent = calShowDeleted ? 'Hide deleted' : 'Show deleted';
  renderCalendar();
});

function runHabitSearch() {
  const q = document.getElementById('habitSearchInput').value.trim().toLowerCase();
  const box = document.getElementById('habitSearchResults');
  if (!q) { box.innerHTML = ''; return; }
  // deleted habits are excluded here on purpose — searching by name shouldn't resurface
  // something you removed. A note it left behind can still turn up below, but falls back
  // to the "(deleted habit)" label since `h` won't be found in this filtered list.
  const habits = Data.getHabits().filter(h => !h.deleted);
  const matchedHabits = habits.filter(h => h.name.toLowerCase().includes(q));
  const matchedIds = new Set(matchedHabits.map(h => h.id));
  const noteMatches = Data.getHabitLogs().filter(l => l.note && l.note.toLowerCase().includes(q) && !matchedIds.has(l.habitId));
  if (matchedHabits.length === 0 && noteMatches.length === 0) { box.innerHTML = `<div class="empty-note">No habits or notes match "${escapeHtml(q)}".</div>`; return; }
  let html = '';
  if (matchedHabits.length) {
    html += `<div class="search-group-label">Habits</div>`;
    matchedHabits.forEach(h => {
      const stats = Data.getHabitStats(h.id);
      html += `<a class="habit-result-row" href="habit.html?id=${h.id}">
        <span class="sw-badge" style="background:${h.color}22;border-color:${h.color}">${escapeHtml(h.icon || '●')}</span>
        <span class="hr-name">${escapeHtml(h.name)}</span>
        <span class="hr-stats">${stats.daysDone} day${stats.daysDone === 1 ? '' : 's'}${stats.totalMin ? ' · ' + minutesLabel(stats.totalMin) : ''}</span>
      </a>`;
    });
  }
  if (noteMatches.length) {
    html += `<div class="search-group-label">Notes mentioning "${escapeHtml(q)}"</div>`;
    noteMatches.sort((a, b) => b.date.localeCompare(a.date));
    noteMatches.forEach(l => {
      const h = habits.find(h => h.id === l.habitId);
      html += `<a class="search-row" href="habit.html?id=${l.habitId}" style="text-decoration:none; color:inherit;">
        <span class="sr-date">${l.date}</span>
        <span class="sr-text">${h ? escapeHtml(h.icon || '') + ' ' + escapeHtml(h.name) : '(deleted habit)'} — ${escapeHtml(l.note)}</span>
        <span class="sr-meta">${l.done ? 'done' : 'noted'}</span>
      </a>`;
    });
  }
  box.innerHTML = html;
}
document.getElementById('habitSearchBtn').addEventListener('click', runHabitSearch);
document.getElementById('habitSearchInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runHabitSearch(); } });

// ================= NOTES (Today's journal entry) =================
// Saving on every keystroke used to run a full JSON.stringify + localStorage.setItem of the
// whole journal array synchronously inside the 'input' handler — harmless on desktop, but a
// real, felt lag on slower phone CPUs. Debounced here: the visible editing (autoSize, empty-
// state handling) still happens instantly via richtext.js's own 'input' listener, only the
// actual write is delayed until typing pauses. Flushed immediately on tab-hide/navigate-away
// so a debounce in flight never silently loses the last few characters typed.
let journalSaveTimer = null;
function flushJournalSave() {
  if (journalSaveTimer) { clearTimeout(journalSaveTimer); journalSaveTimer = null; }
  Data.upsertJournalEntry(todayStr(), journalEditor.getHtml());
}
const journalEditor = initRichTextEditor(
  document.getElementById('journalTextarea'),
  document.getElementById('journalToolbar'),
  {
    capPx: 260,
    expandStorageKey: 'mm_journalExpanded',
    expandBtnEl: document.getElementById('journalExpandBtn'),
    onInput: () => {
      if (journalSaveTimer) clearTimeout(journalSaveTimer);
      journalSaveTimer = setTimeout(flushJournalSave, 400);
    }
  }
);
window.addEventListener('pagehide', () => { if (journalSaveTimer) flushJournalSave(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && journalSaveTimer) flushJournalSave(); });
function loadJournalToday() {
  const entry = Data.getJournalEntry(todayStr());
  journalEditor.setHtml(entry ? normalizeStoredHtml(entry.text) : '');
}

// ================= future note + side rail (reuse sidebar's icon set) =================
function renderFutureNote() {
  document.getElementById('futureNote').innerHTML = `
    <span class="fn-label">Coming later</span>
    <span class="fn-item">${NAV_ICON.canvas} Canvas</span>
  `;
}
function renderSideRail() {
  document.getElementById('sideRail').innerHTML = `
    <a href="#models" title="Mental Models">${NAV_ICON.models}</a>
    <a href="#daylist" title="Day List">${NAV_ICON.today}</a>
    <a href="#habits" title="Habit">${NAV_ICON.habits}</a>
    <a href="#notes" title="Notes">${NAV_ICON.notes}</a>
  `;
}

// ---------- init ----------
Data.ensureSeriesTopUp();
document.getElementById('todayLongDate').textContent = formatLongDate(todayStr());
renderHomeModels();
renderDayNav();
updateModeTabsUI();
applyTasksCollapse();
applyChronoCollapse();
wireDragReorder(document.getElementById('dayEntriesContainer'));
refreshDay();
scrollGridToAnchor(); // initial load: scroll to current time (today) or 7am (other dates) — only here and on date-nav clicks
// on a real cold load/refresh (not the in-app date-nav clicks, which already worked fine) the
// assignment above sometimes got silently overridden a moment later — by the browser's own
// scroll-position memory for the element on reload, or by a late web-font swap reflowing the
// page — landing the Timeline back at the top. Re-apply once after layout settles and once
// more after everything (fonts/images) has fully loaded, so our value is the one that sticks.
requestAnimationFrame(() => requestAnimationFrame(scrollGridToAnchor));
window.addEventListener('load', scrollGridToAnchor, { once: true });
wireDurUnit('entryDurValue', 'entryDurUnit');
wireDurUnit('modalDurValue', 'modalDurUnit');
entryColorCtrl = buildTaskColorPicker(document.getElementById('entryColorPicker'), TASK_COLORS[0]);
modalColorCtrl = buildTaskColorPicker(document.getElementById('modalColorPicker'), TASK_COLORS[0]);
entryAmpmCtrl = wireAmpmToggle('entryTime', 'entryAmpmToggle');
modalAmpmCtrl = wireAmpmToggle('modalTime', 'modalAmpmToggle');
// Real bug found: "deleted habit still showing, only clicking Select makes it go away" — this is
// the browser's back-forward cache (bfcache). Navigating to another page (e.g. deleting a habit
// on the Habits page) and then back to Today doesn't always re-run this script at all; mobile
// Safari especially likes to restore a *frozen snapshot* of the page exactly as it looked when
// you left, DOM included, instead of reloading it — so the list you see is whatever it was
// before the delete, until something (like clicking Select, which calls renderHabitToday() itself)
// forces a fresh re-render against current data. The fix is the standard one for this: listen for
// `pageshow` and check `event.persisted`, which is specifically true when the page came back from
// bfcache rather than a real load, and re-run every render that depends on localStorage data.
window.addEventListener('pageshow', (event) => {
  if (!event.persisted) return;
  refreshDay();
  renderHabitToday();
  renderHabitDayNav();
  renderDayNav();
  renderHomeModels();
  renderCalLegend();
  if (document.getElementById('habitCalendarView').style.display !== 'none') renderCalendar();
});
document.querySelectorAll('#listModeTabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    dayListMode = btn.dataset.mode;
    localStorage.setItem('mm_dayListMode', dayListMode);
    updateModeTabsUI();
    renderDayEntries();
  });
});
document.getElementById('tasksCollapseBtn').addEventListener('click', () => {
  tasksCollapsed = !tasksCollapsed;
  localStorage.setItem('mm_tasksCollapsed', tasksCollapsed ? '1' : '0');
  applyTasksCollapse();
});
document.getElementById('chronoCollapseBtn').addEventListener('click', () => {
  chronoCollapsed = !chronoCollapsed;
  localStorage.setItem('mm_chronoCollapsed', chronoCollapsed ? '1' : '0');
  applyChronoCollapse();
  // setting scrollTop while the Timeline is display:none is a no-op in every browser — it has
  // no scrollable layout at all while hidden. That's why a cold load with Timeline collapsed
  // (persisted from last time) always landed at 12AM/1AM the moment you opened it: the earlier
  // scroll attempt on page load had nothing to act on. Re-apply now that it's actually visible.
  if (!chronoCollapsed) scrollGridToAnchor();
});
document.getElementById('clearPrioritiesBtn').addEventListener('click', async () => {
  if (!await SignalConfirm('Clear the priority number from every task on this day?', { okLabel: 'Clear' })) return;
  Data.clearAllPriorities(currentDate);
  renderDayEntries();
});
document.getElementById('deleteUnprioritizedBtn').addEventListener('click', async () => {
  const count = Data.getDayEntries().filter(e => e.date === currentDate && e.priority == null).length;
  if (count === 0) return;
  if (!await SignalConfirm(`Delete all ${count} task(s) without a priority number on this day? This can't be undone (unless you restore a backup).`, { okLabel: 'Delete', danger: true })) return;
  Data.deleteAllUnprioritized(currentDate);
  refreshDay();
});
addHabitColorCtrl = buildColorPicker(document.getElementById('habitColorPicker'), Data.colorForIndex(Data.getHabits().length), () => {});
wireEmojiPicker(document.getElementById('habitIconHintBtn'), document.getElementById('habitIcon'), document.getElementById('habitIconPopup'));
renderHabitDayNav();
renderHabitToday();
wireHabitDragReorder(document.getElementById('habitTodayList'));
renderCalLegend();
loadJournalToday();
renderFutureNote();
renderSideRail();

// ---------- first-load splash (tap-to-begin) ----------
// Previously auto-attempted audio.play() on load and only fell back to waiting for a click if
// that was blocked. On desktop Chrome that auto-attempt often quietly succeeds (Media Engagement
// Index / a manually-granted site permission), which is why this felt solid there — but mobile
// browsers block unprompted audio far more consistently, with no equivalent "trust this site"
// state to build up (confirmed: iOS Safari in particular has no such setting or heuristic at
// all), so on phone the auto-attempt reliably failed and fell back to whatever the visitor
// happened to click first — which is what made this feel randomly delayed/silent on mobile.
// Fix: don't attempt play() at all until there's a real tap. The splash now waits at "Signal."
// (overlay blocks all other clicks anyway, so this can't be skipped by clicking something else)
// for an explicit click/touch/Enter/Space, and that same gesture both starts the audio — a
// genuine, always-reliable trigger, no blocked-autoplay case left to fall back from — and kicks
// off the fade. This also fixes the separate "BGM plays at the same time as startup" bug: BGM
// used to start unconditionally the instant the fade finished, regardless of whether the startup
// sound had actually played yet or was still stuck in its retry-on-next-click fallback; now both
// are only ever reachable after the same single tap, in a fixed order.
(function runSplash() {
  const overlay = document.getElementById('splashOverlay');
  if (!overlay || sessionStorage.getItem('mm_splashDone')) { if (overlay) overlay.remove(); return; }
  sessionStorage.setItem('mm_splashDone', '1');

  const audio = document.getElementById('splashAudio');
  let begun = false;

  function begin() {
    if (begun) return;
    begun = true;
    overlay.removeEventListener('click', begin);
    overlay.removeEventListener('touchstart', begin);
    overlay.removeEventListener('keydown', onKey);

    // BGM must wait for BOTH the fade-out to finish AND the startup sfx to (almost) finish
    // playing — not just one or the other. The startup sound (~3.2s) runs longer than the fade
    // (~1.5s), so tying BGM only to the fade (the old bug) started it well before the sfx ended.
    // BGM is cued slightly before the sfx's literal last frame (not exactly on 'ended') so the
    // handoff feels continuous rather than leaving a beat of silence in between.
    const BGM_LEAD_SEC = 0.7;
    let sfxDone = !(audio && typeof audio.play === 'function'); // no audio element → don't block on it
    let fadeDone = false;
    function maybeStartBgm() {
      if (sfxDone && fadeDone && window.SignalBgm) window.SignalBgm.startFresh();
    }

    if (!sfxDone) {
      audio.volume = 0.9;
      audio.currentTime = 0;
      const fireEarly = () => {
        if (sfxDone) return;
        if (audio.duration && audio.currentTime >= audio.duration - BGM_LEAD_SEC) {
          sfxDone = true;
          audio.removeEventListener('timeupdate', fireEarly);
          maybeStartBgm();
        }
      };
      audio.addEventListener('timeupdate', fireEarly);
      audio.addEventListener('ended', () => { sfxDone = true; maybeStartBgm(); }, { once: true }); // fallback in case timeupdate's granularity ever misses the early window
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        // this is a genuine same-gesture play() call, so a rejection here means something else
        // is wrong, not the usual autoplay block — don't let BGM wait forever on it either way
        p.catch(() => { sfxDone = true; maybeStartBgm(); });
      }
    }

    // a quarter-second hold before the fade starts, so the visual doesn't outrun the audio —
    // play() needs a brief moment to actually start producing sound
    setTimeout(() => { overlay.classList.add('splash-fade'); }, 250);
    overlay.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'opacity') return; // fires once for opacity, once for filter — only act once
      overlay.remove();
      fadeDone = true;
      maybeStartBgm();
    }, { once: true });
  }
  function onKey(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); begin(); } }

  overlay.tabIndex = 0;
  overlay.addEventListener('click', begin);
  overlay.addEventListener('touchstart', begin, { passive: true });
  overlay.addEventListener('keydown', onKey);
  overlay.focus({ preventScroll: true });
})();
