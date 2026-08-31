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

function friendlyDate(dateStr) {
  const d = parseDateStr(dateStr);
  const today = todayStr();
  const y = addDays(today, -1), t = addDays(today, 1);
  let prefix = '';
  if (dateStr === today) prefix = 'Today · ';
  else if (dateStr === y) prefix = 'Yesterday · ';
  else if (dateStr === t) prefix = 'Tomorrow · ';
  return prefix + DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
}

function buildColorPicker(container, initialColor, onChange) {
  let selected = initialColor;
  function draw() {
    container.innerHTML = '';
    Data.HABIT_COLOR_PALETTE.forEach(c => {
      const sw = document.createElement('div');
      sw.className = 'color-swatch' + (c === selected ? ' selected' : '');
      sw.style.background = c;
      sw.addEventListener('click', () => { selected = c; draw(); onChange(selected); });
      container.appendChild(sw);
    });
    const custom = document.createElement('input');
    custom.type = 'color';
    custom.className = 'color-native';
    custom.value = selected.startsWith('#') ? selected : '#D4A24C';
    custom.title = 'Custom color';
    custom.addEventListener('input', () => { selected = custom.value; onChange(selected); draw(); });
    container.appendChild(custom);
  }
  draw();
  return { get: () => selected, set: (c) => { selected = c; draw(); } };
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

function init() {
  document.title = 'Signal — ' + habit.name;
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

  document.getElementById('deleteHabitBtn').addEventListener('click', () => {
    if (confirm(`Delete "${habit.name}" and all its history? This can't be undone (unless you restore a backup).`)) {
      Data.deleteHabit(habit.id);
      location.href = 'habits.html';
    }
  });
  const archiveBtn = document.getElementById('archiveHabitBtn');
  archiveBtn.textContent = habit.archived ? 'Restore from archive' : 'Move to archive';
  archiveBtn.addEventListener('click', () => {
    if (habit.archived) {
      Data.updateHabit(habit.id, { archived: false });
      location.reload();
      return;
    }
    if (confirm(`Move "${habit.name}" to archive? It'll disappear from Today and All Habits, but its history is kept — nothing is deleted.`)) {
      Data.updateHabit(habit.id, { archived: true });
      location.href = 'habits.html';
    }
  });
}

function renderHero() {
  const stats = Data.getHabitStats(habit.id);
  document.getElementById('habitHero').innerHTML = `
    <div class="badge" style="background:${habit.color}22;border-color:${habit.color};">${escapeHtml(habit.icon || '●')}</div>
    <div>
      <h1>${escapeHtml(habit.name)}</h1>
      <div class="stats">${stats.daysDone} day${stats.daysDone === 1 ? '' : 's'} done${stats.streak ? ' · ' + stats.streak + '-day streak' : ''}${stats.totalMin ? ' · ' + minutesLabel(stats.totalMin) + ' total' : ''}${stats.firstDate ? ' · since ' + ddmmyyyy(stats.firstDate) : ''}</div>
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
}
function refreshLogRow() {
  document.getElementById('hCurrentDateLabel').textContent = friendlyDate(logDate);
  const nextBtn = document.getElementById('hNext');
  const atToday = logDate >= todayStr();
  nextBtn.disabled = atToday;
  nextBtn.classList.toggle('next-disabled', atToday);

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
    if (!isFuture) cell.addEventListener('click', () => { calSelectedDate = dateStr; renderMonth(); openDayDetailModal(dateStr); });
    grid.appendChild(cell);
  }
}
function wireMonthNav() {
  document.getElementById('mCalPrev').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() - 1); renderMonth(); });
  document.getElementById('mCalNext').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() + 1); renderMonth(); });
}

// ---------- year heatmap (this habit only) ----------
function renderYear() {
  document.getElementById('yLabel').textContent = yearVal;
  const logs = Data.getHabitLogs().filter(l => l.habitId === habit.id);
  const byDate = new Map(logs.map(l => [l.date, l]));

  const startDate = new Date(yearVal, 0, 1);
  const firstDow = startDate.getDay();
  const totalDays = (yearVal % 4 === 0 && (yearVal % 100 !== 0 || yearVal % 400 === 0)) ? 366 : 365;
  const totalWeeks = Math.ceil((firstDow + totalDays) / 7);
  const todayD = todayStr();

  const weekMonth = [];
  for (let w = 0; w < totalWeeks; w++) {
    let m = null;
    for (let d = 0; d < 7; d++) {
      const off = w * 7 + d - firstDow;
      if (off >= 0 && off < totalDays) { m = new Date(yearVal, 0, 1 + off).getMonth(); break; }
    }
    weekMonth.push(m);
  }

  const gridEl = document.getElementById('yGrid');
  const monthsEl = document.getElementById('yMonths');
  const hoverLabel = document.getElementById('yHoverLabel');
  gridEl.innerHTML = ''; monthsEl.innerHTML = '';
  hoverLabel.innerHTML = 'Hover or click a day';
  let lastLabeled = -1;

  for (let w = 0; w < totalWeeks; w++) {
    const col = document.createElement('div');
    col.className = 'year-week';
    for (let d = 0; d < 7; d++) {
      const off = w * 7 + d - firstDow;
      const cell = document.createElement('div');
      if (off < 0 || off >= totalDays) {
        cell.className = 'year-day';
        cell.style.visibility = 'hidden';
      } else {
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
        cell.addEventListener('mouseenter', () => {
          hoverLabel.innerHTML = `<span class="ymd">${ddmmyyyy(dateStr)}</span>${isDone ? ' · done' : ''}${hasNote ? ' · has a note' : ''}<a data-date="${dateStr}">view in month →</a>`;
          hoverLabel.querySelector('a').addEventListener('click', (e) => { e.stopPropagation(); jumpToMonth(dateStr); });
        });
        if (!isFuture) cell.addEventListener('click', () => openDayDetailModal(dateStr));
      }
      col.appendChild(cell);
    }
    gridEl.appendChild(col);

    const label = document.createElement('span');
    label.style.width = '11px';
    label.style.fontSize = '9px';
    if (weekMonth[w] !== null && weekMonth[w] !== lastLabeled) {
      label.textContent = MONTHS_SHORT[weekMonth[w]];
      lastLabeled = weekMonth[w];
    }
    monthsEl.appendChild(label);
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
      <span class="sr-date">${ddmmyyyy(l.date)}</span>
      <span class="sr-text">${l.done ? '✓ done' : 'noted'}<span class="lf-metric-slot"></span>${l.note ? ' — ' + escapeHtml(l.note) : ''}</span>
      <span class="sr-meta">${minutesLabel(l.durationMin)}</span>
    `;
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
