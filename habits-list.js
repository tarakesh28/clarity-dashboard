/* ============================================================
   habits-list.js — logic for habits.html
   ============================================================ */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function minutesLabel(min) {
  if (!min) return '';
  if (min < 60) return min + 'm';
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
function ddmmyyyy(dateStr) { const [y, m, d] = dateStr.split('-'); return `${d}-${m}-${y}`; }

// ---------- select mode (mass archive / delete) ----------
let selectMode = false;
let selectedIds = new Set();

function renderHabitsList() {
  const byOrder = (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt);
  const habits = Data.getHabits().filter(h => !h.archived).sort(byOrder);
  const box = document.getElementById('habitsList');

  if (habits.length === 0) {
    box.innerHTML = '<div class="empty-note">No habits yet — add your first one below, or from the Today page.</div>';
    return;
  }

  box.innerHTML = habits.map(h => {
    const stats = Data.getHabitStats(h.id);
    const checked = selectedIds.has(h.id);
    return `
      <a class="habit-list-row${selectMode ? ' select-mode' : ''}" href="habit.html?id=${h.id}" draggable="${selectMode ? 'false' : 'true'}" data-id="${h.id}">
        ${selectMode
          ? `<input type="checkbox" class="habit-select-checkbox" ${checked ? 'checked' : ''} tabindex="-1">`
          : '<span class="entry-drag-handle" title="Drag to reorder">⠿</span>'}
        <span class="badge" style="background:${h.color}22;border-color:${h.color}">${escapeHtml(h.icon || '●')}</span>
        <div>
          <div class="hl-name">${escapeHtml(h.name)}</div>
          ${h.metric ? `<div class="hl-metric">${escapeHtml(h.metric)}</div>` : ''}
        </div>
        <div class="hl-insights">
          <span class="hl-stat"><span class="num">${stats.streak}</span><span class="lbl">streak</span></span>
          <span class="hl-stat"><span class="num">${stats.daysDone}</span><span class="lbl">days done</span></span>
          <span class="hl-stat"><span class="num">${stats.lastDate ? ddmmyyyy(stats.lastDate) : '—'}</span><span class="lbl">last logged</span></span>
          ${stats.totalMin ? `<span class="hl-stat"><span class="num">${minutesLabel(stats.totalMin)}</span><span class="lbl">total time</span></span>` : ''}
        </div>
      </a>
    `;
  }).join('');

  if (selectMode) {
    box.querySelectorAll('.habit-list-row').forEach(row => {
      row.addEventListener('click', (e) => {
        e.preventDefault();
        const id = row.dataset.id;
        if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
        updateMassToggleBtn();
        renderHabitsList();
      });
    });
  }
}

// which way the one toggle button currently points — decided by whichever habit (active or
// archived) was selected FIRST, per feedback: showing both "Archive" and "Unarchive" at once
// got crowded, so only the opposite of the first pick is offered until selection is cleared.
function updateMassToggleBtn() {
  const btn = document.getElementById('massToggleArchiveBtn');
  if (selectedIds.size === 0) { btn.textContent = 'Archive selected'; return; }
  const firstId = selectedIds.values().next().value;
  const firstHabit = Data.getHabits().find(h => h.id === firstId);
  const firstIsArchived = !!(firstHabit && firstHabit.archived);
  btn.textContent = firstIsArchived ? 'Unarchive selected' : 'Archive selected';
  btn.dataset.targetArchived = firstIsArchived ? '0' : '1';
}
function updateSelectModeUI() {
  document.getElementById('habitsPageActions').style.display = selectMode ? 'none' : 'flex';
  document.getElementById('habitsMassBar').style.display = selectMode ? 'flex' : 'none';
  if (!selectMode) { selectedIds.clear(); }
  else { archivedHabitsOpen = true; } // so archived habits are visible (and selectable) as soon as Select is on
  updateMassToggleBtn();
}
document.getElementById('habitsSelectBtn').addEventListener('click', () => {
  selectMode = true;
  updateSelectModeUI();
  renderHabitsList();
  renderArchivedHabits();
});
document.getElementById('massCancelBtn').addEventListener('click', () => {
  selectMode = false;
  updateSelectModeUI();
  renderHabitsList();
  renderArchivedHabits();
});
document.getElementById('massToggleArchiveBtn').addEventListener('click', async (e) => {
  if (selectedIds.size === 0) { alert('Select at least one habit first.'); return; }
  const targetArchived = e.target.dataset.targetArchived !== '0';
  const verb = targetArchived ? 'Move' : 'Restore';
  const msg = targetArchived
    ? `Move ${selectedIds.size} habit(s) to archive? They'll disappear from Today and this list, but nothing is deleted — restore them any time from "Archived habits" below.`
    : `Restore ${selectedIds.size} habit(s) from archive back to the active list?`;
  if (!await SignalConfirm(msg, { okLabel: verb })) return;
  selectedIds.forEach(id => Data.updateHabit(id, { archived: targetArchived }));
  selectMode = false;
  updateSelectModeUI();
  renderHabitsList();
  renderArchivedHabits();
});
document.getElementById('massDeleteBtn').addEventListener('click', async () => {
  if (selectedIds.size === 0) { alert('Select at least one habit first.'); return; }
  if (!await SignalConfirm(`Delete ${selectedIds.size} habit(s)? They'll disappear from Habits and Archived habits, but any day you already logged one on keeps showing it if you go back to that date.`, { okLabel: 'Delete', danger: true })) return;
  selectedIds.forEach(id => Data.deleteHabit(id));
  selectMode = false;
  updateSelectModeUI();
  renderHabitsList();
  renderArchivedHabits();
});

// ---------- archived habits — visible + restorable, never a dead end ----------
let archivedHabitsOpen = false;
function renderArchivedHabits() {
  const byOrder = (a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt);
  const archived = Data.getHabits().filter(h => h.archived && !h.deleted).sort(byOrder);
  const toggleBtn = document.getElementById('archivedHabitsToggle');
  const arrow = document.getElementById('archivedHabitsArrow');
  const countEl = document.getElementById('archivedHabitsCount');
  const listEl = document.getElementById('archivedHabitsList');

  if (archived.length === 0) {
    toggleBtn.style.display = 'none';
    listEl.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }
  toggleBtn.style.display = 'flex';
  arrow.textContent = archivedHabitsOpen ? '▾' : '▸';
  countEl.textContent = `(${archived.length})`;
  listEl.style.display = archivedHabitsOpen ? 'flex' : 'none';
  listEl.innerHTML = archived.map(h => {
    const checked = selectedIds.has(h.id);
    return `
    <div class="archived-habit-row${selectMode ? ' select-mode' : ''}" data-id="${h.id}">
      ${selectMode ? `<input type="checkbox" class="habit-select-checkbox" ${checked ? 'checked' : ''} tabindex="-1">` : ''}
      <span class="badge" style="background:${h.color}22;border-color:${h.color}">${escapeHtml(h.icon || '●')}</span>
      <div class="hl-name">${escapeHtml(h.name)}</div>
      ${selectMode ? '' : `<button class="ar-restore" type="button" data-id="${h.id}">Restore</button>`}
    </div>
  `;
  }).join('');
  if (selectMode) {
    listEl.querySelectorAll('.archived-habit-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
        updateMassToggleBtn();
        renderArchivedHabits();
      });
    });
  } else {
    listEl.querySelectorAll('.ar-restore').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        Data.updateHabit(btn.dataset.id, { archived: false });
        renderArchivedHabits();
        renderHabitsList();
      });
    });
  }
}
document.getElementById('archivedHabitsToggle').addEventListener('click', () => {
  archivedHabitsOpen = !archivedHabitsOpen;
  renderArchivedHabits();
});

// ---------- drag reorder (disabled while in select mode) ----------
function getDragAfterElement(container, y, selector) {
  const els = [...container.querySelectorAll(selector + ':not(.dragging)')];
  return els.reduce((closest, el) => {
    const box = el.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: el };
    return closest;
  }, { offset: -Infinity, element: null }).element;
}
function wireHabitsListDragReorder(container) {
  let draggingEl = null;
  container.addEventListener('dragstart', (e) => {
    const row = e.target.closest('.habit-list-row');
    if (!row || row.draggable === false || selectMode) return;
    draggingEl = row;
    requestAnimationFrame(() => row.classList.add('dragging'));
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', row.dataset.id);
  });
  container.addEventListener('dragend', () => {
    if (draggingEl) draggingEl.classList.remove('dragging');
    draggingEl = null;
    const ids = [...container.querySelectorAll('.habit-list-row')].map(el => el.dataset.id);
    Data.reorderHabits(ids);
  });
  container.addEventListener('dragover', (e) => {
    if (!draggingEl) return;
    e.preventDefault();
    const afterEl = getDragAfterElement(container, e.clientY, '.habit-list-row');
    if (afterEl == null) container.appendChild(draggingEl);
    else if (afterEl !== draggingEl) container.insertBefore(draggingEl, afterEl);
  });
  // dragging an <a> shouldn't trigger navigation — only suppress the click that
  // immediately follows an actual drag, real clicks (no movement) still navigate fine
  container.addEventListener('click', (e) => {
    if (container.dataset.justDragged === '1') { e.preventDefault(); container.dataset.justDragged = '0'; }
  });
  container.addEventListener('dragend', () => { container.dataset.justDragged = '1'; setTimeout(() => { container.dataset.justDragged = '0'; }, 0); });
}

// ---------- shared widgets (color swatches / emoji picker) for the add-habit popup ----------
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

// ---------- add-habit popup ("+" button, top right) ----------
let popupColorCtrl;
function openAddHabitPopup() {
  document.getElementById('popupHabitName').value = '';
  document.getElementById('popupHabitIcon').value = '';
  document.getElementById('popupHabitMetric').value = '';
  popupColorCtrl.set(Data.colorForIndex(Data.getHabits().length));
  document.getElementById('addHabitOverlay').style.display = 'flex';
  document.getElementById('popupHabitName').focus();
}
function closeAddHabitPopup() {
  document.getElementById('addHabitOverlay').style.display = 'none';
}
document.getElementById('habitsAddBtn').addEventListener('click', openAddHabitPopup);
document.getElementById('popupHabitCancelBtn').addEventListener('click', closeAddHabitPopup);
document.getElementById('addHabitOverlay').addEventListener('click', (e) => { if (e.target.id === 'addHabitOverlay') closeAddHabitPopup(); });
document.getElementById('popupAddHabitForm').addEventListener('submit', (e) => e.preventDefault());
document.getElementById('popupHabitSaveBtn').addEventListener('click', () => {
  const name = document.getElementById('popupHabitName').value.trim();
  if (!name) { alert("Give it a name first."); return; }
  const icon = document.getElementById('popupHabitIcon').value.trim();
  const metric = document.getElementById('popupHabitMetric').value.trim();
  const color = popupColorCtrl.get();
  Data.addHabit({ name, icon, color, metric });
  closeAddHabitPopup();
  renderHabitsList();
});

popupColorCtrl = buildColorPicker(document.getElementById('popupHabitColorPicker'), Data.colorForIndex(Data.getHabits().length), () => {});
wireEmojiPicker(document.getElementById('popupHabitIconHintBtn'), document.getElementById('popupHabitIcon'), document.getElementById('popupHabitIconPopup'));

renderHabitsList();
renderArchivedHabits();
wireHabitsListDragReorder(document.getElementById('habitsList'));
