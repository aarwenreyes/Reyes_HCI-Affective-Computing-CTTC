/**
 * ========================================================
 *  WHACK-A-BUNNY + EMOTION DETECTOR — Integrated JS
 *  CS Student Project: Human & Computer Interaction
 *
 *  New in this version:
 *   - Polls /emotion_data every 500 ms while page is open
 *   - Updates emotion panel (emoji, label, confidence bars)
 *   - Records emotion log during active gameplay
 *   - Shows dominant emotion on Game-Over screen
 * ========================================================
 */

"use strict";

/* ── Game Constants ──────────────────────────────────────── */
const HOLE_COUNT   = 9;
const GAME_SECONDS = 30;
const BUNNIES      = ['🐰','🐇','🐼','🐨','🦊','🐸'];
const PARTICLES    = ['✨','💕','🌸','⭐','💖','🎀'];

const DIFFICULTY = {
  easy:   { minTime: 1200, maxTime: 2000, interval: 1200 },
  medium: { minTime: 800,  maxTime: 1400, interval: 900  },
  hard:   { minTime: 450,  maxTime: 900,  interval: 600  },
};

/* ── Game State ──────────────────────────────────────────── */
const state = {
  score:      0,
  best:       parseInt(localStorage.getItem('wab-best') || '0', 10),
  timeLeft:   GAME_SECONDS,
  difficulty: 'easy',
  running:    false,
  holes:      [],
  timers: {
    countdown:   null,
    moleSpawner: null,
    activeMoles: [],
  },
};

/* ── Emotion Session State ───────────────────────────────── */
const emotionSession = {
  recording:    false,
  counts:       {},    // { Happy: 12, Sad: 3, … }
  log:          [],    // [{ label, emoji, time }, …]
  pollInterval: null,
  lastLabel:    null,
};

/* ── DOM helpers ─────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const screens = {
  start: $('screen-start'),
  howto: $('screen-howto'),
  game:  $('screen-game'),
  over:  $('screen-over'),
};

/* ── Screen Navigation ───────────────────────────────────── */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

/* ── Build Grid ──────────────────────────────────────────── */
function buildGrid() {
  const grid = $('grid');
  grid.innerHTML = '';
  state.holes = [];
  for (let i = 0; i < HOLE_COUNT; i++) {
    const hole  = document.createElement('div');
    const bunny = document.createElement('span');
    hole.className  = 'hole';
    bunny.className = 'bunny';
    bunny.textContent = randomPick(BUNNIES);
    hole.appendChild(bunny);
    hole.addEventListener('pointerdown', () => whack(i));
    grid.appendChild(hole);
    state.holes.push({ el: hole, bunny, active: false, whacked: false });
  }
}

/* ── Start Game ──────────────────────────────────────────── */
function startGame() {
  buildGrid();
  state.score    = 0;
  state.timeLeft = GAME_SECONDS;
  state.running  = true;
  updateHUD();
  showScreen('game');
  $('timer').classList.remove('urgent');

  // Start emotion session recording
  startEmotionSession();

  const cfg = DIFFICULTY[state.difficulty];

  state.timers.countdown = setInterval(() => {
    state.timeLeft--;
    updateHUD();
    if (state.timeLeft <= 5) $('timer').classList.add('urgent');
    if (state.timeLeft <= 0) endGame();
  }, 1000);

  scheduleMole(cfg);
}

/* ── Spawn a Bunny ───────────────────────────────────────── */
function scheduleMole(cfg) {
  if (!state.running) return;
  const idle = state.holes.filter(h => !h.active && !h.whacked);
  if (idle.length > 0) {
    const h = randomPick(idle);
    popUp(h, cfg);
  }
  state.timers.moleSpawner = setTimeout(() => scheduleMole(cfg), cfg.interval);
}

function popUp(h, cfg) {
  h.active  = true;
  h.whacked = false;
  h.bunny.textContent = randomPick(BUNNIES);
  h.el.classList.add('active');
  const hideAfter = rand(cfg.minTime, cfg.maxTime);
  const timer = setTimeout(() => hideMole(h, false), hideAfter);
  state.timers.activeMoles.push(timer);
}

function hideMole(h, wasWhacked) {
  h.active  = false;
  h.whacked = wasWhacked;
  h.el.classList.remove('active', 'whacked');
  setTimeout(() => { h.whacked = false; }, 150);
}

/* ── Whack! ──────────────────────────────────────────────── */
function whack(index) {
  const h = state.holes[index];
  if (!h.active || h.whacked || !state.running) return;
  h.whacked = true;
  h.el.classList.add('whacked');
  state.score++;
  updateHUD();
  spawnScorePopup(h.el);
  spawnParticles(h.el);
  if (navigator.vibrate) navigator.vibrate(40);
  setTimeout(() => hideMole(h, true), 300);
}

/* ── End Game ────────────────────────────────────────────── */
function endGame() {
  state.running = false;
  clearInterval(state.timers.countdown);
  clearTimeout(state.timers.moleSpawner);
  state.timers.activeMoles.forEach(clearTimeout);
  state.timers.activeMoles = [];
  state.holes.forEach(h => h.el.classList.remove('active', 'whacked'));

  stopEmotionSession();

  const isNewBest = state.score > state.best;
  if (isNewBest) {
    state.best = state.score;
    localStorage.setItem('wab-best', state.best);
  }

  $('final-score').textContent = state.score;
  $('final-best').textContent  = state.best;
  $('new-best-badge').classList.toggle('hidden', !isNewBest);

  // Emoji / title based on score
  const emoji     = $('over-emoji');
  const overTitle = $('over-title');
  const overSub   = $('over-sub');

  if (state.score === 0) {
    emoji.textContent     = '😅';
    overTitle.textContent = 'No bunnies!';
    overSub.textContent   = 'Try again, you got this! 💪';
  } else if (state.score < 5) {
    emoji.textContent     = '🌸';
    overTitle.textContent = 'Keep Going!';
    overSub.textContent   = "You're warming up, cutie~ 🐾";
  } else if (state.score < 12) {
    emoji.textContent     = '💖';
    overTitle.textContent = 'Nice Aim!';
    overSub.textContent   = "Those bunnies didn't stand a chance! ✨";
  } else {
    emoji.textContent     = '🏆';
    overTitle.textContent = 'Bunny Queen!';
    overSub.textContent   = 'You are absolutely unstoppable! 🎉';
  }

  // Show dominant emotion summary
  showEmotionSummary();

  setTimeout(() => showScreen('over'), 400);
}

/* ── HUD ─────────────────────────────────────────────────── */
function updateHUD() {
  $('score').textContent = state.score;
  $('timer').textContent = state.timeLeft;
  $('best').textContent  = state.best;
}

/* ── Score Popup ─────────────────────────────────────────── */
function spawnScorePopup(holeEl) {
  const popup = document.createElement('span');
  popup.className   = 'score-popup';
  popup.textContent = '+1 💕';
  holeEl.appendChild(popup);
  popup.addEventListener('animationend', () => popup.remove());
}

/* ── Particles ───────────────────────────────────────────── */
function spawnParticles(holeEl) {
  const rect = holeEl.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;
  const container = $('particles');

  for (let i = 0; i < 6; i++) {
    const p     = document.createElement('span');
    const angle = rand(0, 360) * (Math.PI / 180);
    const dist  = rand(40, 90);
    p.className        = 'particle';
    p.textContent      = randomPick(PARTICLES);
    p.style.left       = `${cx}px`;
    p.style.top        = `${cy}px`;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
    p.style.animationDelay = `${i * 30}ms`;
    container.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

/* ── Helpers ─────────────────────────────────────────────── */
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function nowStr() {
  const d = new Date();
  return `${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

/* ════════════════════════════════════════════════════════════
   EMOTION PANEL LOGIC
════════════════════════════════════════════════════════════ */

/** Called once when the page loads – starts continuous polling */
function startEmotionPolling() {
  // Hide overlay once camera stream loads
  const camImg = $('cam-feed');
  if (camImg) {
    camImg.addEventListener('load', () => {
      const overlay = $('cam-overlay');
      if (overlay) overlay.classList.add('hidden');
    });
  }

  // Poll emotion endpoint every 500 ms
  setInterval(fetchEmotion, 500);
}

/** Fetch latest emotion from Flask */
async function fetchEmotion() {
  try {
    const res  = await fetch('/emotion_data');
    const data = await res.json();
    updateEmotionPanel(data);

    // Record to session if game is running
    if (emotionSession.recording && data.label) {
      recordEmotionTick(data);
    }
  } catch (_) { /* server not ready yet, ignore */ }
}

/** Update the right-hand emotion panel UI */
function updateEmotionPanel(data) {
  const { label, emoji, confidence, all_scores } = data;

  // Big emoji + label
  const emojiEl = $('ep-emoji-big');
  if (emojiEl && emojiEl.textContent !== emoji) {
    emojiEl.textContent = emoji;
    emojiEl.classList.remove('pop');
    void emojiEl.offsetWidth; // reflow to restart animation
    emojiEl.classList.add('pop');
  }
  const labelEl = $('ep-label');
  if (labelEl) labelEl.textContent = label;
  const confEl  = $('ep-conf');
  if (confEl)  confEl.textContent  = `${(confidence * 100).toFixed(0)}%`;

  // Bars
  if (all_scores) {
    Object.entries(all_scores).forEach(([emo, score]) => {
      const fill = $(`bar-${emo}`);
      const pct  = $(`pct-${emo}`);
      const row  = $(`bar-row-${emo}`);
      if (!fill) return;
      const pctVal = (score * 100).toFixed(0);
      fill.style.width = `${pctVal}%`;
      fill.className = `ep-bar-fill ${emo}`;
      if (pct)  pct.textContent = `${pctVal}%`;
      if (row)  row.classList.toggle('active', emo === label);
    });
  }
}

/** Begin recording emotions for this game session */
function startEmotionSession() {
  emotionSession.recording = true;
  emotionSession.counts    = {};
  emotionSession.log       = [];
  emotionSession.lastLabel = null;

  // Clear log UI
  const logEl = $('ep-log');
  if (logEl) logEl.innerHTML = '';
}

/** Stop recording */
function stopEmotionSession() {
  emotionSession.recording = false;
}

/** Called every poll tick while a game is running */
function recordEmotionTick(data) {
  const { label, emoji } = data;

  // Count
  emotionSession.counts[label] = (emotionSession.counts[label] || 0) + 1;

  // Only log when emotion changes (avoid duplicate spam)
  if (label !== emotionSession.lastLabel) {
    emotionSession.lastLabel = label;
    const entry = { label, emoji, time: nowStr() };
    emotionSession.log.push(entry);
    appendLogEntry(entry);
  }
}

/** Append one entry to the session log list */
function appendLogEntry({ label, emoji, time }) {
  const logEl = $('ep-log');
  if (!logEl) return;

  // Remove placeholder
  const placeholder = logEl.querySelector('.ep-log-empty');
  if (placeholder) placeholder.remove();

  const li = document.createElement('li');
  li.innerHTML = `<span>${emoji}</span><span>${label}</span><span class="log-time">${time}</span>`;
  logEl.prepend(li);   // newest on top

  // Keep log to max 30 entries
  while (logEl.children.length > 30) logEl.removeChild(logEl.lastChild);
}

/** After game ends, find dominant emotion and show it on over-screen */
function showEmotionSummary() {
  const counts  = emotionSession.counts;
  const entries = Object.entries(counts);
  if (entries.length === 0) return;

  // Find most frequent
  entries.sort((a, b) => b[1] - a[1]);
  const [domLabel] = entries[0];

  const EMOJI_MAP = {
    Angry: '😠', Disgust: '🤢', Fear: '😨',
    Happy: '😊', Sad: '😢', Surprise: '😲', Neutral: '😐',
  };
  const domEmoji = EMOJI_MAP[domLabel] || '😐';

  const summaryEl = $('emotion-summary');
  const emojiEl   = $('es-emoji');
  const textEl    = $('es-text');

  if (summaryEl) summaryEl.classList.remove('hidden');
  if (emojiEl)   emojiEl.textContent = domEmoji;
  if (textEl)    textEl.textContent  = domLabel;
}

/* ── Event Listeners ─────────────────────────────────────── */
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.diff;
  });
});

$('btn-start').addEventListener('click', startGame);
$('btn-howto').addEventListener('click', () => showScreen('howto'));
$('btn-back').addEventListener('click',  () => showScreen('start'));

$('btn-quit').addEventListener('click', () => {
  state.running = false;
  clearInterval(state.timers.countdown);
  clearTimeout(state.timers.moleSpawner);
  state.timers.activeMoles.forEach(clearTimeout);
  state.timers.activeMoles = [];
  stopEmotionSession();
  showScreen('start');
});

$('btn-restart').addEventListener('click', startGame);
$('btn-home').addEventListener('click',    () => showScreen('start'));

/* ── Init ────────────────────────────────────────────────── */
updateHUD();
showScreen('start');
startEmotionPolling();
