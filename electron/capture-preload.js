const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronCapture', {
  sendSelection: (bounds) => ipcRenderer.send('capture-selection-done', bounds),
  cancel: () => ipcRenderer.send('capture-cancel'),
});
