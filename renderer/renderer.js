const petEl = document.getElementById('pet');
const reactionEl = document.getElementById('reaction');
const stageEl = document.getElementById('pet-stage');

const bars = {
  satiety: document.getElementById('bar-satiety'),
  happiness: document.getElementById('bar-happiness'),
  energy: document.getElementById('bar-energy'),
};

const STAGE_MARGIN = 24; // keep pet clear of the stage edges
let walkDirection = 1;
let walkPos = 50; // percent
let latestState = null;
let reacting = false;

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

function faceFor(state) {
  if (state.sleeping) return '😴';
  const lowest = Math.min(state.satiety, state.happiness, state.energy);
  if (lowest < 20) return '😿';
  if (state.happiness > 80) return '😻';
  return '🐱';
}

function renderPet(state) {
  petEl.textContent = faceFor(state);
  petEl.classList.toggle('sleeping', state.sleeping);
  petEl.classList.toggle('idle', !state.sleeping && reacting);
  petEl.classList.toggle('walk', !state.sleeping && !reacting);
  if (state.sleeping) {
    petEl.style.left = '50%';
  }
}

function showReaction(emoji) {
  reacting = true;
  reactionEl.textContent = emoji;
  reactionEl.classList.add('show');
  clearTimeout(showReaction._t);
  showReaction._t = setTimeout(() => {
    reactionEl.classList.remove('show');
    reacting = false;
    if (latestState) renderPet(latestState);
  }, 1200);
}

function walkStep() {
  if (!latestState || latestState.sleeping || reacting) return;
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

window.petAPI.onUpdate((state) => {
  const prev = latestState;
  latestState = state;
  renderBars(state);
  renderPet(state);

  if (prev) {
    if (state.satiety > prev.satiety + 1) showReaction('🍖');
    else if (state.happiness > prev.happiness + 1 && !state.sleeping) showReaction('🎾');
  }

  document.getElementById('btn-sleep').textContent = state.sleeping ? '⏰' : '😴';
});

document.getElementById('btn-feed').addEventListener('click', () => window.petAPI.sendAction('feed'));
document.getElementById('btn-play').addEventListener('click', () => window.petAPI.sendAction('play'));
document.getElementById('btn-sleep').addEventListener('click', () => window.petAPI.sendAction('sleep'));
