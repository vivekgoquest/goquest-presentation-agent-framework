import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, net, protocol, shell, utilityProcess } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { resolveProjectFrameworkAsset } from '../framework/application/project-framework-resolver.mjs';
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
const operatorDialogState = {
  openDirectory: [],
  save: [],
  history: [],
};

function rejectPendingRequests(message) {
  for (const pending of pendingRequests.values()) {
    pending.reject(new Error(message));
  }
  pendingRequests.clear();
}

function pushDialogHistory(entry) {
  operatorDialogState.history.push({
    at: new Date().toISOString(),
    ...entry,
  });
  if (operatorDialogState.history.length > 50) {
    operatorDialogState.history.splice(0, operatorDialogState.history.length - 50);
  }
}

function consumeDialogOverride(kind) {
  const queue = operatorDialogState[kind];
  if (!Array.isArray(queue) || queue.length === 0) {
    return null;
  }

  return queue.shift() || null;
}

function queueDialogOverride(kind, response) {
  if (!Array.isArray(operatorDialogState[kind])) {
    operatorDialogState[kind] = [];
  }
  operatorDialogState[kind].push(response);
}

function clearDialogOverrides() {
  operatorDialogState.openDirectory = [];
  operatorDialogState.save = [];
  operatorDialogState.history = [];
}

function sendNativeMenuCommand(commandId, payload = {}) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('presentation:native-menu-command', {
        commandId,
        payload,
      });
    }
  }
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
  return mainWindow;
}

function buildApplicationMenuTemplate() {
  const fileSubmenu = [
    {
      id: 'file.newProject',
      label: 'New Project…',
      click: () => sendNativeMenuCommand('project:new'),
    },
    {
      id: 'file.openProject',
      label: 'Open Project…',
      click: () => sendNativeMenuCommand('project:open'),
    },
    { type: 'separator' },
    {
      id: 'file.closeWindow',
      role: 'close',
      label: 'Close Window',
    },
  ];

  const viewSubmenu = [
    {
      id: 'view.reloadWindow',
      label: 'Reload Window',
      accelerator: 'CmdOrCtrl+R',
      click: () => {
        const target = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
        target?.reload();
      },
    },
    {
      id: 'view.toggleDevTools',
      label: 'Toggle Developer Tools',
      accelerator: 'Alt+CommandOrControl+I',
      click: () => {
        const target = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
        target?.webContents?.toggleDevTools();
      },
    },
    { type: 'separator' },
    {
      id: 'view.toggleFullScreen',
      role: 'togglefullscreen',
      label: 'Toggle Full Screen',
    },
  ];

  const windowSubmenu = [
    {
      id: 'window.newWindow',
      label: 'New Window',
      accelerator: 'CmdOrCtrl+Shift+N',
      click: async () => {
        await createMainWindow();
      },
    },
    { type: 'separator' },
    { id: 'window.minimize', role: 'minimize', label: 'Minimize' },
    { id: 'window.zoom', role: 'zoom', label: 'Zoom' },
  ];

  if (process.platform === 'darwin') {
    return [
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { label: 'File', submenu: fileSubmenu },
      { label: 'View', submenu: viewSubmenu },
      { label: 'Window', submenu: [...windowSubmenu, { type: 'separator' }, { role: 'front' }] },
      { label: 'Help', submenu: [{ label: 'Presentation Desktop', enabled: false }] },
    ];
  }

  return [
    { label: 'File', submenu: [...fileSubmenu, { type: 'separator' }, { role: 'quit' }] },
    { label: 'View', submenu: viewSubmenu },
    { label: 'Window', submenu: windowSubmenu },
    { label: 'Help', submenu: [{ label: 'Presentation Desktop', enabled: false }] },
  ];
}

function installApplicationMenu() {
  const menu = Menu.buildFromTemplate(buildApplicationMenuTemplate());
  Menu.setApplicationMenu(menu);
  return menu;
}

globalThis.__presentationOperatorApi = {
  getDialogState() {
    return JSON.parse(JSON.stringify(operatorDialogState));
  },
  queueDialogOverride,
  clearDialogOverrides,
  async createWindow() {
    const window = await createMainWindow();
    return {
      id: window.id,
      title: window.getTitle(),
      bounds: window.getBounds(),
    };
  },
};

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

ipcMain.handle('presentation:invoke', async (_event, request) => {
  const response = await invokeWorker(request?.channel || '', request?.payload || {});
  return response;
});

ipcMain.on('presentation:terminal-input', (_event, payload = {}) => {
  const worker = ensureWorkerProcess();
  worker.postMessage({
    channel: 'terminal:input',
    payload: {
      data: payload?.data || '',
    },
  });
});

ipcMain.handle('presentation:choose-directory', async () => {
  const override = consumeDialogOverride('openDirectory');
  if (override) {
    pushDialogHistory({ kind: 'openDirectory', source: 'override', response: override });
    return override;
  }

  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
  });

  const response = {
    canceled: result.canceled,
    path: result.canceled ? '' : (result.filePaths[0] || ''),
  };
  pushDialogHistory({ kind: 'openDirectory', source: 'native', response });
  return response;
});

ipcMain.handle('presentation:save-dialog', async (_event, options = {}) => {
  const override = consumeDialogOverride('save');
  if (override) {
    pushDialogHistory({ kind: 'save', source: 'override', response: override });
    return override;
  }

  const result = await dialog.showSaveDialog({
    title: String(options?.title || 'Save'),
    defaultPath: String(options?.defaultPath || ''),
    buttonLabel: String(options?.buttonLabel || 'Save'),
  });
  const response = {
    canceled: result.canceled,
    path: result.filePath || '',
  };
  pushDialogHistory({ kind: 'save', source: 'native', response });
  return response;
});

ipcMain.handle('presentation:clipboard-read-text', async () => {
  return clipboard.readText();
});

ipcMain.handle('presentation:clipboard-write-text', async (_event, text = '') => {
  clipboard.writeText(String(text || ''));
  return { ok: true };
});

ipcMain.handle('presentation:terminal-context-menu', async (event, options = {}) => {
  const selectionText = String(options?.selectionText || '');
  const items = Array.isArray(options?.items) ? options.items : [];
  const targetWindow = BrowserWindow.fromWebContents(event.sender);

  const menu = Menu.buildFromTemplate(items.map((item) => ({
    label: String(item?.label || ''),
    enabled: Boolean(item?.enabled),
    click: () => {
      switch (item?.id) {
        case 'copy':
          clipboard.writeText(selectionText);
          break;
        case 'paste':
          event.sender.send('presentation:terminal-context-menu-action', {
            action: 'paste',
            text: clipboard.readText(),
          });
          break;
        case 'selectAll':
          event.sender.send('presentation:terminal-context-menu-action', {
            action: 'selectAll',
          });
          break;
        default:
          break;
      }
    },
  })));

  menu.popup({ window: targetWindow || undefined });
  return { ok: true };
});

ipcMain.handle('presentation:open-external', async (_event, targetUrl = '') => {
  await shell.openExternal(String(targetUrl || ''));
  return { ok: true };
});

ipcMain.handle('presentation:reveal-in-finder', async (_event, targetPath) => {
  const normalizedPath = String(targetPath || '').trim();
  if (!normalizedPath) {
    throw new Error('Provide a file or folder path to reveal.');
  }

  shell.showItemInFolder(normalizedPath);
  return { ok: true };
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
        const response = await invokeWorker('preview:getDocument');
        if (!response?.ok || !response.data?.html) {
          return new Response('<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#999">No preview available</body></html>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
          });
        }
        return new Response(renderElectronPreviewHtml(response.data.html, {
          kind: response.data.kind,
          viewport: response.data.viewport,
        }), {
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
        const filePath = resolveProjectFrameworkAsset(projectRoot, relativePath);
        return net.fetch(`file://${filePath}`);
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }

    return new Response('Not found', { status: 404 });
  });

  ensureWorkerProcess();
  installApplicationMenu();
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
