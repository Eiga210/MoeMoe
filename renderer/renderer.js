const petEl = document.getElementById('pet');

const bars = {
  satiety: document.getElementById('bar-satiety'),
  happiness: document.getElementById('bar-happiness'),
  energy: document.getElementById('bar-energy'),
};

const FRAME_CLASSES = [
  'frame-idle', 'frame-blink', 'frame-turn', 'frame-back',
  'frame-sparkle', 'frame-love', 'frame-confused', 'frame-sleep', 'frame-wave',
];

const STAGE_MARGIN = 24; // keep pet clear of the stage edges
let walkDirection = 1;
let walkPos = 50; // percent
let latestState = null;
let reactionMood = null; // 'sparkle' | 'love' | null while a transient reaction is playing

function barColor(value) {
  if (value < 30) return '#e53935';
  if (value < 60) return '#fbc02d';
  return '#4caf50';
}

function renderBars(state) {
  for (const key of Object.keys(bars)) {
    const value = state[key];
    bars[key].style.width = `${value}%`;
    bars[key].style.backgroundColor = barColor(value);
  }
}

function setFrame(name) {
  petEl.classList.remove(...FRAME_CLASSES);
  petEl.classList.add(`frame-${name}`);
}

function currentMood(state) {
  if (reactionMood) return reactionMood;
  if (state.sleeping) return 'sleep';
  const lowest = Math.min(state.satiety, state.happiness, state.energy);
  if (lowest < 20) return 'confused';
  return null;
}

function renderPet(state) {
  const mood = currentMood(state);
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

function showReaction(mood) {
  reactionMood = mood;
  clearTimeout(showReaction._t);
  showReaction._t = setTimeout(() => {
    reactionMood = null;
    if (latestState) renderPet(latestState);
  }, 1200);
  if (latestState) renderPet(latestState);
}

function walkStep() {
  if (!latestState || currentMood(latestState)) return;

  walkPos += walkDirection * 6;
  if (walkPos >= 100 - STAGE_MARGIN / 1.8) {
    walkPos = 100 - STAGE_MARGIN / 1.8;
    walkDirection = -1;
  } else if (walkPos <= STAGE_MARGIN / 1.8) {
    walkPos = STAGE_MARGIN / 1.8;
    walkDirection = 1;
  }
  petEl.style.left = `${walkPos}%`;
  petEl.classList.toggle('flip', walkDirection < 0);
}

setInterval(walkStep, 700);

// Occasional blink for a bit of life while idle/walking.
setInterval(() => {
  if (!latestState || currentMood(latestState)) return;
  setFrame('blink');
  setTimeout(() => {
    if (latestState && !currentMood(latestState)) setFrame('idle');
  }, 150);
}, 3500);

window.petAPI.onUpdate((state) => {
  const prev = latestState;
  latestState = state;
  renderBars(state);
  renderPet(state);

  if (prev) {
    if (state.satiety > prev.satiety + 1) showReaction('sparkle');
    else if (state.happiness > prev.happiness + 1 && !state.sleeping) showReaction('love');
  }

  document.getElementById('btn-sleep').textContent = state.sleeping ? '⏰' : '😴';
});

document.getElementById('btn-feed').addEventListener('click', () => window.petAPI.sendAction('feed'));
document.getElementById('btn-play').addEventListener('click', () => window.petAPI.sendAction('play'));
document.getElementById('btn-sleep').addEventListener('click', () => window.petAPI.sendAction('sleep'));
