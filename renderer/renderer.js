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

function walkMarginPercent() {
  // half the pet's own width, expressed as a % of the stage, so "left: X%"
  // (which centers the pet via translateX(-50%)) never pushes it past the edge
  const stageWidth = stageEl.clientWidth || 1;
  return ((petEl.offsetWidth / 2) / stageWidth) * 100;
}

function walkStep() {
  if (!latestState || currentMood(latestState)) return;

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
  if (!latestState || currentMood(latestState)) return;
  setFrame('blink');
  setTimeout(() => {
    if (latestState && !currentMood(latestState)) setFrame('idle');
  }, 150);
}, 3500);

window.petAPI.onUpdate((state) => {
  latestState = state;
  renderBars(state);
  renderPet(state);
  document.getElementById('btn-sleep').textContent = state.sleeping ? '⏰' : '😴';
});

petEl.addEventListener('click', () => showReaction('wave'));

document.getElementById('btn-feed').addEventListener('click', () => {
  window.petAPI.sendAction('feed');
  showReaction('sparkle');
});

document.getElementById('btn-play').addEventListener('click', () => {
  window.petAPI.sendAction('play');
  const tooTired = latestState && !latestState.sleeping && latestState.energy < 10;
  showReaction(tooTired ? 'confused' : 'love');
});

document.getElementById('btn-sleep').addEventListener('click', () => window.petAPI.sendAction('sleep'));

document.getElementById('btn-music').addEventListener('click', () => window.petAPI.playRandomSong());
