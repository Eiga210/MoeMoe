const { app, BrowserWindow, Tray, nativeImage, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

const STATE_PATH = path.join(app.getPath('userData'), 'pet-state.json');

const DECAY_PER_MIN = { satiety: 1, happiness: 0.7, energy: 0.5 };
const SLEEP_ENERGY_PER_MIN = 3;
const MAX_OFFLINE_MINUTES = 12 * 60; // cap catch-up decay so leaving it closed for days doesn't zero everything
const TICK_MS = 10000;

let state;
let win;
let tray;

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
    s = JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
  } catch {
    s = defaultState();
  }
  applyElapsedDecay(s);
  return s;
}

function saveState(s) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(s));
}

function pushState() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('state-update', state);
  }
}

function rebuildTrayMenu() {
  const menu = Menu.buildFromTemplate([
    { label: '餵食 🍰', click: () => doAction('feed') },
    { label: '抓蝴蝶 🦋', click: () => doAction('play') },
    { label: state.sleeping ? '叫醒 ⏰' : '睡覺 😴', click: () => doAction('sleep') },
    { type: 'separator' },
    {
      label: '顯示 / 隱藏',
      click: () => {
        if (!win) return;
        win.isVisible() ? win.hide() : win.show();
      },
    },
    { type: 'separator' },
    { label: '結束', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

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
  pushState();
  rebuildTrayMenu();
}

function createWindow() {
  win = new BrowserWindow({
    width: 240,
    height: 310,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  state = loadState();
  createWindow();

  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('🐱');
  rebuildTrayMenu();

  setInterval(() => {
    applyElapsedDecay(state);
    pushState();
    saveState(state);
    rebuildTrayMenu();
  }, TICK_MS);

  win.webContents.once('did-finish-load', pushState);

  ipcMain.on('action', (_event, type) => doAction(type));
});

app.on('window-all-closed', () => {
  // keep running in the tray instead of quitting
});

app.on('before-quit', () => {
  if (state) saveState(state);
});
