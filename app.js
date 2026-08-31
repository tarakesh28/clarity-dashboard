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
function formatLongDate(dateStr) {
  const d = parseDateStr(dateStr);
  return d.getDate() + ordinalSuffix(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

// ---------- shared widgets ----------
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
  function apply() { valInput.step = 1; valInput.min = 0; }
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
  document.getElementById('currentDateLabel').textContent = friendlyDate(currentDate);
}
function refreshDay() {
  // re-run the recurring-task top-up and rough-task rollover on every refresh (not just page
  // load) — closes the gap where a task could go missing after navigating around and only
  // reappear on an actual browser refresh.
  Data.ensureSeriesTopUp();
  Data.rolloverUnfinishedRoughTasks();
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
  document.getElementById('taskDateNavGroup').style.display = taskSelectMode ? 'none' : 'flex';
  document.getElementById('taskNavActions').style.display = taskSelectMode ? 'none' : 'flex';
  document.getElementById('taskMassBar').style.display = taskSelectMode ? 'flex' : 'none';
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
document.getElementById('taskMassDeleteBtn').addEventListener('click', () => {
  if (taskSelectedIds.size === 0) { alert('Select at least one task first.'); return; }
  if (!confirm(`Remove ${taskSelectedIds.size} task(s)? Ones picked from the Archive are just cleared from Archive — they still exist on their own day. Ones picked from today's list are fully deleted, same as their own × button.`)) return;
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
  row.querySelector('.entry-del-x').addEventListener('click', (ev) => {
    ev.stopPropagation();
    const warn = e.repeatDaily ? 'Delete this task? Only this day is removed — the rest of the repeat series is untouched.' : 'Delete this task?';
    if (confirm(warn)) { Data.deleteDayEntry(e.id); refreshDay(); }
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

  listEl.innerHTML = archived.map(e => `
    <div class="archive-row" data-id="${e.id}">
      <button class="entry-check" data-id="${e.id}" title="Mark done"></button>
      <span class="ar-date">${ddmmyyyyShort(e.date)}</span>
      <span class="ar-text">${escapeHtml(e.text)}</span>
      <button class="ar-restore" type="button" data-id="${e.id}">Restore to today</button>
      <button class="entry-del-x" title="Remove from Archive (it stays on its own day — delete it fully from there)">×</button>
    </div>
  `).join('');
  listEl.querySelectorAll('.entry-check').forEach(btn => {
    btn.addEventListener('click', () => { Data.updateDayEntry(btn.dataset.id, { done: true }); refreshDay(); });
  });
  listEl.querySelectorAll('.ar-restore').forEach(btn => {
    btn.addEventListener('click', () => { Data.restoreDayEntryToToday(btn.dataset.id); refreshDay(); });
  });
  listEl.querySelectorAll('.entry-del-x').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.archive-row');
      if (confirm("Remove this from Archive? It's not deleted — it still exists on its own day. To fully delete it, go to that day and delete it there.")) { Data.dismissDayEntryFromArchive(row.dataset.id); refreshDay(); }
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

document.getElementById('flowShortcutBtn').addEventListener('click', () => { window.location.href = 'flow.html'; });
document.getElementById('dayPrev').addEventListener('click', () => { if (taskSelectMode) exitTaskSelectMode(); currentDate = addDays(currentDate, -1); renderDayNav(); refreshDay(); scrollGridToAnchor(); });
document.getElementById('dayNext').addEventListener('click', () => { if (taskSelectMode) exitTaskSelectMode(); currentDate = addDays(currentDate, 1); renderDayNav(); refreshDay(); scrollGridToAnchor(); });
document.getElementById('dayToday').addEventListener('click', () => { if (taskSelectMode) exitTaskSelectMode(); currentDate = todayStr(); renderDayNav(); refreshDay(); scrollGridToAnchor(); });

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
document.getElementById('modalDelete').addEventListener('click', () => {
  if (!editingEntryId) return;
  const entry = Data.getDayEntries().find(e => e.id === editingEntryId);
  const warn = entry && entry.repeatDaily ? 'Delete this task? Only this day is removed — the rest of the repeat series is untouched.' : 'Delete this task?';
  if (confirm(warn)) { Data.deleteDayEntry(editingEntryId); closeEntryModal(); refreshDay(); }
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
  document.getElementById('habitDateLabel').textContent = friendlyDate(habitLogDate);
  const nextBtn = document.getElementById('habitNext');
  const atToday = habitLogDate >= todayStr();
  nextBtn.disabled = atToday;
  nextBtn.classList.toggle('next-disabled', atToday);
}
document.getElementById('habitPrev').addEventListener('click', () => { habitLogDate = addDays(habitLogDate, -1); renderHabitDayNav(); renderHabitToday(); });
document.getElementById('habitNext').addEventListener('click', () => {
  if (habitLogDate >= todayStr()) return;
  habitLogDate = addDays(habitLogDate, 1); renderHabitDayNav(); renderHabitToday();
});
document.getElementById('habitToday').addEventListener('click', () => { habitLogDate = todayStr(); renderHabitDayNav(); renderHabitToday(); });

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
  document.getElementById('habitDateNavGroup').style.display = habitTodaySelectMode ? 'none' : 'flex';
  document.getElementById('habitNavActions').style.display = habitTodaySelectMode ? 'none' : 'flex';
  document.getElementById('habitTodayMassBar').style.display = habitTodaySelectMode ? 'flex' : 'none';
  if (!habitTodaySelectMode) habitTodaySelectedIds.clear();
}
document.getElementById('habitSelectBtn').addEventListener('click', () => {
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
document.getElementById('habitTodayMassArchiveBtn').addEventListener('click', () => {
  if (habitTodaySelectedIds.size === 0) { alert('Select at least one habit first.'); return; }
  if (!confirm(`Move ${habitTodaySelectedIds.size} habit(s) to archive? Nothing is deleted — restore them any time from the All Habits page.`)) return;
  habitTodaySelectedIds.forEach(id => Data.updateHabit(id, { archived: true }));
  habitTodaySelectMode = false;
  updateHabitTodaySelectModeUI();
  renderHabitToday();
  renderCalLegend();
});
document.getElementById('habitTodayMassDeleteBtn').addEventListener('click', () => {
  if (habitTodaySelectedIds.size === 0) { alert('Select at least one habit first.'); return; }
  if (!confirm(`Delete ${habitTodaySelectedIds.size} habit(s) and all their history? This can't be undone (unless you restore a backup).`)) return;
  habitTodaySelectedIds.forEach(id => Data.deleteHabit(id));
  habitTodaySelectMode = false;
  updateHabitTodaySelectModeUI();
  renderHabitToday();
  renderCalLegend();
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
        <span class="habit-name">${escapeHtml(h.name)} <span class="ghost-tag">deleted</span></span>
        <span class="ghost-note">${escapeHtml((log && log.note) || '')}${log && log.metricValue != null && log.metricValue !== '' ? ` · ${escapeHtml(String(log.metricValue))}` : ''}</span>
        <span class="ghost-done">${done ? '✓' : ''}</span>
        <button class="entry-del-x" title="Remove this day's record">×</button>
      `;
      row.querySelector('.entry-del-x').addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (confirm(`Remove ${h.name}'s record for this day? (The habit itself is already deleted — this just clears this one day.)`)) {
          Data.deleteHabitLog(h.id, habitLogDate);
          renderHabitToday();
        }
      });
      list.appendChild(row);
      return;
    }

    if (habitTodaySelectMode) {
      const checked = habitTodaySelectedIds.has(h.id);
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
    row.innerHTML = `
      <span class="entry-drag-handle" title="Drag to reorder">⠿</span>
      <a class="habit-identity" href="habit.html?id=${h.id}" title="View / edit ${escapeHtml(h.name)}">
        <span class="habit-icon-badge" style="background:${h.color}22;border-color:${h.color}">${escapeHtml(h.icon || '●')}</span>
        <span class="habit-name">${escapeHtml(h.name)}</span>
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
  window.requestAnimationFrame(() => window.scrollTo(0, scrollY));
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

function renderCalLegend() {
  const habits = Data.getHabits().filter(h => !h.archived);
  const wrap = document.getElementById('calLegend');
  wrap.className = 'cal-legend big';
  wrap.innerHTML = habits.map(h => `<span class="li"><span class="sw" style="background:${h.color}"></span>${escapeHtml(h.icon || '')} ${escapeHtml(h.name)}</span>`).join('');
}
function renderCalDetail(dateStr) {
  const habits = Data.getHabits().filter(h => !h.archived);
  const logs = Data.getHabitLogs().filter(l => l.date === dateStr && (l.done || (l.note && l.note.trim())));
  const box = document.getElementById('calDetail');
  box.style.display = '';
  let html = `<h4>${friendlyDate(dateStr)}</h4>`;
  if (logs.length === 0) { html += '<div class="empty-note">No habits logged this day.</div>'; }
  else {
    logs.forEach(l => {
      const h = habits.find(h => h.id === l.habitId);
      if (!h) return;
      html += `<div class="item"><span class="sw" style="background:${h.color}"></span>${escapeHtml(h.icon || '')} ${escapeHtml(h.name)}${l.done ? ' ✓' : ' (noted)'}${l.metric ? ' · ' + escapeHtml(l.metric) : ''}${l.note ? ' — ' + escapeHtml(l.note) : ''}</div>`;
    });
  }
  box.innerHTML = html;
}
function renderCalendar() {
  renderCalLegend();
  document.getElementById('calLabel').textContent = MONTHS[calMonth.getMonth()] + ' ' + calMonth.getFullYear();
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';
  DOW.forEach(d => { const el = document.createElement('div'); el.className = 'cal-dow'; el.textContent = d[0]; grid.appendChild(el); });
  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const habits = Data.getHabits().filter(h => !h.archived);
  const logs = Data.getHabitLogs().filter(l => l.done);
  const today = todayStr();
  for (let i = 0; i < firstDow; i++) { const el = document.createElement('div'); el.className = 'cal-cell empty'; grid.appendChild(el); }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = year + '-' + pad(month + 1) + '-' + pad(day);
    const cell = document.createElement('div');
    cell.className = 'cal-cell' + (dateStr === today ? ' today' : '') + (dateStr === calSelectedDate ? ' selected' : '');
    const dayLogs = logs.filter(l => l.date === dateStr);
    const dotsHtml = dayLogs.map(l => {
      const h = habits.find(h => h.id === l.habitId);
      return h ? `<span class="d" style="background:${h.color}" title="${escapeHtml(h.name)}"></span>` : '';
    }).join('');
    cell.innerHTML = `<span class="cal-daynum">${day}</span><div class="cal-dots big">${dotsHtml}</div>`;
    cell.addEventListener('click', () => { calSelectedDate = dateStr; renderCalendar(); });
    grid.appendChild(cell);
  }
  if (calSelectedDate) renderCalDetail(calSelectedDate);
}
document.getElementById('calPrev').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
document.getElementById('calNext').addEventListener('click', () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });

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
const journalEditor = initRichTextEditor(
  document.getElementById('journalTextarea'),
  document.getElementById('journalToolbar'),
  {
    capPx: 260,
    expandStorageKey: 'mm_journalExpanded',
    expandBtnEl: document.getElementById('journalExpandBtn'),
    onInput: () => { Data.upsertJournalEntry(todayStr(), journalEditor.getHtml()); }
  }
);
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
Data.rolloverUnfinishedRoughTasks();
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
document.getElementById('clearPrioritiesBtn').addEventListener('click', () => {
  if (!confirm('Clear the priority number from every task on this day?')) return;
  Data.clearAllPriorities(currentDate);
  renderDayEntries();
});
document.getElementById('deleteUnprioritizedBtn').addEventListener('click', () => {
  const count = Data.getDayEntries().filter(e => e.date === currentDate && e.priority == null).length;
  if (count === 0) return;
  if (!confirm(`Delete all ${count} task(s) without a priority number on this day? This can't be undone (unless you restore a backup).`)) return;
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

// ---------- first-load splash ----------
(function runSplash() {
  const overlay = document.getElementById('splashOverlay');
  if (!overlay || sessionStorage.getItem('mm_splashDone')) { if (overlay) overlay.remove(); return; }
  sessionStorage.setItem('mm_splashDone', '1');

  // Attempts to play automatically — no tap required. This works reliably once the browser
  // either trusts the site enough on its own (Chrome's Media Engagement Index, builds up from
  // regular real use) or, more immediately and deterministically, once you've manually allowed
  // sound for this exact origin at chrome://settings/content/sound. Falls back to waiting for
  // the first click/keydown/tap only if the browser actually blocks it outright (e.g. a fresh
  // browser/device that hasn't been granted that permission yet, or one that doesn't support a
  // manual override at all, like iOS Safari) — so this degrades gracefully rather than staying
  // silent if the auto-attempt doesn't work somewhere.
  const audio = document.getElementById('splashAudio');
  if (audio && typeof audio.play === 'function') {
    audio.volume = 0.9;
    const p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        // blocked — this is a MULTI-PAGE site, so skip a gesture that's clearly about to
        // navigate away (a link/submit button): the resulting navigation would tear the whole
        // page — and the freshly-started audio — down a beat later. Wait for a safer one instead.
        const isNavigatingGesture = (ev) => {
          if (ev.type === 'click') return !!(ev.target.closest && ev.target.closest('a[href], button[type="submit"], input[type="submit"]'));
          if (ev.type === 'keydown') {
            const onLink = ev.target.closest && ev.target.closest('a[href]');
            return !!onLink && (ev.key === 'Enter' || ev.key === ' ');
          }
          return false;
        };
        const retryOnGesture = (ev) => {
          if (isNavigatingGesture(ev)) return;
          if (!audio.paused) return;
          audio.currentTime = 0;
          audio.play().catch(() => {});
          document.removeEventListener('click', retryOnGesture, true);
          document.removeEventListener('keydown', retryOnGesture, true);
          document.removeEventListener('touchstart', retryOnGesture, true);
        };
        document.addEventListener('click', retryOnGesture, true);
        document.addEventListener('keydown', retryOnGesture, true);
        document.addEventListener('touchstart', retryOnGesture, true);
      });
    }
  }

  // a quarter-second hold before the fade starts, so the visual doesn't outrun the audio —
  // play() needs a brief moment to actually start producing sound
  setTimeout(() => {
    overlay.classList.add('splash-fade');
  }, 250);

  overlay.addEventListener('transitionend', (e) => {
    if (e.propertyName !== 'opacity') return; // fires once for opacity, once for filter — only act once
    overlay.remove();
    // background music starts right as the startup sequence finishes, as its own separate
    // track (see nav.js Bgm).
    if (window.SignalBgm) window.SignalBgm.startFresh();
  }, { once: true });
})();
