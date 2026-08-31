/* ============================================================
   nav.js — shared sidebar, injected into every page.
   Reads data-active off #sidebarMount to know which link to highlight.
   Handles collapse (persisted) so the whole layout can stay centered
   without a wide sidebar eating the page.
   ============================================================ */

const NAV_ICON = {
  today: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.4" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.2V3M8 13v1.8M14.8 8H13M3 8H1.2M12.7 3.3l-1.3 1.3M4.6 11.4l-1.3 1.3M12.7 12.7l-1.3-1.3M4.6 4.6L3.3 3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  models: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5.2" height="5.2" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="8.8" y="2" width="5.2" height="5.2" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="8.8" width="5.2" height="5.2" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="8.8" y="8.8" width="5.2" height="5.2" rx="1.2" stroke="currentColor" stroke-width="1.3"/></svg>',
  habits: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.2l2.6 2.6L13 3.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="8" cy="8" r="6.6" stroke="currentColor" stroke-width="1.2" opacity="0.4"/></svg>',
  canvas: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13L11.5 4.5a1.4 1.4 0 0 1 2 0v0a1.4 1.4 0 0 1 0 2L5 15l-2.6.6L3 13z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  flow: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5c1.8 2.6 3.2 4.4 3.2 6.7a3.2 3.2 0 1 1-6.4 0c0-.9.3-1.6.8-2.4.2.7.8 1.1 1.3 1 .1-1.7.4-3.3 1.1-5.3z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  notes: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2" width="11" height="12" rx="1.4" stroke="currentColor" stroke-width="1.3"/><path d="M5 6h6M5 8.6h6M5 11.2h3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  upload: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 10V2m0 0L5 5m3-3l3 3M3 13h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  collapse: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  musicOn: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 12.2a2 2 0 1 1-1.4-1.9V3.8L13 2.5v6.7M4.6 10.3V5.6l7-1v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11.6" cy="10.9" r="2" stroke="currentColor" stroke-width="1.3"/></svg>',
  musicOff: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 12.2a2 2 0 1 1-1.4-1.9V3.8L13 2.5v6.7M4.6 10.3V5.6l7-1v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/><circle cx="11.6" cy="10.9" r="2" stroke="currentColor" stroke-width="1.3" opacity="0.4"/><path d="M2 2l12 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
};

function navItem(href, key, label, activeKey) {
  return `<a href="${href}" class="nav-item${key === activeKey ? ' active' : ''}">${NAV_ICON[key]}<span class="label">${label}</span></a>`;
}

function renderSidebar() {
  const mount = document.getElementById('sidebarMount');
  if (!mount) return;
  const activeKey = mount.dataset.active || '';

  mount.innerHTML = `
    <button class="collapse-btn" id="collapseBtn">${NAV_ICON.collapse}</button>
    <a href="index.html" class="wordmark">
      <span class="wm-full">Signal<span class="accent">.</span></span>
      <span class="wm-short">S<span class="accent">.</span></span>
    </a>
    <div class="sidebar-sub">models · days · habits</div>

    <div class="nav-group-label">This site</div>
    <ul class="nav-list">
      <li>${navItem('index.html', 'today', 'Today', activeKey)}</li>
      <li>${navItem('models.html', 'models', 'All Mental Models', activeKey)}</li>
      <li>${navItem('habits.html', 'habits', 'All Habits', activeKey)}</li>
      <li>${navItem('flow.html', 'flow', 'Flow', activeKey)}</li>
      <li>${navItem('journal.html', 'notes', 'Journal', activeKey)}</li>
    </ul>

    <div class="sidebar-spacer" id="sidebarSpacer"></div>

    <div class="sidebar-footer">
      <button class="ghost-btn" id="bgmToggleBtn" title="Play background music">${NAV_ICON.musicOff}<span class="label">Play music</span></button>
      <button class="ghost-btn" id="exportBtn" title="Download backup">${NAV_ICON.download}<span class="label">Download backup</span></button>
      <button class="ghost-btn" id="importBtn" title="Restore from backup">${NAV_ICON.upload}<span class="label">Restore from backup</span></button>
      <input type="file" id="importFileInput" accept="application/json">
    </div>
  `;

  const shell = document.getElementById('shell');
  const collapseBtn = document.getElementById('collapseBtn');
  const spacer = document.getElementById('sidebarSpacer');

  function applyCollapseLabel() {
    const isCollapsed = shell.classList.contains('collapsed');
    collapseBtn.title = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  }

  const collapsed = localStorage.getItem('mm_navCollapsed') === 'true';
  if (collapsed) shell.classList.add('collapsed');
  applyCollapseLabel();

  collapseBtn.addEventListener('click', () => {
    shell.classList.toggle('collapsed');
    localStorage.setItem('mm_navCollapsed', shell.classList.contains('collapsed'));
    applyCollapseLabel();
  });

  // the empty space below the nav list, when collapsed, expands the sidebar on click
  spacer.addEventListener('click', () => {
    if (!shell.classList.contains('collapsed')) return;
    shell.classList.remove('collapsed');
    localStorage.setItem('mm_navCollapsed', 'false');
    applyCollapseLabel();
  });
}

document.addEventListener('DOMContentLoaded', renderSidebar);

// shared across every page: a sticky page-head (see styles.css .sticky-head) collapses its
// eyebrow/description and gets a bottom border once the page has actually scrolled, so it
// reads as a slim "docked" bar rather than a second full header.
//
// This used to toggle off a raw window.scrollY number, which caused a real, reported bug: the
// header's own height changes when it collapses (hiding the eyebrow/description), and that
// height change shifts how much of the page needs to be scrolled — right at certain scroll
// positions (e.g. once a long list like Archived habits changes the page's total height) that
// shift could nudge scrollY back across the same threshold that had just triggered it, flipping
// the class back off, un-collapsing the header, shifting the height again... a feedback loop
// that showed up as rapid flicker/"multiplying" right around that scroll position.
// Fixed by watching a plain 1px sentinel placed immediately before the header instead of a
// scrollY number — the sentinel's own position never moves just because the header's height
// changes (it sits *before* the header, so it's unaffected by resizing something after it),
// so there's nothing left for the header's own size to feed back into.
document.addEventListener('DOMContentLoaded', () => {
  const head = document.querySelector('.page-head.sticky-head');
  if (!head || typeof IntersectionObserver === 'undefined') return;
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'height:1px;';
  head.parentNode.insertBefore(sentinel, head);
  const io = new IntersectionObserver(([entry]) => {
    head.classList.toggle('is-stuck', !entry.isIntersecting);
  }, { threshold: 0.1, rootMargin: '2px 0px 0px 0px' });
  io.observe(sentinel);
});

// ============================================================
// Background music. One shared <audio> element, created fresh on every page load — this is a
// multi-page site, so nothing actually survives a real navigation. Its on/off state and last
// known playback position are kept in localStorage so a new page can pick back up close to
// where the last one left off, rather than restarting from the beginning every time.
// A fresh page load is subject to the same autoplay-with-sound policy as the startup sound —
// if the browser blocks the resume attempt, the same retry-on-first-interaction fallback used
// there kicks in here too, so at worst it resumes on your very next click instead of staying
// silent for the rest of the visit. This is the "small noticeable cut" tradeoff discussed —
// there is no way to make this fully gapless without restructuring the whole site to navigate
// without full page reloads (a much bigger change, deliberately not done here).
// ============================================================
const Bgm = (() => {
  const SRC = 'assets/sfx/bgm.m4a';
  const ON_KEY = 'mm_bgmOn';
  const POS_KEY = 'mm_bgmPosition';
  let audio = null;

  function isOn() { return localStorage.getItem(ON_KEY) === 'true'; }
  function savedPosition() { return parseFloat(localStorage.getItem(POS_KEY) || '0') || 0; }
  function savePosition() { if (audio) localStorage.setItem(POS_KEY, String(audio.currentTime)); }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.5;
    // keep the saved position reasonably fresh while actually playing, and catch the exact
    // spot on tab-hide/navigate/close — this is what lets the NEXT page load pick up close to here
    setInterval(() => { if (!audio.paused) savePosition(); }, 3000);
    window.addEventListener('pagehide', savePosition);
    document.addEventListener('visibilitychange', () => { if (document.hidden) savePosition(); });
    return audio;
  }

  function updateButton() {
    const btn = document.getElementById('bgmToggleBtn');
    if (!btn) return;
    const on = !!(audio && !audio.paused);
    btn.innerHTML = (on ? NAV_ICON.musicOn : NAV_ICON.musicOff) + `<span class="label">${on ? 'Pause music' : 'Play music'}</span>`;
    btn.title = on ? 'Pause background music' : 'Play background music';
  }

  function tryResume() {
    const a = ensureAudio();
    a.currentTime = savedPosition();
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        const retry = () => {
          a.currentTime = savedPosition();
          a.play().catch(() => {});
          updateButton();
          document.removeEventListener('click', retry, true);
          document.removeEventListener('keydown', retry, true);
          document.removeEventListener('touchstart', retry, true);
        };
        document.addEventListener('click', retry, true);
        document.addEventListener('keydown', retry, true);
        document.addEventListener('touchstart', retry, true);
      });
    }
    updateButton();
  }

  function init() {
    // if the splash overlay element is still in the DOM, the startup sequence hasn't actually
    // completed yet (it removes itself only once the tap+fade finishes) — defer to its own
    // transitionend handler calling startFresh() instead of resuming bgm here. This used to
    // check sessionStorage's mm_splashDone flag instead, which turned out to be set the INSTANT
    // the splash starts (so it won't re-show on other pages this session), not once it actually
    // finishes — so this resume logic was firing before the tap ever happened, overlapping bgm
    // with the startup sound and then getting stomped by startFresh()'s reset to 0 right after.
    const splashStillShowing = !!document.getElementById('splashOverlay');
    if (!splashStillShowing && isOn()) tryResume();
    updateButton();
    const btn = document.getElementById('bgmToggleBtn');
    if (btn) btn.addEventListener('click', toggle);
  }

  // called once, right as the startup splash finishes — the tap that began the splash is a
  // genuine, still-fresh gesture on this same page, so this particular play() call is reliable
  function startFresh() {
    localStorage.setItem(ON_KEY, 'true');
    localStorage.setItem(POS_KEY, '0');
    const a = ensureAudio();
    a.currentTime = 0;
    a.play().catch(() => {});
    updateButton();
  }

  function toggle() {
    const a = ensureAudio();
    if (!a.paused) {
      a.pause();
      savePosition();
      localStorage.setItem(ON_KEY, 'false');
    } else {
      localStorage.setItem(ON_KEY, 'true');
      a.currentTime = savedPosition();
      a.play().catch(() => {});
    }
    updateButton();
  }

  return { init, startFresh, toggle };
})();

document.addEventListener('DOMContentLoaded', () => Bgm.init());
window.SignalBgm = Bgm;
