const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marea', Object.freeze({
  openNote: () => ipcRenderer.invoke('notes:open'),
  saveNote: (note) => ipcRenderer.invoke('notes:save', note)
}));