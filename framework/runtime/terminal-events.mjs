export const TERMINAL_EVENT_CHANNELS = Object.freeze({
  CLEAR: 'terminal/clear',
  READY: 'terminal/ready',
  META: 'terminal/meta',
  OUTPUT: 'terminal/output',
  EXIT: 'terminal/exit',
  ERROR: 'terminal/error',
});

function cloneMeta(meta = {}) {
  return {
    ...meta,
  };
}

export function createTerminalClearEvent() {
  return {
    channel: TERMINAL_EVENT_CHANNELS.CLEAR,
  };
}

export function createTerminalReadyEvent(meta) {
  return {
    channel: TERMINAL_EVENT_CHANNELS.READY,
    meta: cloneMeta(meta),
  };
}

export function createTerminalMetaEvent(meta) {
  return {
    channel: TERMINAL_EVENT_CHANNELS.META,
    meta: cloneMeta(meta),
  };
}

export function createTerminalOutputEvent(data) {
  return {
    channel: TERMINAL_EVENT_CHANNELS.OUTPUT,
    data: String(data ?? ''),
  };
}

export function createTerminalExitEvent({ code = null, signal = null, mode = null } = {}) {
  return {
    channel: TERMINAL_EVENT_CHANNELS.EXIT,
    code,
    signal,
    mode,
  };
}

export function createTerminalErrorEvent(message) {
  return {
    channel: TERMINAL_EVENT_CHANNELS.ERROR,
    message: String(message ?? ''),
  };
}

export function toTerminalSocketMessage(event) {
  switch (event?.channel) {
    case TERMINAL_EVENT_CHANNELS.CLEAR:
      return { type: 'clear' };
    case TERMINAL_EVENT_CHANNELS.READY:
      return { type: 'ready', ...cloneMeta(event.meta) };
    case TERMINAL_EVENT_CHANNELS.META:
      return { type: 'meta', ...cloneMeta(event.meta) };
    case TERMINAL_EVENT_CHANNELS.OUTPUT:
      return { type: 'output', data: event.data };
    case TERMINAL_EVENT_CHANNELS.EXIT:
      return {
        type: 'exit',
        code: event.code ?? null,
        signal: event.signal ?? null,
        mode: event.mode ?? null,
      };
    case TERMINAL_EVENT_CHANNELS.ERROR:
      return {
        type: 'error',
        message: event.message,
      };
    default:
      return {
        type: 'meta',
      };
  }
}
