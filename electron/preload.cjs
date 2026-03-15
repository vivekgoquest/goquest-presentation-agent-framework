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

contextBridge.exposeInMainWorld('electron', {
  events: {
    onEvent(callback) {
      return subscribe(null, callback);
    },
  },
  project: {
    create(options) {
      return request('project:create', options);
    },
    getFiles() {
      return request('project:getFiles');
    },
    getPreviewHtml() {
      return request('project:getPreviewHtml');
    },
    getMeta() {
      return request('project:getMeta');
    },
    getState() {
      return request('project:getState');
    },
    open(options) {
      return request('project:open', options);
    },
  },
  runtime: {
    capture(options) {
      return request('runtime:capture', options);
    },
    check(options) {
      return request('runtime:check', options);
    },
    export(options) {
      return request('runtime:export', options);
    },
    finalize(options) {
      return request('runtime:finalize', options);
    },
  },
  system: {
    chooseDirectory() {
      return ipcRenderer.invoke('presentation:choose-directory');
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
    reveal(targetPath) {
      return request('terminal:reveal', { targetPath });
    },
    resize(cols, rows) {
      return request('terminal:resize', { cols, rows });
    },
    send(data) {
      return request('terminal:input', { data });
    },
    start(mode) {
      return request('terminal:start', { mode });
    },
    stop() {
      return request('terminal:stop');
    },
  },
  watch: {
    onChange(callback) {
      return subscribe('watch/change', callback);
    },
  },
});
