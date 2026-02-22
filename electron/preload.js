const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  onScreenshotRequest: (callback) => {
    ipcRenderer.on('screenshot-request', () => callback());
  },
  onCaptureRegion: (callback) => {
    ipcRenderer.on('capture-region', (_, bounds) => callback(bounds));
  },
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources'),
  getScreenSourceForPoint: (x, y) => ipcRenderer.invoke('get-screen-source-for-point', x, y),
  getShortcut: () => ipcRenderer.invoke('get-shortcut'),
  setShortcut: (accelerator) => ipcRenderer.invoke('set-shortcut', accelerator),
});
