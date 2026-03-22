const { contextBridge, ipcRenderer } = require('electron');

const ACTION_EVENT_STATUS_BY_CHANNEL = Object.freeze({
  'action/queued': 'queued',
  'action/running': 'running',
  'action/needs_input': 'needs_input',
  'action/succeeded': 'succeeded',
  'action/failed': 'failed',
});

const BUILD_OPERATION_BY_ACTION_ID = Object.freeze({
  build_presentation: 'finalize',
  check_presentation: 'check',
  capture_screenshots: 'capture',
});

const REVIEW_OPERATION_BY_ACTION_ID = Object.freeze({
  review_presentation: 'run',
  revise_presentation: 'revise',
  fix_warnings: 'fix_warnings',
});

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

function isActionLifecycleEvent(event) {
  return typeof event?.channel === 'string' && event.channel.startsWith('action/');
}

function toActionLifecycleStatus(event) {
  return ACTION_EVENT_STATUS_BY_CHANNEL[event?.channel] || 'running';
}

function toBuildEvent(event) {
  return {
    kind: 'build',
    operation: BUILD_OPERATION_BY_ACTION_ID[event.actionId] || 'finalize',
    status: toActionLifecycleStatus(event),
    message: event.message || '',
    detail: event.detail || '',
    runId: event.runId || '',
  };
}

function toExportEvent(event) {
  return {
    kind: 'export',
    status: toActionLifecycleStatus(event),
    message: event.message || '',
    detail: event.detail || '',
    runId: event.runId || '',
  };
}

function toReviewEvent(event) {
  return {
    kind: 'review',
    operation: REVIEW_OPERATION_BY_ACTION_ID[event.actionId] || 'run',
    status: toActionLifecycleStatus(event),
    message: event.message || '',
    detail: event.detail || '',
    runId: event.runId || '',
  };
}

function subscribeToActionDomain(predicate, mapper, callback) {
  return subscribe(null, (event) => {
    if (!isActionLifecycleEvent(event) || !predicate(event)) {
      return;
    }
    callback(mapper(event));
  });
}

contextBridge.exposeInMainWorld('electron', {
  events: {
    onEvent(callback) {
      return subscribe(null, callback);
    },
  },
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
  build: {
    captureScreenshots(options = {}) {
      return request('build:captureScreenshots', options);
    },
    check(options = {}) {
      return request('build:check', options);
    },
    finalize(options = {}) {
      return request('build:finalize', options);
    },
    onEvent(callback) {
      return subscribeToActionDomain(
        (event) => Object.prototype.hasOwnProperty.call(BUILD_OPERATION_BY_ACTION_ID, event.actionId),
        toBuildEvent,
        callback
      );
    },
  },
  export: {
    onEvent(callback) {
      return subscribeToActionDomain(
        (event) => event.actionId === 'export_presentation',
        toExportEvent,
        callback
      );
    },
    start(options = {}) {
      return request('export:start', options);
    },
  },
  review: {
    fixWarnings() {
      return request('review:fixWarnings');
    },
    getAvailability() {
      return request('review:getAvailability');
    },
    onEvent(callback) {
      return subscribeToActionDomain(
        (event) => Object.prototype.hasOwnProperty.call(REVIEW_OPERATION_BY_ACTION_ID, event.actionId),
        toReviewEvent,
        callback
      );
    },
    revise() {
      return request('review:revise');
    },
    run() {
      return request('review:run');
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
      return subscribeToActionDomain(
        () => true,
        (event) => event,
        callback
      );
    },
  },
  system: {
    chooseDirectory() {
      return ipcRenderer.invoke('presentation:choose-directory');
    },
    revealInFinder(targetPath) {
      return ipcRenderer.invoke('presentation:reveal-in-finder', targetPath);
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
    start() {
      return request('terminal:start', { mode: 'shell' });
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
