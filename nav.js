/* ============================================================
   nav.js — shared sidebar, injected into every page.
   Reads data-active off #sidebarMount to know which link to highlight.
   Handles collapse (persisted) so the whole layout can stay centered
   without a wide sidebar eating the page.
   ============================================================ */

const NAV_ICON = {
  today: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.4" stroke="currentColor" stroke-width="1.4"/><path d="M8 1.2V3M8 13v1.8M14.8 8H13M3 8H1.2M12.7 3.3l-1.3 1.3M4.6 11.4l-1.3 1.3M12.7 12.7l-1.3-1.3M4.6 4.6L3.3 3.3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  models: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5.2" height="5.2" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="8.8" y="2" width="5.2" height="5.2" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="8.8" width="5.2" height="5.2" rx="1.2" stroke="currentColor" stroke-width="1.3"/><rect x="8.8" y="8.8" width="5.2" height="5.2" rx="1.2" stroke="currentColor" stroke-width="1.3"/></svg>',
  habits: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.8" y="1.8" width="12.4" height="12.4" rx="3.2" stroke="currentColor" stroke-width="1.2" opacity="0.4"/><path d="M4.3 8.2l2.6 2.6L11.7 5.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  canvas: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13L11.5 4.5a1.4 1.4 0 0 1 2 0v0a1.4 1.4 0 0 1 0 2L5 15l-2.6.6L3 13z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  flow: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8.8" r="5.6" stroke="currentColor" stroke-width="1.3"/><path d="M8 5.6V8.8L10.2 11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 1.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M8 1.5V3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  notes: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2.5" y="2" width="11" height="12" rx="1.4" stroke="currentColor" stroke-width="1.3"/><path d="M5 6h6M5 8.6h6M5 11.2h3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  download: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  upload: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 10V2m0 0L5 5m3-3l3 3M3 13h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  collapse: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  hamburger: '<svg width="17" height="17" viewBox="0 0 16 16" fill="none"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  musicOn: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 12.2a2 2 0 1 1-1.4-1.9V3.8L13 2.5v6.7M4.6 10.3V5.6l7-1v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11.6" cy="10.9" r="2" stroke="currentColor" stroke-width="1.3"/></svg>',
  musicOff: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 12.2a2 2 0 1 1-1.4-1.9V3.8L13 2.5v6.7M4.6 10.3V5.6l7-1v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/><circle cx="11.6" cy="10.9" r="2" stroke="currentColor" stroke-width="1.3" opacity="0.4"/><path d="M2 2l12 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  themeLight: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3.1" stroke="currentColor" stroke-width="1.3"/><path d="M8 1.3v2.1M8 12.6v2.1M14.7 8h-2.1M3.4 8H1.3M12.6 3.4l-1.5 1.5M4.9 11.1l-1.5 1.5M12.6 12.6l-1.5-1.5M4.9 4.9L3.4 3.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  themeDark: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13.6 9.6A5.9 5.9 0 1 1 6.4 2.4a4.7 4.7 0 0 0 7.2 7.2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>'
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
      <li>${navItem('models.html', 'models', 'Mental Models', activeKey)}</li>
      <li>${navItem('habits.html', 'habits', 'All Habits', activeKey)}</li>
      <li>${navItem('flow.html', 'flow', 'Flow', activeKey)}</li>
      <li>${navItem('journal.html', 'notes', 'Journal', activeKey)}</li>
    </ul>

    <div class="sidebar-spacer" id="sidebarSpacer"></div>

    <div class="sidebar-footer">
      <div class="footer-row">
        <button class="ghost-btn" id="bgmToggleBtn" title="Play background music">${NAV_ICON.musicOff}<span class="label">Play music</span></button>
        <button class="ghost-btn" id="themeToggleBtn" title="Switch to light mode">${NAV_ICON.themeDark}</button>
      </div>
      <button class="ghost-btn mobile-only-btn" id="mobileBackupToggleBtn" title="Backup &amp; restore">${NAV_ICON.hamburger}</button>
      <div class="mobile-backup-panel" id="mobileBackupPanel">
        <button class="ghost-btn" id="exportBtn" title="Download backup">${NAV_ICON.download}<span class="label">Download backup</span></button>
        <button class="ghost-btn" id="importBtn" title="Restore from backup">${NAV_ICON.upload}<span class="label">Restore from backup</span></button>
        <button class="ghost-btn" id="themeToggleBtnMobile" title="Switch to light mode">${NAV_ICON.themeDark}<span class="label">Light mode</span></button>
      </div>
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

  // mobile-only floating backup panel: tucked behind its own "☰" so the bottom tab bar stays
  // just the 5 pages. Desktop never shows this button at all (display:none by default), so
  // this listener is inert there.
  const backupToggle = document.getElementById('mobileBackupToggleBtn');
  const backupPanel = document.getElementById('mobileBackupPanel');
  backupToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    shell.classList.toggle('backup-panel-open');
  });
  document.addEventListener('click', (e) => {
    if (!shell.classList.contains('backup-panel-open')) return;
    if (backupPanel.contains(e.target) || e.target === backupToggle) return;
    if (e.target.closest('.modal-overlay')) return; // a SignalConfirm (or any modal) opened from inside the panel shouldn't count as "clicked outside"
    shell.classList.remove('backup-panel-open');
  });
}

document.addEventListener('DOMContentLoaded', renderSidebar);

// ============================================================
// Custom confirm modal — styled Yes/No replacement for the browser's native confirm(), used
// everywhere EXCEPT the backup/restore flow (data.js), which is deliberately left on native
// confirm()/alert() — that flow depends on a very specific two-click sequence to work around a
// browser quirk with chaining dialogs, and isn't worth the risk of touching right now.
// ============================================================
function signalConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    const { okLabel = 'Yes', cancelLabel = 'No', danger = false } = opts;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-overlay';
    overlay.innerHTML = `
      <div class="modal confirm-modal" role="alertdialog" aria-modal="true">
        <p class="confirm-message"></p>
        <div class="modal-actions">
          <button type="button" class="ghost-btn confirm-cancel">${cancelLabel}</button>
          <span class="spacer"></span>
          <button type="button" class="${danger ? 'danger' : 'submit'} confirm-ok">${okLabel}</button>
        </div>
      </div>`;
    // textContent, never innerHTML — these messages get built with real filenames/habit/task
    // names from user data, which must never be interpreted as markup
    overlay.querySelector('.confirm-message').textContent = message;
    document.body.appendChild(overlay);
    const okBtn = overlay.querySelector('.confirm-ok');
    const cancelBtn = overlay.querySelector('.confirm-cancel');
    function close(result) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    }
    okBtn.addEventListener('click', () => close(true));
    cancelBtn.addEventListener('click', () => close(false));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', onKey);
    okBtn.focus();
  });
}
window.SignalConfirm = signalConfirm;

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

  // Setting .currentTime immediately after `new Audio()` — before the browser has actually
  // loaded metadata (readyState 0, HAVE_NOTHING) — is unreliable on mobile: the seek can be
  // silently dropped/reset once metadata does load a moment later, which is what was causing
  // BGM to restart from 0 on every navigation instead of resuming. Desktop Chrome's faster,
  // more eager media pipeline usually has metadata ready near-instantly, masking this there.
  function seekTo(a, time) {
    if (a.readyState >= 1) { a.currentTime = time; return; }
    const onMeta = () => { a.currentTime = time; a.removeEventListener('loadedmetadata', onMeta); };
    a.addEventListener('loadedmetadata', onMeta);
  }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(SRC);
    audio.loop = true;
    audio.preload = 'auto';
    // Reported louder-feeling relative to the startup sfx specifically on phones — reduced by
    // ~35% (splitting the requested 25–50% range) on mobile only; desktop keeps the original
    // 0.5. Checked once here at audio-creation time via the same 760px breakpoint the rest of
    // the CSS uses, rather than continuously — this volume doesn't need to react to a live
    // resize the way layout does.
    audio.volume = window.matchMedia('(max-width: 760px)').matches ? 0.325 : 0.5;
    // keep the saved position reasonably fresh while actually playing, and catch the exact
    // spot on tab-hide/navigate/close — this is what lets the NEXT page load pick up close to here
    setInterval(() => { if (!audio.paused) savePosition(); }, 3000);
    window.addEventListener('pagehide', savePosition);
    // Backgrounding (switching apps, locking the phone, minimizing) now pauses BGM outright —
    // requested explicitly, rather than just letting it keep playing silently/audibly in the
    // background. Foregrounding again resumes it automatically, but only if `isOn()` is still
    // true — that check is what keeps this from re-starting music the user had actually paused
    // themselves (via the toggle button) before backgrounding, as opposed to music this code
    // paused on their behalf just because the tab went out of view.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        savePosition();
        if (!audio.paused) audio.pause();
      } else if (isOn() && audio.paused) {
        seekTo(audio, savedPosition());
        audio.play().catch(() => {});
      }
      updateButton();
    });
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
    seekTo(a, savedPosition());
    const p = a.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        const retry = () => {
          seekTo(a, savedPosition());
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

  // Fixes the "back button randomly pauses BGM" report. Root cause: this is a multi-page site,
  // so a normal navigation is a real reload and Bgm.init() (bound to DOMContentLoaded) runs fresh
  // every time. But the browser's back/forward button doesn't always do a real reload — if the
  // page qualifies for the bfcache (back/forward cache), the browser instead restores the exact
  // frozen page (DOM + JS state intact, DOMContentLoaded does NOT fire again) and, as part of
  // freezing/restoring, forcibly pauses any playing <audio>. Nothing in this file was listening
  // for that restore, so the `audio` object just sat paused with isOn() still true, until some
  // later click happened to trigger a genuine new page load elsewhere (whose fresh init() then
  // resumed it) — matching exactly what was reported: pauses on back, resumes on the next real
  // navigation/interaction. `pageshow` fires on both a normal load AND a bfcache restore, with
  // `event.persisted` telling them apart — only act on the restore case, so a normal load isn't
  // double-handled (init() already covers that one).
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    if (isOn() && audio && audio.paused) {
      audio.play().catch(() => {});
    }
    updateButton();
  });

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
      seekTo(a, savedPosition());
      a.play().catch(() => {});
    }
    updateButton();
  }

  return { init, startFresh, toggle };
})();

document.addEventListener('DOMContentLoaded', () => Bgm.init());
window.SignalBgm = Bgm;

// ============================================================
// Light/dark theme toggle. The actual palette swap is just CSS variables (see :root.light-theme
// in styles.css) — this only owns the persisted on/off state and keeping both button copies (the
// desktop sidebar one and the mobile hamburger-panel one) in sync. The class itself is applied
// even earlier than this, by a small blocking script at the top of every page's <head>, so there
// is no dark-then-light flash waiting for this module to run.
// ============================================================
const Theme = (() => {
  const KEY = 'mm_theme';
  function isLight() { return document.documentElement.classList.contains('light-theme'); }
  function updateButtons() {
    const light = isLight();
    const icon = light ? NAV_ICON.themeLight : NAV_ICON.themeDark;
    const title = light ? 'Switch to dark mode' : 'Switch to light mode';
    const btn = document.getElementById('themeToggleBtn');
    if (btn) { btn.innerHTML = icon; btn.title = title; }
    const mobileBtn = document.getElementById('themeToggleBtnMobile');
    if (mobileBtn) { mobileBtn.innerHTML = icon + `<span class="label">${light ? 'Dark mode' : 'Light mode'}</span>`; mobileBtn.title = title; }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#F5EEDD' : '#15140F'); // matches the browser chrome/status-bar to whichever theme is active
  }
  function toggle() {
    const light = !isLight();
    document.documentElement.classList.toggle('light-theme', light);
    localStorage.setItem(KEY, light ? 'light' : 'dark');
    updateButtons();
  }
  function init() {
    updateButtons();
    const btn = document.getElementById('themeToggleBtn');
    if (btn) btn.addEventListener('click', toggle);
    const mobileBtn = document.getElementById('themeToggleBtnMobile');
    if (mobileBtn) mobileBtn.addEventListener('click', toggle);
  }
  return { init, toggle };
})();

document.addEventListener('DOMContentLoaded', () => Theme.init());

// ============================================================
// Mobile bottom tab bar: force a repaint after a device rotation. Reported symptom was the bar
// visually glitching (wrong position/size for a moment) after rotating landscape→portrait. This
// is a known class of iOS Safari bug where `position: fixed` elements don't always get properly
// re-laid-out on an orientation change until *something* nudges the browser into a fresh layout
// pass — toggling display off and back on for one frame is a plain, low-risk way to force that
// without touching any actual sizing/positioning rule.
// ============================================================
window.addEventListener('orientationchange', () => {
  const bar = document.querySelector('.nav-list');
  if (!bar) return;
  const prev = bar.style.display;
  bar.style.display = 'none';
  void bar.offsetHeight; // forces the browser to actually apply the above before the next line
  requestAnimationFrame(() => { bar.style.display = prev; });
});
