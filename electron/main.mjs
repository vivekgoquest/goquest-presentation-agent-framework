import { app, BrowserWindow, dialog, ipcMain, net, protocol, utilityProcess } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { resolveProjectFrameworkAssetForElectron } from './project-framework-resolver.mjs';
import { renderElectronPreviewHtml } from './preview-document-shell.mjs';

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

// Register custom protocol before app is ready
protocol.registerSchemesAsPrivileged([{
  scheme: 'presentation',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);

app.whenReady().then(async () => {
  // Handle presentation:// protocol requests
  protocol.handle('presentation', async (request) => {
    const url = new URL(request.url);

    // presentation://preview/current — assembled deck HTML
    if (url.host === 'preview' && url.pathname === '/current') {
      try {
        const response = await invokeWorker('project:getPreviewHtml');
        if (!response?.ok || !response.data?.html) {
          return new Response('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#999">No preview available</body></html>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
          });
        }
        return new Response(renderElectronPreviewHtml(response.data.html, response.data.kind), {
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      } catch {
        return new Response('Preview error', { status: 500 });
      }
    }

    // presentation://project-files/{path} — project-local assets
    if (url.host === 'project-files') {
      try {
        const metaResponse = await invokeWorker('project:getMeta');
        const projectRoot = metaResponse?.data?.projectRoot;
        if (!projectRoot) return new Response('No project', { status: 404 });
        const filePath = resolve(projectRoot, url.pathname.slice(1));
        if (!filePath.startsWith(projectRoot)) return new Response('Forbidden', { status: 403 });
        return net.fetch(`file://${filePath}`);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }

    // presentation://project-framework/{path} — framework assets
    if (url.host === 'project-framework') {
      try {
        const metaResponse = await invokeWorker('project:getMeta');
        const projectRoot = metaResponse?.data?.projectRoot;
        if (!projectRoot) return new Response('No project', { status: 404 });
        const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
        const filePath = resolveProjectFrameworkAssetForElectron(projectRoot, relativePath);
        return net.fetch(`file://${filePath}`);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }

    return new Response('Not found', { status: 404 });
  });

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
