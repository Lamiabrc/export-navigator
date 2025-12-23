const fs = require('fs');
const { EventEmitter } = require('events');

// Simple watcher manager to track a single Excel file and forward lifecycle events.
const excelWatcher = {
  watcher: null,
  filePath: null,
  emitter: new EventEmitter(),
};

function clearWatcher() {
  if (excelWatcher.watcher) {
    excelWatcher.watcher.close();
    excelWatcher.watcher = null;
  }
  excelWatcher.filePath = null;
}

function setWatchedFile(filePath) {
  clearWatcher();
  if (!filePath) {
    return;
  }

  // fs.watch emits "error" when the file is removed/renamed or permissions change.
  // Without this listener, the Electron main process would crash on such events.
  const watcher = fs.watch(filePath, { persistent: false }, (eventType) => {
    excelWatcher.emitter.emit('change', { eventType, filePath });
  });

  watcher.on('error', (err) => {
    excelWatcher.emitter.emit('error', { filePath, error: err });
    clearWatcher();
  });

  excelWatcher.watcher = watcher;
  excelWatcher.filePath = filePath;
}

module.exports = {
  excelWatcher,
  setWatchedFile,
  clearWatcher,
};
