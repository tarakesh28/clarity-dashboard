/* ============================================================
   journal.js — logic for journal.html
   Deliberately simple: no click interactions, no generated
   excerpts — just lay every entry out and let CSS clip it.
   ============================================================ */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function ddmmyyyy(dateStr) { const [y, m, d] = dateStr.split('-'); return `${d}-${m}-${y}`; }

function renderJournal() {
  const entries = Data.getJournalEntries(); // already sorted newest first
  const grid = document.getElementById('journalGrid');
  if (entries.length === 0) {
    grid.innerHTML = '<div class="empty-note">Nothing written yet — start on the Today page.</div>';
    return;
  }
  grid.innerHTML = entries.map(e => `
    <a class="journal-card linked" href="journal-entry.html?date=${e.date}">
      <div class="jc-date">${ddmmyyyy(e.date)}</div>
      <div class="jc-text">${escapeHtml(stripHtmlToText(normalizeStoredHtml(e.text)))}</div>
    </a>
  `).join('');
}

renderJournal();
