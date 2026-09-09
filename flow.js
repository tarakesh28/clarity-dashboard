/* ============================================================
   flow.js — the Flow section's timer.
   Persists across a refresh by storing a target end-timestamp (while
   running) rather than a live countdown, so remaining time is always
   just "endAt - now" — no background process needed. Kept out of the
   export/import backup deliberately: it's live runtime state, not a
   durable record worth merging across devices.
   ============================================================ */

const FLOW_KEY = 'mm_flowTimer';

function loadFlowTimer() {
  try {
    const raw = localStorage.getItem(FLOW_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* fall through to default */ }
  return { totalSeconds: 25 * 60, remainingSeconds: 25 * 60, endAt: null, running: false };
}
function saveFlowTimer(t) { localStorage.setItem(FLOW_KEY, JSON.stringify(t)); }

let flow = loadFlowTimer();
let flowTickHandle = null;
let flowEndedBannerShown = false;

function flowFormatTime(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return String(m).padStart(2, '0') + ':' + String(r).padStart(2, '0');
}

function flowCurrentRemaining() {
  if (flow.running && flow.endAt) {
    return Math.max(0, Math.round((flow.endAt - Date.now()) / 1000));
  }
  return flow.remainingSeconds;
}

const RING_R = 130;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function flowRender() {
  const remaining = flowCurrentRemaining();
  const total = flow.totalSeconds || 1;
  const pct = Math.max(0, Math.min(1, remaining / total));

  document.getElementById('flowTimeLabel').textContent = flowFormatTime(remaining);
  const ring = document.getElementById('flowRingProgress');
  ring.style.strokeDasharray = String(RING_CIRCUMFERENCE);
  ring.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - pct));

  // finished while running (a genuine live completion, not a stale one settled at load —
  // see flowSettleIfStale below): stop cleanly, settle state, and announce it prominently
  if (flow.running && remaining <= 0) {
    flow.running = false;
    flow.remainingSeconds = 0;
    flow.endAt = null;
    saveFlowTimer(flow);
    flowStopTick();
    flowShowEndedBanner();
    flowPlayEndBeeps();
    renderFlowTaskList(); // unlock task selection now that the session is over
  }

  const stateLabel = document.getElementById('flowStateLabel');
  const startBtn = document.getElementById('flowStartBtn');
  const pauseBtn = document.getElementById('flowPauseBtn');

  if (flow.running) stateLabel.textContent = 'running';
  else if (remaining <= 0) stateLabel.textContent = 'done';
  else if (remaining < total) stateLabel.textContent = 'paused';
  else stateLabel.textContent = 'ready';

  startBtn.style.display = flow.running ? 'none' : 'inline-flex';
  startBtn.textContent = (!flow.running && remaining > 0 && remaining < total) ? 'Resume' : 'Start';
  pauseBtn.style.display = flow.running ? 'inline-flex' : 'none';
}

function flowStartTick() {
  if (flowTickHandle) return;
  flowTickHandle = setInterval(flowRender, 250);
  flowRender();
}
function flowStopTick() {
  if (flowTickHandle) { clearInterval(flowTickHandle); flowTickHandle = null; }
}

// ---------- "time's up" — renders directly inside the ring (replacing the time/state text),
// and stays up until the person interacts with anything else on the page, rather than
// fading on its own ----------
function flowShowEndedBanner() {
  if (flowEndedBannerShown) return;
  flowEndedBannerShown = true;
  document.getElementById('flowRingCenter').classList.add('ended');
  const dismiss = () => {
    document.getElementById('flowRingCenter').classList.remove('ended');
    flowEndedBannerShown = false;
    document.removeEventListener('click', dismiss, true);
    document.removeEventListener('keydown', dismiss, true);
  };
  // deferred so the interval tick that triggered this isn't itself misread as "interaction"
  setTimeout(() => {
    document.addEventListener('click', dismiss, true);
    document.addEventListener('keydown', dismiss, true);
  }, 0);
}
function flowHideEndedBanner() {
  document.getElementById('flowRingCenter').classList.remove('ended');
  flowEndedBannerShown = false;
}

// ---------- a two-tone alarm chirp, repeated a handful of times with real gaps between them,
// when the timer genuinely finishes (not on a stale settle at page load) — synthesized with
// the Web Audio API, no sound file needed ----------
function flowPlayEndBeeps() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const chirpCount = 12;     // doubled again — fewer/further-apart than the original design, but now more of them, so total duration stretches out further still
    const toneDur = 0.09;      // each chirp is two quick tones back to back
    const toneGap = 0.03;
    const groupGap = 0.85;     // long pause between chirps — deliberately spaced out
    const tones = [1150, 820]; // a falling two-note "chirp" reads as more alarming than one flat pitch
    // A freshly-created AudioContext frequently starts in a 'suspended' state on mobile browsers
    // (desktop Chrome tends to leave it 'running' immediately, which is why this went unnoticed
    // there) — nothing actually produces sound until it's explicitly resumed. The timer finishing
    // on its own isn't a click/tap, so there's no gesture here to lean on either way; resume()
    // itself doesn't require one, it just has to actually be called.
    const scheduleChirps = () => {
      for (let i = 0; i < chirpCount; i++) {
        const groupStart = ctx.currentTime + i * groupGap;
        tones.forEach((freq, t) => {
          const startAt = groupStart + t * (toneDur + toneGap);
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = 'square'; // harsher/buzzier timbre than a sine — more alarm, less chime
          osc.frequency.value = freq;
          gainNode.gain.setValueAtTime(0.0001, startAt);
          gainNode.gain.exponentialRampToValueAtTime(0.2, startAt + 0.008);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + toneDur);
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          osc.start(startAt);
          osc.stop(startAt + toneDur + 0.02);
        });
      }
      setTimeout(() => ctx.close(), (chirpCount * groupGap + 1) * 1000);
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(scheduleChirps).catch(scheduleChirps);
    } else {
      scheduleChirps();
    }
  } catch (e) { /* audio isn't essential — fail quietly */ }
}

function flowSetTotal(minutes) {
  const secs = Math.max(1, Math.round(minutes * 60));
  flow = { totalSeconds: secs, remainingSeconds: secs, endAt: null, running: false };
  saveFlowTimer(flow);
  flowStopTick();
  flowHideEndedBanner();
  flowRender();
  renderFlowTaskList(); // unlocks task selection if it was locked from a previous run
}

// ---------- task selection: either point at a real item from today's Day List, or type a
// one-off name that exists only for this Flow session. The remembered custom-task TEXT is
// kept separate from which task is currently the active selection, so clicking a different
// real task (or just navigating away and back) never wipes out what was typed. ----------
const FLOW_TASK_KEY = 'mm_flowTask';
const FLOW_TASK_TTL_MS = 24 * 60 * 60 * 1000;

function escapeHtmlLocal(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function defaultFlowTask() { return { mode: null, entryId: null, customText: '', setAt: null }; }
function loadFlowTask() {
  try {
    const raw = JSON.parse(localStorage.getItem(FLOW_TASK_KEY));
    if (!raw) return defaultFlowTask();
    // an active SELECTION expires after 24h — but the remembered custom-task text itself
    // never auto-clears, so nothing typed is ever silently lost
    if (raw.mode && raw.setAt && (Date.now() - raw.setAt > FLOW_TASK_TTL_MS)) {
      return Object.assign(defaultFlowTask(), { customText: raw.customText || '' });
    }
    return Object.assign(defaultFlowTask(), raw);
  } catch (e) { return defaultFlowTask(); }
}
function saveFlowTask(t) { localStorage.setItem(FLOW_TASK_KEY, JSON.stringify(t)); }
let flowTask = loadFlowTask();

// selection is locked (can't pick a different task, or clear the current one) while the
// timer is actually running, and stays locked until it's done
function isFlowSelectionLocked() { return !!flow.running; }

function renderFlowTaskList() {
  const today = todayStr();
  // only ever today's own, non-archived tasks — anything archived (whether stuck on a
  // past day, or manually archived) is excluded by construction
  const entries = typeof Data !== 'undefined'
    ? Data.getDayEntries().filter(e => e.date === today && !e.archived).sort((a, b) => (a.order ?? a.createdAt) - (b.order ?? b.createdAt))
    : [];
  // a selected real task might have rolled to a different date or been deleted since — drop it quietly
  if (flowTask.mode === 'real' && !entries.find(e => e.id === flowTask.entryId)) {
    flowTask.mode = null; flowTask.entryId = null; flowTask.setAt = null; saveFlowTask(flowTask);
  }

  // The selected task floats to the top of this list — display order only, the Day List's own
  // ordering is never touched. This is recomputed fresh from scratch on every render (nothing
  // about it is stored), so deselecting just lets the normal sort order take back over on its
  // own, with no separate "restore" step needed.
  if (flowTask.mode === 'real') {
    const idx = entries.findIndex(e => e.id === flowTask.entryId);
    if (idx > 0) entries.unshift(entries.splice(idx, 1)[0]);
  }

  const locked = isFlowSelectionLocked();
  const hasSelection = !!flowTask.mode;
  document.getElementById('flowTasksHeading').classList.toggle('muted', hasSelection);

  const list = document.getElementById('flowTaskList');
  list.innerHTML = '';
  if (entries.length === 0) {
    list.innerHTML = '<div class="empty-note" style="font-size:12px; padding:4px 0;">Nothing on today\'s list yet.</div>';
  }
  entries.forEach(e => {
    const isSelected = flowTask.mode === 'real' && flowTask.entryId === e.id;
    const row = document.createElement('div');
    row.className = 'flow-task-row'
      + (isSelected ? ' selected' : '')
      + (hasSelection && !isSelected ? ' dimmed' : '')
      + (locked ? ' locked' : '');
    row.innerHTML = `
      <span class="flow-task-dot" style="background:${e.color || '#D4A24C'};"></span>
      <span class="flow-task-text" title="${escapeHtmlLocal(e.text)}">${escapeHtmlLocal(e.text)}</span>
      ${isSelected && !locked ? '<button class="flow-task-clear" type="button" title="Clear selection">×</button>' : ''}
    `;
    if (!locked) {
      if (isSelected) {
        const clear = (ev) => { if (ev) ev.stopPropagation(); flowTask.mode = null; flowTask.entryId = null; flowTask.setAt = null; saveFlowTask(flowTask); renderFlowTaskList(); };
        row.querySelector('.flow-task-clear').addEventListener('click', clear);
        row.addEventListener('click', clear); // clicking the selected row again also deselects it
      } else {
        row.addEventListener('click', () => {
          flowTask.mode = 'real'; flowTask.entryId = e.id; flowTask.setAt = Date.now();
          saveFlowTask(flowTask);
          renderFlowTaskList();
        });
      }
    }
    list.appendChild(row);
  });

  renderFlowCustomArea(locked);
}

function renderFlowCustomArea(locked) {
  const customArea = document.getElementById('flowCustomTaskArea');
  if (flowTask.mode === 'custom') {
    customArea.innerHTML = `
      <div class="flow-task-row selected${locked ? ' locked' : ''}">
        <span class="flow-task-dot" style="background:var(--sage);"></span>
        <div class="flow-task-text-col">
          <span class="flow-task-text" title="${escapeHtmlLocal(flowTask.customText)}">${escapeHtmlLocal(flowTask.customText)}</span>
          <span class="flow-task-subnote">custom task</span>
        </div>
        ${locked ? '' : '<button class="flow-task-clear" type="button" title="Clear selection">×</button>'}
      </div>
    `;
    if (!locked) {
      const clear = (ev) => { if (ev) ev.stopPropagation(); flowTask.mode = null; flowTask.setAt = null; saveFlowTask(flowTask); renderFlowTaskList(); };
      customArea.querySelector('.flow-task-clear').addEventListener('click', clear);
      customArea.querySelector('.flow-task-row').addEventListener('click', clear);
    }
  } else {
    customArea.innerHTML = `
      <div class="flow-custom-task-row">
        <input type="text" id="flowCustomTaskInput" placeholder="or just for this session…" maxlength="60" value="${escapeHtmlLocal(flowTask.customText || '')}" ${locked ? 'disabled' : ''}>
        <button class="ghost-btn" id="flowCustomTaskSetBtn" type="button" ${locked ? 'disabled' : ''}>Set</button>
      </div>
    `;
    if (!locked) {
      const input = customArea.querySelector('#flowCustomTaskInput');
      const commit = () => {
        const val = input.value.trim();
        if (!val) return;
        flowTask.mode = 'custom'; flowTask.customText = val; flowTask.setAt = Date.now();
        saveFlowTask(flowTask);
        renderFlowTaskList();
      };
      // keep whatever's typed remembered even without hitting Set, so clicking a real task
      // (or just navigating away) never loses it
      input.addEventListener('input', () => { flowTask.customText = input.value; saveFlowTask(flowTask); });
      customArea.querySelector('#flowCustomTaskSetBtn').addEventListener('click', commit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('flowDurationInput').value = Math.round(flow.totalSeconds / 60);

  const commitDuration = () => {
    const mins = parseFloat(document.getElementById('flowDurationInput').value);
    if (mins && mins > 0) flowSetTotal(mins);
  };
  document.getElementById('flowSetBtn').addEventListener('click', commitDuration);
  document.getElementById('flowDurationInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitDuration(); }
  });

  document.querySelectorAll('.flow-presets .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = Number(btn.dataset.min);
      document.getElementById('flowDurationInput').value = mins;
      flowSetTotal(mins);
    });
  });

  document.getElementById('flowStartBtn').addEventListener('click', () => {
    const remaining = flowCurrentRemaining();
    flow.remainingSeconds = remaining > 0 ? remaining : flow.totalSeconds;
    flow.endAt = Date.now() + flow.remainingSeconds * 1000;
    flow.running = true;
    saveFlowTimer(flow);
    flowStartTick();
    renderFlowTaskList(); // locks whatever's currently selected until the timer's done
  });

  document.getElementById('flowPauseBtn').addEventListener('click', () => {
    if (!flow.running) return;
    flow.remainingSeconds = flowCurrentRemaining();
    flow.running = false;
    flow.endAt = null;
    saveFlowTimer(flow);
    flowStopTick();
    flowRender();
    renderFlowTaskList(); // pausing unlocks the selection again
  });

  document.getElementById('flowResetBtn').addEventListener('click', () => {
    flow.running = false;
    flow.endAt = null;
    flow.remainingSeconds = flow.totalSeconds;
    saveFlowTimer(flow);
    flowStopTick();
    flowHideEndedBanner();
    flowRender();
    renderFlowTaskList();
  });

  // if a previous session's timer already ran out while we were away (tab closed, laptop
  // shut, or just came back a day later), settle it quietly instead of greeting the person
  // with a "time's up" banner for something that finished who-knows-when
  if (flow.running && flowCurrentRemaining() <= 0) {
    flow.running = false;
    flow.remainingSeconds = 0;
    flow.endAt = null;
    saveFlowTimer(flow);
  }

  renderFlowTaskList();

  if (flow.running) flowStartTick();
  else flowRender();
});
