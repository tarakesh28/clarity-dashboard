/* ============================================================
   habit-detail.js — logic for habit.html?id=<habitId>
   ============================================================ */

function pad(n) { return String(n).padStart(2, '0'); }
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function minutesLabel(min) {
  if (!min) return '';
  if (min < 60) return min + 'm';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function parseDateStr(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(dateStr, delta) { const d = parseDateStr(dateStr); d.setDate(d.getDate() + delta); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function ddmmyyyy(dateStr) { const [y, m, d] = dateStr.split('-'); return `${d}-${m}-${y}`; }
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = MONTHS.map(m => m.slice(0, 3));

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
  // Real bug found (also happening on desktop): calling draw() here used to wipe and rebuild
  // the whole container — including this very <input type=color> node — on every 'input' event,
  // which a native color panel fires continuously while still being dragged, not just once on
  // release. Recreating the input mid-drag destroyed the exact element the browser's color panel
  // was anchored to, closing it instantly. Now 'input' only updates state and toggles a class on
  // the existing swatches — nothing is torn down while the picker is open.
  custom.addEventListener('input', () => { selected = custom.value; syncSelected(); onChange(selected); });
  container.appendChild(custom);
  function syncSelected() { swatches.forEach(({ el, color }) => el.classList.toggle('selected', color === selected)); }
  syncSelected();
  return {
    get: () => selected,
    set: (c) => { selected = c; if (c && c.startsWith('#')) custom.value = c; syncSelected(); }
  };
}

// Shared metric-display control: shows the day's metric (or the habit's default) as plain
// text. If that day already has a log, clicking turns it into an inline editor that saves
// ONLY that day (never touches the habit's default). If the day isn't logged yet, clicking
// hands off to whatever the caller wants to do about the *default* (usually: open habit edit).
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

// ---------- page ----------
const params = new URLSearchParams(location.search);
const habitId = params.get('id');
let habit = Data.getHabit(habitId);
let colorCtrl;
let calMonth = new Date(); calMonth.setDate(1);
let calSelectedDate = null;
let yearVal = new Date().getFullYear();
let logDate = todayStr(); // day being logged in the day-nav row — can go backward, never forward of today
const LOG_FEED_PAGE_SIZE = 15;
let logFeedVisibleCount = LOG_FEED_PAGE_SIZE;

// back button: prefer real browser history (so it returns to wherever you actually came
// from — Today page or the All Habits list) and only fall back if there's no history to use.
document.getElementById('backBtn').addEventListener('click', () => {
  if (window.history.length > 1) window.history.back();
  else location.href = 'habits.html';
});

if (!habit || habit.deleted) {
  document.querySelector('.main').innerHTML = '<p class="page-desc">Habit not found — it may have been deleted. <a href="habits.html" style="color:var(--gold)">Back to All Habits →</a></p>';
} else {
  init();
}

function byOrder(a, b) { return (a.order ?? a.createdAt) - (b.order ?? b.createdAt); }

function wirePrevNextHabit() {
  const list = Data.getHabits().filter(h => !h.deleted).sort(byOrder);
  const idx = list.findIndex(h => h.id === habit.id);
  const row = document.getElementById('habitPrevNextRow');
  if (idx === -1 || list.length <= 1) { row.style.display = 'none'; return; }
  document.getElementById('prevHabitBtn').addEventListener('click', () => {
    location.href = 'habit.html?id=' + list[(idx - 1 + list.length) % list.length].id;
  });
  document.getElementById('nextHabitBtn').addEventListener('click', () => {
    location.href = 'habit.html?id=' + list[(idx + 1) % list.length].id;
  });
}

function init() {
  document.title = 'Signal — ' + habit.name;
  document.getElementById('habitStickyName').textContent = (habit.icon ? habit.icon + ' ' : '') + habit.name;
  wirePrevNextHabit();
  renderHero();
  colorCtrl = buildColorPicker(document.getElementById('editColorPicker'), habit.color, () => {});
  wireEmojiPicker(document.getElementById('editIconHintBtn'), document.getElementById('editIcon'), document.getElementById('editIconPopup'));
  wireEdit();
  wireLogDayNav();
  refreshLogRow();
  document.getElementById('detailToggle').addEventListener('click', () => {
    Data.toggleHabitDone(habit.id, logDate);
    refreshLogRow(); renderHero(); renderMonth(); renderLogFeed();
  });
  document.getElementById('detailNoteInput').addEventListener('change', (e) => {
    Data.upsertHabitLog(habit.id, logDate, { note: e.target.value });
    renderLogFeed();
  });
  wireTabs();
  wireMonthNav();
  wireYearNav();
  wireDayDetailModal();
  renderMonth();
  renderLogFeed();

  if (params.get('editMetric') === '1') {
    openEditFocusMetric();
    history.replaceState(null, '', location.pathname + '?id=' + habit.id);
  }

  document.getElementById('deleteHabitBtn').addEventListener('click', async () => {
    if (await SignalConfirm(`Delete "${habit.name}" and all its history? This can't be undone (unless you restore a backup).`, { okLabel: 'Delete', danger: true })) {
      Data.deleteHabit(habit.id);
      location.href = 'habits.html';
    }
  });
  const archiveBtn = document.getElementById('archiveHabitBtn');
  archiveBtn.textContent = habit.archived ? 'Restore from archive' : 'Move to archive';
  archiveBtn.addEventListener('click', async () => {
    if (habit.archived) {
      Data.updateHabit(habit.id, { archived: false });
      location.reload();
      return;
    }
    if (await SignalConfirm(`Move "${habit.name}" to archive? It'll disappear from Today and All Habits, but its history is kept — nothing is deleted.`, { okLabel: 'Archive' })) {
      Data.updateHabit(habit.id, { archived: true });
      location.href = 'habits.html';
    }
  });
}

function renderHero() {
  const stats = Data.getHabitStats(habit.id);
  // Each stat ("5 days done", "12-day streak", "since 05-09-2025"...) is wrapped in its own
  // nowrap span, joined by a plain (breakable) " · " — on mobile, where the full line doesn't
  // always fit, this makes sure a wrap lands between stat points (at the separator) rather than
  // splitting one apart mid-phrase (e.g. "since" stranded on one line, its date pushed to the
  // next) — see the matching mobile CSS for .stat-point.
  const parts = [`${stats.daysDone} day${stats.daysDone === 1 ? '' : 's'} done`];
  if (stats.streak) parts.push(`${stats.streak}-day streak`);
  if (stats.totalMin) parts.push(`${minutesLabel(stats.totalMin)} total`);
  if (stats.firstDate) parts.push(`since ${ddmmyyyy(stats.firstDate)}`);
  const statsHtml = parts.map(p => `<span class="stat-point">${p}</span>`).join(' · ');
  document.getElementById('habitHero').innerHTML = `
    <div class="badge" style="background:${habit.color}22;border-color:${habit.color};">${escapeHtml(habit.icon || '●')}</div>
    <div class="habit-hero-text">
      <h1>${escapeHtml(habit.name)}</h1>
      <div class="stats">${statsHtml}</div>
    </div>
  `;
}

// ---------- backward-only day nav for logging ----------
function wireLogDayNav() {
  document.getElementById('hPrev').addEventListener('click', () => { logDate = addDays(logDate, -1); refreshLogRow(); });
  document.getElementById('hNext').addEventListener('click', () => {
    if (logDate >= todayStr()) return;
    logDate = addDays(logDate, 1);
    refreshLogRow();
  });
  document.getElementById('hToday').addEventListener('click', () => { logDate = todayStr(); refreshLogRow(); });
  document.getElementById('hOpenBtn').addEventListener('click', () => {
    const picker = document.getElementById('hOpenPicker');
    picker.value = logDate;
    // Real root cause of "never worked on iPhone" tracked down this round — it's an open,
    // unresolved WebKit bug (bugs.webkit.org/show_bug.cgi?id=261703), not a bug in this code:
    // showPicker() for date inputs simply isn't implemented on iOS Safari at all — it silently
    // no-ops instead of throwing, so the try/catch below never used to fall through to .click()
    // there. Same fix as app.js's openDatePicker, inlined here since this is a separate file/page.
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (!isIOS && typeof picker.showPicker === 'function') {
      try { picker.showPicker(); return; } catch (err) { /* fall through to .click() below */ }
    }
    picker.click();
  });
  document.getElementById('hOpenPicker').addEventListener('change', (e) => {
    if (!e.target.value) return;
    logDate = e.target.value > todayStr() ? todayStr() : e.target.value;
    refreshLogRow();
  });
}
function refreshLogRow() {
  // abbreviateOnMobile: true — matches the same Yesterday→Yest / Tomorrow→Tom treatment already
  // applied to the Today page's Day List and Habit Tracker date-nav labels (see app.js's own
  // friendlyDate); the day-detail modal's heading below keeps the full word, same as those.
  document.getElementById('hCurrentDateLabel').textContent = friendlyDate(logDate, true);
  const nextBtn = document.getElementById('hNext');
  const atToday = logDate >= todayStr();
  nextBtn.disabled = atToday;
  nextBtn.classList.toggle('next-disabled', atToday);
  document.getElementById('hOpenPicker').max = todayStr(); // set here, not in the click handler
  // below — see the matching change on the Today page's habit day-nav for why
  // Kept in step with logDate on every render, same reasoning as app.js's renderDayNav()/
  // renderHabitDayNav() — a real tap now lands directly on this input (see .open-day-picker in
  // styles.css), bypassing the click handler that used to be the only place .value got set.
  document.getElementById('hOpenPicker').value = logDate;

  const log = Data.getHabitLog(habit.id, logDate);
  const toggle = document.getElementById('detailToggle');
  const noteInput = document.getElementById('detailNoteInput');
  const done = !!(log && log.done);
  toggle.style.background = done ? habit.color : 'transparent';
  toggle.style.borderColor = habit.color;
  toggle.textContent = done ? '✓' : '';
  noteInput.value = (log && log.note) || '';
  renderMetricCell(document.getElementById('detailMetricCell'), {
    habitId: habit.id,
    date: logDate,
    habit,
    getLog: () => Data.getHabitLog(habit.id, logDate),
    onSingleDaySaved: renderLogFeed,
    onDefaultEditRequested: openEditFocusMetric
  });
}

// Opens the edit-habit form (if not already open) and puts focus on the default-metric
// field — used both by the day-nav row's "click metric to change the default" flow and by
// the ?editMetric=1 link the Today page sends people here with.
function openEditFocusMetric() {
  const form = document.getElementById('habitEditForm');
  document.getElementById('editName').value = habit.name;
  document.getElementById('editIcon').value = habit.icon || '';
  document.getElementById('editMetric').value = habit.metric || '';
  colorCtrl.set(habit.color);
  form.style.display = 'flex';
  document.getElementById('editToggleBtn').style.display = 'none';
  const metricInput = document.getElementById('editMetric');
  if (typeof metricInput.scrollIntoView === 'function') metricInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => { metricInput.focus(); metricInput.select(); }, 150);
}

function closeEditForm() {
  document.getElementById('habitEditForm').style.display = 'none';
  document.getElementById('editToggleBtn').style.display = '';
}
function wireEdit() {
  document.getElementById('editToggleBtn').addEventListener('click', () => {
    const form = document.getElementById('habitEditForm');
    document.getElementById('editName').value = habit.name;
    document.getElementById('editIcon').value = habit.icon || '';
    document.getElementById('editMetric').value = habit.metric || '';
    colorCtrl.set(habit.color);
    form.style.display = 'flex';
    // the toggle button hides while the form (with its own Cancel/Save) is open — no need
    // for two ways to close it on screen at once
    document.getElementById('editToggleBtn').style.display = 'none';
    const nameInput = document.getElementById('editName');
    if (typeof nameInput.scrollIntoView === 'function') nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.getElementById('editCancelBtn').addEventListener('click', closeEditForm);
  document.getElementById('editSaveBtn').addEventListener('click', () => {
    const name = document.getElementById('editName').value.trim();
    if (!name) { alert("Name can't be empty."); return; }
    const icon = document.getElementById('editIcon').value.trim();
    const metric = document.getElementById('editMetric').value.trim();
    const color = colorCtrl.get();
    Data.updateHabit(habit.id, { name, icon, color, metric });
    habit = Data.getHabit(habit.id);
    closeEditForm();
    renderHero(); refreshLogRow(); renderMonth(); renderLogFeed();
    if (document.getElementById('yearView').style.display !== 'none') renderYear();
  });
}

function wireTabs() {
  document.getElementById('tabMonth').addEventListener('click', () => {
    document.getElementById('tabMonth').classList.add('active');
    document.getElementById('tabYear').classList.remove('active');
    document.getElementById('monthView').style.display = '';
    document.getElementById('yearView').style.display = 'none';
  });
  document.getElementById('tabYear').addEventListener('click', () => {
    document.getElementById('tabYear').classList.add('active');
    document.getElementById('tabMonth').classList.remove('active');
    document.getElementById('yearView').style.display = '';
    document.getElementById('monthView').style.display = 'none';
    renderYear();
  });
}

// ---------- day-detail modal (opened from a month or year click) ----------
// Nothing here touches storage until "Save" is clicked. Cancel — or clicking outside the
// modal — throws the draft away and leaves the original done/metric/note exactly as they were.
let ddDate = null;
let ddOriginal = null;
let ddDraft = null;

function openDayDetailModal(dateStr) {
  ddDate = dateStr;
  const log = Data.getHabitLog(habit.id, dateStr);
  ddOriginal = { done: !!(log && log.done), metric: (log && log.metric) || habit.metric || '', note: (log && log.note) || '', logged: !!log };
  ddDraft = Object.assign({}, ddOriginal);
  document.getElementById('dayDetailTitle').textContent = ddmmyyyy(dateStr) + ' — ' + friendlyDate(dateStr);
  renderDayDetailDraft();
  document.getElementById('dayDetailOverlay').style.display = 'flex';
}
function renderDayDetailDraft() {
  const toggle = document.getElementById('ddToggle');
  toggle.style.background = ddDraft.done ? habit.color : 'transparent';
  toggle.style.borderColor = habit.color;
  toggle.textContent = ddDraft.done ? '✓' : '';
  document.getElementById('ddToggleLabel').textContent = ddDraft.done ? 'Done' : 'Not done';
  const metricInput = document.getElementById('ddMetric');
  const canEditMetric = ddDraft.done || ddDraft.logged;
  metricInput.value = ddDraft.metric;
  metricInput.disabled = !canEditMetric;
  document.getElementById('ddMetricHint').textContent = canEditMetric ? '' : 'Mark this day done to set a metric just for it.';
  document.getElementById('ddNote').value = ddDraft.note;
  document.getElementById('ddNote').style.height = ''; // clear any manual drag-resize left over
  // from a previous day — this modal is one reused DOM node for every day clicked, so a resize
  // handle drag sets an inline height on that same node that would otherwise silently carry over
  // to the next day's note too, unrelated to how long that day's note actually is
}
function closeDayDetailModal() {
  document.getElementById('dayDetailOverlay').style.display = 'none';
  ddDate = null; ddOriginal = null; ddDraft = null;
}
function saveDayDetailModal() {
  if (!ddDate) return;
  Data.upsertHabitLog(habit.id, ddDate, { done: ddDraft.done, metric: ddDraft.metric, note: ddDraft.note });
  renderHero(); renderMonth(); renderLogFeed();
  if (ddDate === logDate) refreshLogRow();
  if (document.getElementById('yearView').style.display !== 'none') renderYear();
  closeDayDetailModal();
}
function wireDayDetailModal() {
  document.getElementById('ddToggle').addEventListener('click', () => {
    ddDraft.done = !ddDraft.done;
    if (ddDraft.done) ddDraft.logged = true;
    renderDayDetailDraft();
  });
  document.getElementById('ddMetric').addEventListener('input', (e) => { ddDraft.metric = e.target.value; });
  document.getElementById('ddNote').addEventListener('input', (e) => { ddDraft.note = e.target.value; });
  document.getElementById('ddSaveBtn').addEventListener('click', saveDayDetailModal);
  document.getElementById('ddCancelBtn').addEventListener('click', closeDayDetailModal);
  document.getElementById('dayDetailOverlay').addEventListener('click', (e) => { if (e.target.id === 'dayDetailOverlay') closeDayDetailModal(); });
}

// ---------- month view (this habit only) — prominent color block + note dot ----------
function renderMonth() {
  document.getElementById('mCalLabel').textContent = MONTHS[calMonth.getMonth()] + ' ' + calMonth.getFullYear();
  const grid = document.getElementById('mCalGrid');
  grid.innerHTML = '';
  DOW.forEach(d => { const el = document.createElement('div'); el.className = 'cal-dow'; el.textContent = d[0]; grid.appendChild(el); });

  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const logs = Data.getHabitLogs().filter(l => l.habitId === habit.id);
  const today = todayStr();
  const isFutureMonth = year > Number(today.slice(0, 4)) || (year === Number(today.slice(0, 4)) && month > Number(today.slice(5, 7)) - 1);
  const isCurrentOrFutureMonth = isFutureMonth || (year === Number(today.slice(0, 4)) && month === Number(today.slice(5, 7)) - 1);
  const mCalNextBtn = document.getElementById('mCalNext');
  mCalNextBtn.disabled = isCurrentOrFutureMonth;
  mCalNextBtn.classList.toggle('next-disabled', isCurrentOrFutureMonth);

  for (let i = 0; i < firstDow; i++) { const el = document.createElement('div'); el.className = 'cal-cell empty'; grid.appendChild(el); }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = year + '-' + pad(month + 1) + '-' + pad(day);
    const log = logs.find(l => l.date === dateStr);
    const done = !!(log && log.done);
    const hasNote = !!(log && log.note && log.note.trim());
    const isFuture = dateStr > today;
    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (dateStr === today ? ' today' : '') + (dateStr === calSelectedDate ? ' selected' : '') + (isFuture ? ' future' : '');
    cell.style.setProperty('--habit-color', habit.color);
    cell.innerHTML = `<span class="cal-daynum">${day}</span><div class="cal-mark${done ? ' done' : ''}">${hasNote ? '<span class="note-dot" title="Has a note"></span>' : ''}</div>`;
    if (!isFuture) cell.addEventListener('click', () => {
      calSelectedDate = dateStr;
      logDate = dateStr; // clicking a calendar day now also moves the day-nav row to that date
      refreshLogRow();
      renderMonth();
      openDayDetailModal(dateStr);
    });
    grid.appendChild(cell);
  }
}
function wireMonthNav() {
  document.getElementById('mCalPrev').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() - 1); renderMonth(); });
  document.getElementById('mCalNext').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() + 1); renderMonth(); });
}

// ---------- year heatmap (this habit only) ----------
// Mobile: rotated to weeks-as-rows (stacked top-to-bottom, days left-to-right within each row)
// instead of desktop's weeks-as-columns (53 columns marching across the year) — that column
// layout is exactly what forced the horizontal overflow/scrolling reported repeatedly in
// portrait. Rotating fits a phone's width with no scrolling needed at all; the desktop layout
// is untouched. Checked once per render via the same 760px breakpoint the rest of the CSS uses
// (not a live-resize listener — matches the same one-time-at-render-time pattern already used
// for BGM's mobile volume), so switching a tab/year while already in the view re-checks it too.
function renderYear() {
  document.getElementById('yLabel').textContent = yearVal;
  const atCurrentOrFutureYear = yearVal >= new Date().getFullYear();
  const yNextBtn = document.getElementById('yNext');
  yNextBtn.disabled = atCurrentOrFutureYear;
  yNextBtn.classList.toggle('next-disabled', atCurrentOrFutureYear);
  const logs = Data.getHabitLogs().filter(l => l.habitId === habit.id);
  const byDate = new Map(logs.map(l => [l.date, l]));

  const startDate = new Date(yearVal, 0, 1);
  const firstDow = startDate.getDay();
  const totalDays = (yearVal % 4 === 0 && (yearVal % 100 !== 0 || yearVal % 400 === 0)) ? 366 : 365;
  const totalWeeks = Math.ceil((firstDow + totalDays) / 7);
  const todayD = todayStr();

  const gridEl = document.getElementById('yGrid');
  const monthsEl = document.getElementById('yMonths');
  const hoverLabel = document.getElementById('yHoverLabel');
  gridEl.innerHTML = ''; monthsEl.innerHTML = '';

  const isVertical = window.matchMedia('(max-width: 760px)').matches;
  hoverLabel.innerHTML = isVertical ? 'Tap a day' : 'Hover or click a day';
  gridEl.classList.toggle('year-heatmap-vertical', isVertical);

  // One cell's worth of logic, shared by both orientations below so the desktop/mobile branches
  // can't quietly drift apart from each other over time.
  function buildDayCell(off) {
    const cell = document.createElement('div');
    if (off < 0 || off >= totalDays) {
      cell.className = 'year-day';
      cell.style.visibility = 'hidden';
      return cell;
    }
    const dt = new Date(yearVal, 0, 1 + off);
    const dateStr = dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
    const log = byDate.get(dateStr);
    const isDone = !!(log && log.done);
    const hasNote = !!(log && log.note && log.note.trim());
    const isFuture = dateStr > todayD;
    cell.className = 'year-day' + (isFuture ? ' future' : '');
    if (isDone) cell.style.background = habit.color;
    if (hasNote) cell.innerHTML = '<span class="yd-note"></span>';
    cell.title = ddmmyyyy(dateStr) + (isDone ? ' · done' : '');
    // mouseenter is desktop-only, deliberately — this is the actual root cause of the "needs two
    // taps to open on mobile" bug (cursor:pointer alone, tried last round, wasn't it). A
    // mouseenter/mouseover listener bound to an element is exactly what makes iOS Safari treat a
    // first tap as "enter hover state" and only fire the real click on a second tap — .cal-cell
    // elsewhere never had this problem because it only ever had a click handler, no hover one.
    // The hover label is pointless on a touch device anyway (nothing to hover before a tap), so
    // skipping it there removes the trap instead of working around it.
    if (!isVertical) cell.addEventListener('mouseenter', () => {
      hoverLabel.innerHTML = `<span class="ymd">${ddmmyyyy(dateStr)}</span>${isDone ? ' · done' : ''}${hasNote ? ' · has a note' : ''}<a data-date="${dateStr}">view in month →</a>`;
      hoverLabel.querySelector('a').addEventListener('click', (e) => { e.stopPropagation(); jumpToMonth(dateStr); });
    });
    if (!isFuture) cell.addEventListener('click', () => {
      logDate = dateStr; // same day-nav sync as the month calendar's own day click
      refreshLogRow();
      openDayDetailModal(dateStr);
    });
    return cell;
  }

  let lastLabeled = -1;
  for (let w = 0; w < totalWeeks; w++) {
    let m = null;
    for (let d = 0; d < 7; d++) {
      const off = w * 7 + d - firstDow;
      if (off >= 0 && off < totalDays) { m = new Date(yearVal, 0, 1 + off).getMonth(); break; }
    }

    if (isVertical) {
      const row = document.createElement('div');
      row.className = 'year-week-row';
      const label = document.createElement('span');
      label.className = 'year-row-month-label';
      if (m !== null && m !== lastLabeled) { label.textContent = MONTHS_SHORT[m]; lastLabeled = m; }
      row.appendChild(label);
      const daysWrap = document.createElement('div');
      daysWrap.className = 'year-week-days';
      for (let d = 0; d < 7; d++) daysWrap.appendChild(buildDayCell(w * 7 + d - firstDow));
      row.appendChild(daysWrap);
      gridEl.appendChild(row);
    } else {
      const col = document.createElement('div');
      col.className = 'year-week';
      for (let d = 0; d < 7; d++) col.appendChild(buildDayCell(w * 7 + d - firstDow));
      gridEl.appendChild(col);

      const label = document.createElement('span');
      label.style.width = '11px';
      label.style.fontSize = '9px';
      if (m !== null && m !== lastLabeled) { label.textContent = MONTHS_SHORT[m]; lastLabeled = m; }
      monthsEl.appendChild(label);
    }
  }
}
function jumpToMonth(dateStr) {
  const d = parseDateStr(dateStr);
  calMonth = new Date(d.getFullYear(), d.getMonth(), 1);
  calSelectedDate = dateStr;
  document.getElementById('tabMonth').click();
  renderMonth();
}
function wireYearNav() {
  document.getElementById('yPrev').addEventListener('click', () => { yearVal--; renderYear(); });
  document.getElementById('yNext').addEventListener('click', () => { yearVal++; renderYear(); });
}

// ---------- log feed ----------
// The metric shown per row is clickable — editing it here saves ONLY that day's log, never
// the habit's default (that's what habit-edit's "Default metric" field is for).
function renderLogFeed() {
  const logs = Data.getHabitLogs().filter(l => l.habitId === habit.id && (l.done || (l.note && l.note.trim()) || (l.metric && l.metric.trim())));
  logs.sort((a, b) => b.date.localeCompare(a.date));
  const box = document.getElementById('logFeed');
  box.innerHTML = '';
  if (logs.length === 0) { box.innerHTML = '<div class="empty-note">Nothing logged yet.</div>'; return; }
  const visible = logs.slice(0, logFeedVisibleCount);
  visible.forEach(l => {
    const row = document.createElement('div');
    row.className = 'search-row';
    row.innerHTML = `
      <button class="sr-date" type="button" data-date="${l.date}" title="Go to ${ddmmyyyy(l.date)}">${ddmmyyyy(l.date)}</button>
      <span class="sr-text">${l.done ? '✓ done' : 'noted'}<span class="lf-metric-slot"></span>${l.note ? ' — ' + escapeHtml(l.note) : ''}</span>
      <span class="sr-meta">${minutesLabel(l.durationMin)}</span>
    `;
    row.querySelector('.sr-date').addEventListener('click', () => {
      logDate = l.date; // same day-nav sync as the month/year calendar's own day-cell clicks
      refreshLogRow();
      renderMonth();
      openDayDetailModal(l.date);
    });
    if (l.metric && l.metric.trim()) {
      const slot = row.querySelector('.lf-metric-slot');
      slot.appendChild(document.createTextNode(' · '));
      const cellWrap = document.createElement('span');
      slot.appendChild(cellWrap);
      renderMetricCell(cellWrap, {
        habitId: habit.id,
        date: l.date,
        habit,
        getLog: () => Data.getHabitLog(habit.id, l.date),
        onSingleDaySaved: () => { if (l.date === logDate) refreshLogRow(); }
      });
    }
    box.appendChild(row);
  });
  const hasMore = logs.length > logFeedVisibleCount;
  const isExpanded = logFeedVisibleCount > LOG_FEED_PAGE_SIZE;
  if (hasMore || isExpanded) {
    const row = document.createElement('div');
    row.className = 'log-feed-buttons';
    if (hasMore) {
      const moreBtn = document.createElement('button');
      moreBtn.className = 'ghost-btn log-feed-more-btn';
      moreBtn.type = 'button';
      moreBtn.textContent = `Show more (${logs.length - logFeedVisibleCount} older)`;
      moreBtn.addEventListener('click', () => {
        logFeedVisibleCount += LOG_FEED_PAGE_SIZE;
        renderLogFeed();
      });
      row.appendChild(moreBtn);
    }
    if (isExpanded) {
      const lessBtn = document.createElement('button');
      lessBtn.className = 'ghost-btn log-feed-more-btn';
      lessBtn.type = 'button';
      lessBtn.textContent = 'Show less';
      lessBtn.addEventListener('click', () => {
        logFeedVisibleCount = LOG_FEED_PAGE_SIZE;
        renderLogFeed();
      });
      row.appendChild(lessBtn);
    }
    box.appendChild(row);
  }
}
