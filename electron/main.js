const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let excelWatcher = null;
let excelWatcherPath = null;
let excelDebounceTimer = null;
const EXCEL_DEBOUNCE_MS = 250;

const clearExcelWatcher = () => {
  if (excelWatcher) {
    excelWatcher.close();
    excelWatcher = null;
  }
  excelWatcherPath = null;
};

const emitExcelError = (message) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('excel-watch:error', { message });
  }
};

const emitExcelUpdate = (rows) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('excel-watch:update', {
      rows,
      filePath: excelWatcherPath,
      updatedAt: new Date().toISOString()
    });
  }
};

const parseExcelFile = (filePath) => {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
};

const readExcelAndBroadcast = () => {
  if (!excelWatcherPath) {
    return { error: 'Aucun fichier Excel sélectionné' };
  }

  try {
    if (!fs.existsSync(excelWatcherPath)) {
      const message = `Fichier introuvable : ${excelWatcherPath}`;
      emitExcelError(message);
      return { error: message };
    }

    const rows = parseExcelFile(excelWatcherPath);
    emitExcelUpdate(rows);
    return { ok: true, rowsCount: rows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur de lecture Excel';
    emitExcelError(message);
    return { error: message };
  }
};

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
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

ipcMain.handle('excel-watch:set-file', (_event, filePath) => {
  clearExcelWatcher();

  if (!filePath) {
    return { error: 'Aucun chemin fourni' };
  }

  excelWatcherPath = filePath;

  try {
    excelWatcher = fs.watch(filePath, { persistent: true }, () => {
      if (excelDebounceTimer) {
        clearTimeout(excelDebounceTimer);
      }
      excelDebounceTimer = setTimeout(() => {
        readExcelAndBroadcast();
      }, EXCEL_DEBOUNCE_MS);
    });

    // Lecture initiale
    const initial = readExcelAndBroadcast();
    return { ok: true, ...initial };
  } catch (error) {
    clearExcelWatcher();
    const message = error instanceof Error ? error.message : 'Impossible de surveiller le fichier Excel';
    emitExcelError(message);
    return { error: message };
  }
});

ipcMain.handle('excel-watch:stop', () => {
  clearExcelWatcher();
  return { ok: true };
});

ipcMain.handle('excel-watch:read-once', () => readExcelAndBroadcast());

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
