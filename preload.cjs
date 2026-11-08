const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('marea', Object.freeze({
  getVideoThumbnail: (videoId) => ipcRenderer.invoke('music:thumbnail', videoId),
  exportBackup: (data) => ipcRenderer.invoke('backup:export', data),
  openBackup: () => ipcRenderer.invoke('backup:open'),
  restoreNotes: (notes) => ipcRenderer.invoke('backup:notes', notes),
  openNote: () => ipcRenderer.invoke('notes:open'),
  saveNote: (note) => ipcRenderer.invoke('notes:save', note),
  isFullscreen: () => ipcRenderer.invoke('window:is-fullscreen'),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen'),
  onFullscreenChanged: (callback) => {
    const listener = (_event, isFullscreen) => callback(isFullscreen);
    ipcRenderer.on('window:fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('window:fullscreen-changed', listener);
  }
}));
