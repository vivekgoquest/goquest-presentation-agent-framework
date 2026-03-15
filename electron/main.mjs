import { app, BrowserWindow, dialog, ipcMain, utilityProcess } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const ELECTRON_ROOT = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(ELECTRON_ROOT, '..');
const RENDERER_ENTRY = resolve(ELECTRON_ROOT, 'renderer', 'index.html');
const PRELOAD_ENTRY = resolve(ELECTRON_ROOT, 'preload.cjs');
const WORKER_ENTRY = resolve(ELECTRON_ROOT, 'worker', 'host.mjs');

let mainWindow = null;
let workerProcess = null;
let requestCounter = 0;
const pendingRequests = new Map();

function rejectPendingRequests(message) {
  for (const pending of pendingRequests.values()) {
    pending.reject(new Error(message));
  }
  pendingRequests.clear();
}

function forwardWorkerEvent(event) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('presentation:event', event);
    }
  }
}

function startWorkerProcess() {
  if (workerProcess) {
    return workerProcess;
  }

  workerProcess = utilityProcess.fork(WORKER_ENTRY, [], {
    serviceName: 'presentation-native-host',
    stdio: 'pipe',
    env: {
      ...process.env,
      PRESENTATION_FRAMEWORK_ROOT: REPO_ROOT,
    },
  });

  if (workerProcess.stdout) {
    workerProcess.stdout.on('data', (chunk) => {
      process.stdout.write(`[electron-worker] ${chunk}`);
    });
  }
  if (workerProcess.stderr) {
    workerProcess.stderr.on('data', (chunk) => {
      process.stderr.write(`[electron-worker] ${chunk}`);
    });
  }

  workerProcess.on('message', (message) => {
    if (message?.kind === 'event') {
      forwardWorkerEvent(message);
      return;
    }

    if (message?.kind !== 'response') {
      return;
    }

    const pending = pendingRequests.get(message.requestId);
    if (!pending) {
      return;
    }

    pendingRequests.delete(message.requestId);
    pending.resolve(message);
  });

  workerProcess.on('exit', (code) => {
    workerProcess = null;
    rejectPendingRequests(`Electron worker exited early with code ${code}.`);
  });

  return workerProcess;
}

function ensureWorkerProcess() {
  return startWorkerProcess();
}

async function invokeWorker(channel, payload = {}) {
  const worker = ensureWorkerProcess();
  const requestId = ++requestCounter;

  return new Promise((resolvePromise, reject) => {
    pendingRequests.set(requestId, {
      resolve: resolvePromise,
      reject,
    });

    worker.postMessage({
      requestId,
      channel,
      payload,
    });
  });
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  await mainWindow.loadFile(RENDERER_ENTRY);
}

ipcMain.handle('presentation:invoke', async (_event, request) => {
  const response = await invokeWorker(request?.channel || '', request?.payload || {});
  return response;
});

ipcMain.handle('presentation:choose-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });

  return {
    canceled: result.canceled,
    path: result.canceled ? '' : (result.filePaths[0] || ''),
  };
});

app.whenReady().then(async () => {
  ensureWorkerProcess();
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (workerProcess) {
    workerProcess.kill();
  }
});
