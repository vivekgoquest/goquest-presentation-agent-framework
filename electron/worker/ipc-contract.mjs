import { ACTION_EVENT_CHANNELS } from '../../framework/application/action-events.mjs';
import { TERMINAL_EVENT_CHANNELS } from '../../framework/runtime/terminal-events.mjs';

export const WORKER_REQUEST_CHANNELS = Object.freeze({
  PROJECT_CREATE: 'project:create',
  PROJECT_OPEN: 'project:open',
  PROJECT_GET_META: 'project:getMeta',
  PROJECT_GET_STATE: 'project:getState',
  PROJECT_GET_FILES: 'project:getFiles',
  PROJECT_GET_SLIDES: 'project:getSlides',
  PREVIEW_GET_DOCUMENT: 'preview:getDocument',
  PREVIEW_GET_META: 'preview:getMeta',
  PREVIEW_REFRESH: 'preview:refresh',
  BUILD_CHECK: 'build:check',
  BUILD_FINALIZE: 'build:finalize',
  BUILD_CAPTURE_SCREENSHOTS: 'build:captureScreenshots',
  EXPORT_START: 'export:start',
  REVIEW_RUN: 'review:run',
  REVIEW_REVISE: 'review:revise',
  REVIEW_FIX_WARNINGS: 'review:fixWarnings',
  REVIEW_GET_AVAILABILITY: 'review:getAvailability',
  ACTION_LIST: 'action:list',
  ACTION_INVOKE: 'action:invoke',
  TERMINAL_START: 'terminal:start',
  TERMINAL_STOP: 'terminal:stop',
  TERMINAL_CLEAR: 'terminal:clear',
  TERMINAL_INPUT: 'terminal:input',
  TERMINAL_RESIZE: 'terminal:resize',
  TERMINAL_REVEAL: 'terminal:reveal',
  TERMINAL_GET_META: 'terminal:getMeta',
});

export const WORKER_EVENT_CHANNELS = Object.freeze({
  ...ACTION_EVENT_CHANNELS,
  ...TERMINAL_EVENT_CHANNELS,
  PROJECT_CHANGED: 'project/changed',
  PREVIEW_CHANGED: 'preview/changed',
  WATCH_CHANGE: 'watch/change',
});

export function serializeError(error) {
  return {
    message: error?.message || 'Unexpected worker error.',
    code: error?.code || null,
    needsInitialization: Boolean(error?.needsInitialization),
    cancelled: Boolean(error?.cancelled),
  };
}

export function createSuccessResponse(request, data) {
  return {
    kind: 'response',
    ok: true,
    requestId: request?.requestId ?? null,
    channel: request?.channel || '',
    data,
  };
}

export function createErrorResponse(request, error) {
  return {
    kind: 'response',
    ok: false,
    requestId: request?.requestId ?? null,
    channel: request?.channel || '',
    error: serializeError(error),
  };
}

export function createWorkerEvent(channel, data = {}) {
  return {
    kind: 'event',
    channel,
    ...data,
  };
}

export function normalizeWorkerRequest(message) {
  if (!message || typeof message !== 'object' || typeof message.channel !== 'string') {
    throw new Error('Worker requests must include a channel string.');
  }

  return {
    requestId: message.requestId ?? null,
    channel: message.channel,
    payload: message.payload && typeof message.payload === 'object'
      ? message.payload
      : {},
  };
}
