const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  sendAction: (type) => ipcRenderer.send('action', type),
  onUpdate: (callback) => ipcRenderer.on('state-update', (_event, state) => callback(state)),
  playRandomSong: () => ipcRenderer.send('play-random-song'),
});
