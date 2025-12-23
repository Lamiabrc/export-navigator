// Preload script for Electron
// This runs in a sandboxed environment with access to Node.js APIs

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  excelWatch: {
    setFile: (filePath) => ipcRenderer.invoke('excel-watch:set-file', filePath),
    clear: () => ipcRenderer.invoke('excel-watch:clear'),
    onChanged: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('excel-watch:changed', handler);
      return () => ipcRenderer.removeListener('excel-watch:changed', handler);
    },
    onError: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on('excel-watch:error', handler);
      return () => ipcRenderer.removeListener('excel-watch:error', handler);
    }
  }
});
