// Preload script for Electron
// This runs in a sandboxed environment with access to Node.js APIs

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  watchExcelFile: async (filePath) => ipcRenderer.invoke('excel-watch:set-file', filePath),
  stopExcelWatch: async () => ipcRenderer.invoke('excel-watch:stop'),
  readExcelOnce: async () => ipcRenderer.invoke('excel-watch:read-once'),
  onExcelUpdate: (callback) => {
    ipcRenderer.removeAllListeners('excel-watch:update');
    ipcRenderer.on('excel-watch:update', (_event, payload) => callback(payload));
  },
  onExcelError: (callback) => {
    ipcRenderer.removeAllListeners('excel-watch:error');
    ipcRenderer.on('excel-watch:error', (_event, payload) => callback(payload));
  }
});
