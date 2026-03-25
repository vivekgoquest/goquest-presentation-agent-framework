const { contextBridge, ipcRenderer } = require('electron');

function normalizeError(response) {
  const error = new Error(response?.error?.message || 'Worker request failed.');
  error.code = response?.error?.code || null;
  error.needsInitialization = Boolean(response?.error?.needsInitialization);
  error.cancelled = Boolean(response?.error?.cancelled);
  return error;
}

async function request(channel, payload = {}) {
  const response = await ipcRenderer.invoke('presentation:invoke', { channel, payload });
  if (!response?.ok) {
    throw normalizeError(response);
  }

  return response.data;
}

function subscribe(filter, callback) {
  const handler = (_event, payload) => {
    if (!payload || (filter && payload.channel !== filter)) {
      return;
    }

    callback(payload);
  };

  ipcRenderer.on('presentation:event', handler);
  return () => {
    ipcRenderer.removeListener('presentation:event', handler);
  };
}

function subscribeNative(channel, callback) {
  const handler = (_event, payload) => {
    callback(payload);
  };

  ipcRenderer.on(channel, handler);
  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

function subscribeToActionEvents(callback) {
  return subscribe(null, (event) => {
    if (!(typeof event?.channel === 'string' && event.channel.startsWith('action/'))) {
      return;
    }
    callback(event);
  });
}

contextBridge.exposeInMainWorld('electron', {
  project: {
    create(options = {}) {
      return request('project:create', {
        ...options,
        slides: options.slideCount ?? options.slides,
      });
    },
    getFiles() {
      return request('project:getFiles');
    },
    getMeta() {
      return request('project:getMeta');
    },
    getSlides() {
      return request('project:getSlides');
    },
    getState() {
      return request('project:getState');
    },
    onChanged(callback) {
      return subscribe('project/changed', (event) => {
        callback({
          kind: 'project_changed',
          meta: event.meta,
          state: event.state,
          file: event.file || '',
        });
      });
    },
    open(options = {}) {
      return request('project:open', options);
    },
  },
  preview: {
    getDocument() {
      return request('preview:getDocument');
    },
    getMeta() {
      return request('preview:getMeta');
    },
    onChanged(callback) {
      return subscribe('preview/changed', (event) => {
        callback({
          kind: 'preview_changed',
          meta: event.meta,
          file: event.file || '',
        });
      });
    },
    refresh() {
      return request('preview:refresh');
    },
  },
  actions: {
    invoke(actionId, args = {}) {
      return request('action:invoke', { actionId, args });
    },
    list() {
      return request('action:list');
    },
    onEvent(callback) {
      return subscribeToActionEvents(callback);
    },
  },
  system: {
    chooseDirectory() {
      return ipcRenderer.invoke('presentation:choose-directory');
    },
    onNativeMenuCommand(callback) {
      return subscribeNative('presentation:native-menu-command', callback);
    },
    openExternal(targetUrl) {
      return ipcRenderer.invoke('presentation:open-external', String(targetUrl || ''));
    },
    readClipboardText() {
      return ipcRenderer.invoke('presentation:clipboard-read-text');
    },
    revealInFinder(targetPath) {
      return ipcRenderer.invoke('presentation:reveal-in-finder', targetPath);
    },
    saveDialog(options = {}) {
      return ipcRenderer.invoke('presentation:save-dialog', options);
    },
    writeClipboardText(text = '') {
      return ipcRenderer.invoke('presentation:clipboard-write-text', String(text || ''));
    },
  },
  terminal: {
    clear() {
      return request('terminal:clear');
    },
    getMeta() {
      return request('terminal:getMeta');
    },
    onEvent(callback) {
      return subscribe(null, (event) => {
        if (typeof event.channel === 'string' && event.channel.startsWith('terminal/')) {
          callback(event);
        }
      });
    },
    onOutput(callback) {
      return subscribe('terminal/output', callback);
    },
    onContextMenuAction(callback) {
      return subscribeNative('presentation:terminal-context-menu-action', callback);
    },
    reveal(targetPath) {
      return request('terminal:reveal', { targetPath });
    },
    resize(cols, rows) {
      return request('terminal:resize', { cols, rows });
    },
    send(data) {
      ipcRenderer.send('presentation:terminal-input', { data });
    },
    showContextMenu(options = {}) {
      return ipcRenderer.invoke('presentation:terminal-context-menu', options);
    },
    start() {
      return request('terminal:start', { mode: 'shell' });
    },
    stop() {
      return request('terminal:stop');
    },
  },
});
