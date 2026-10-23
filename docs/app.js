// Browser-only build: same pet logic as the Electron app, but state lives in
// localStorage instead of a file, and there's no window/tray to drive.

const STORAGE_KEY = 'pien-neko-state';
const TICK_MS = 10000;
const DECAY_PER_MIN = { satiety: 1, happiness: 0.7, energy: 0.5 };
const SLEEP_ENERGY_PER_MIN = 100 / 15; // full recharge (0 -> 100) takes 15 minutes
const MAX_OFFLINE_MINUTES = 12 * 60;

const SONGS = [
  'https://youtu.be/_1gTMhvRtB8',
  'https://youtu.be/YejZlOz-hm0',
  'https://youtu.be/DJdpqIGp1XA',
  'https://youtu.be/cfwFRk7_zHM',
  'https://youtu.be/MttVhi-JDkU',
  'https://youtu.be/ksEcmHz4gg4',
  'https://youtu.be/8kAVEh9Up3c',
  'https://youtu.be/Y6uOJ_jw6cQ',
  'https://youtu.be/dQw4w9WgXcQ',
];

function clamp(value) {
  return Math.max(0, Math.min(100, value));
}

function defaultState() {
  return { satiety: 80, happiness: 80, energy: 80, sleeping: false, lastUpdate: Date.now() };
}

function applyElapsedDecay(s) {
  const now = Date.now();
  const minutes = Math.min((now - s.lastUpdate) / 60000, MAX_OFFLINE_MINUTES);
  if (minutes > 0) {
    if (s.sleeping) {
      s.energy = clamp(s.energy + SLEEP_ENERGY_PER_MIN * minutes);
      if (s.energy >= 100) s.sleeping = false;
    } else {
      s.satiety = clamp(s.satiety - DECAY_PER_MIN.satiety * minutes);
      s.happiness = clamp(s.happiness - DECAY_PER_MIN.happiness * minutes);
      s.energy = clamp(s.energy - DECAY_PER_MIN.energy * minutes);
    }
  }
  s.lastUpdate = now;
}

function loadState() {
  let s;
  try {
    s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!s) throw new Error('no state');
  } catch {
    s = defaultState();
  }
  applyElapsedDecay(s);
  return s;
}

function saveState(s) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

let state = loadState();
saveState(state);

function doAction(type) {
  applyElapsedDecay(state);
  if (type === 'feed') {
    state.satiety = clamp(state.satiety + 25);
    state.happiness = clamp(state.happiness + 5);
  } else if (type === 'play') {
    if (!state.sleeping && state.energy >= 10) {
      state.happiness = clamp(state.happiness + 20);
      state.energy = clamp(state.energy - 15);
      state.satiety = clamp(state.satiety - 5);
    }
  } else if (type === 'sleep') {
    state.sleeping = !state.sleeping;
  }
  state.lastUpdate = Date.now();
  saveState(state);
  render(state);
}

setInterval(() => {
  applyElapsedDecay(state);
  saveState(state);
  render(state);
}, TICK_MS);

// ---- rendering (same approach as the Electron renderer) ----

const petEl = document.getElementById('pet');
const stageEl = document.getElementById('pet-stage');

const bars = {
  satiety: document.getElementById('bar-satiety'),
  happiness: document.getElementById('bar-happiness'),
  energy: document.getElementById('bar-energy'),
};

const FRAME_CLASSES = [
  'frame-idle', 'frame-blink', 'frame-turn', 'frame-back',
  'frame-sparkle', 'frame-love', 'frame-confused', 'frame-sleep', 'frame-wave',
];

let walkDirection = 1;
let walkPos = 50; // percent
let reactionMood = null; // 'sparkle' | 'love' | 'wave' | null while a transient reaction is playing

function barColor(value) {
  if (value < 30) return '#e53935';
  if (value < 60) return '#fbc02d';
  return '#4caf50';
}

function renderBars(s) {
  for (const key of Object.keys(bars)) {
    const value = s[key];
    bars[key].style.width = `${value}%`;
    bars[key].style.backgroundColor = barColor(value);
  }
}

function setFrame(name) {
  petEl.classList.remove(...FRAME_CLASSES);
  petEl.classList.add(`frame-${name}`);
}

function currentMood(s) {
  if (reactionMood) return reactionMood;
  if (s.sleeping) return 'sleep';
  const lowest = Math.min(s.satiety, s.happiness, s.energy);
  if (lowest < 20) return 'confused';
  return null;
}

function renderPet(s) {
  const mood = currentMood(s);
  petEl.classList.remove('walk', 'sleeping', 'idle-anim');

  if (mood) {
    setFrame(mood);
    if (mood === 'sleep') {
      petEl.classList.add('sleeping');
      petEl.style.left = '50%';
    } else {
      petEl.classList.add('idle-anim');
    }
  } else {
    petEl.classList.add('walk');
    setFrame('idle');
  }
}

function render(s) {
  renderBars(s);
  renderPet(s);
  document.getElementById('btn-sleep').textContent = s.sleeping ? '⏰' : '😴';
}

function showReaction(mood) {
  reactionMood = mood;
  clearTimeout(showReaction._t);
  showReaction._t = setTimeout(() => {
    reactionMood = null;
    render(state);
  }, 1200);
  render(state);
}

function walkMarginPercent() {
  const stageWidth = stageEl.clientWidth || 1;
  return ((petEl.offsetWidth / 2) / stageWidth) * 100;
}

function walkStep() {
  if (currentMood(state)) return;

  const margin = walkMarginPercent();
  walkPos += walkDirection * 6;
  if (walkPos >= 100 - margin) {
    walkPos = 100 - margin;
    walkDirection = -1;
  } else if (walkPos <= margin) {
    walkPos = margin;
    walkDirection = 1;
  }
  petEl.style.left = `${walkPos}%`;
  petEl.classList.toggle('flip', walkDirection < 0);
}

setInterval(walkStep, 700);

// Occasional blink for a bit of life while idle/walking.
setInterval(() => {
  if (currentMood(state)) return;
  setFrame('blink');
  setTimeout(() => {
    if (!currentMood(state)) setFrame('idle');
  }, 150);
}, 3500);

petEl.addEventListener('click', () => showReaction('wave'));

document.getElementById('btn-feed').addEventListener('click', () => {
  doAction('feed');
  showReaction('sparkle');
});

document.getElementById('btn-play').addEventListener('click', () => {
  const tooTired = !state.sleeping && state.energy < 10;
  doAction('play');
  showReaction(tooTired ? 'confused' : 'love');
});

document.getElementById('btn-sleep').addEventListener('click', () => doAction('sleep'));

document.getElementById('btn-music').addEventListener('click', () => {
  const url = SONGS[Math.floor(Math.random() * SONGS.length)];
  window.open(url, '_blank', 'noopener');
});

render(state);
