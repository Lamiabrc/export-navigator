const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { excelWatcher, setWatchedFile, clearWatcher } = require('./excelWatcher');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    autoHideMenuBar: false,
    show: false
  });

  // Remove default menu in production
  if (app.isPackaged) {
    Menu.setApplicationMenu(null);
  }

  // Load the app
  if (app.isPackaged) {
    // Production: load from built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    clearWatcher();
    mainWindow = null;
  });
}

function registerExcelWatcherIpc() {
  ipcMain.handle('excel-watch:set-file', (_event, filePath) => {
    setWatchedFile(filePath);
    return { watched: !!excelWatcher.filePath, filePath: excelWatcher.filePath };
  });

  ipcMain.handle('excel-watch:clear', () => {
    clearWatcher();
    return { watched: false, filePath: null };
  });

  excelWatcher.emitter.on('change', (payload) => {
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('excel-watch:changed', payload);
    }
  });

  excelWatcher.emitter.on('error', (payload) => {
    if (mainWindow?.webContents) {
      mainWindow.webContents.send('excel-watch:error', {
        filePath: payload.filePath,
        message: payload.error?.message || String(payload.error),
      });
    }
  });
}

app.whenReady().then(createWindow);
app.whenReady().then(registerExcelWatcherIpc);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
