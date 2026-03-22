import { pathToFileURL } from 'url';
import { createActionService } from '../../framework/application/action-service.mjs';
import { createAgentActionAdapter } from '../../framework/application/agent-action-adapter.mjs';
import { createElectronRequestService } from '../../framework/application/electron-request-service.mjs';
import { createPresentationActionAdapter } from '../../framework/application/presentation-action-adapter.mjs';
import { createProjectQueryService } from '../../framework/application/project-query-service.mjs';
import {
  createErrorResponse,
  createSuccessResponse,
  createWorkerEvent,
  normalizeWorkerRequest,
  WORKER_EVENT_CHANNELS,
  WORKER_REQUEST_CHANNELS,
} from './ipc-contract.mjs';
import { createTerminalService } from './terminal-service.mjs';
import { createWatchService } from './watch-service.mjs';

export function createElectronWorkerHost(options = {}) {
  const frameworkRoot = options.frameworkRoot || process.cwd();
  const listeners = new Set();

  function emit(event) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  const terminalService = createTerminalService({ frameworkRoot });
  const watchService = createWatchService({ frameworkRoot });
  const presentationAdapter = createPresentationActionAdapter();

  function emitProjectChanged(extra = {}) {
    emit(createWorkerEvent(WORKER_EVENT_CHANNELS.PROJECT_CHANGED, {
      meta: projectService.getMeta(),
      state: projectService.getState(),
      ...extra,
    }));
  }

  function emitPreviewChanged(extra = {}) {
    if (!projectService.getMeta().active) {
      return;
    }

    emit(createWorkerEvent(WORKER_EVENT_CHANNELS.PREVIEW_CHANGED, {
      meta: projectService.getPreviewMeta(),
      ...extra,
    }));
  }

  const projectService = createProjectQueryService({
    frameworkRoot,
    onProjectChanged({ paths }) {
      terminalService.stop({ announce: false, signal: 'project-switch' });
      terminalService.setProjectContext(paths?.projectRootAbs || null);
      watchService.setProjectRoot(paths?.projectRootAbs || null);
      emitProjectChanged({ source: 'project' });
      emitPreviewChanged({ source: 'project' });
    },
  });

  const stopTerminalEvents = terminalService.onEvent((event) => emit(event));
  const stopWatchEvents = watchService.onEvent((event) => {
    emit(event);
    if (projectService.getMeta().active) {
      emitProjectChanged({ file: event.file, source: 'watch' });
      emitPreviewChanged({ file: event.file, source: 'watch' });
    }
  });
  const actionService = createActionService({
    frameworkRoot,
    projectService,
    terminalService,
    presentationAdapter,
    agentAdapter: createAgentActionAdapter({ frameworkRoot }),
    emitEvent(event) {
      emit(createWorkerEvent(event.channel, event));
    },
  });
  const requestService = createElectronRequestService({
    projectService,
    actionService,
    onPreviewRefresh() {
      emitPreviewChanged({ source: 'refresh' });
    },
  });

  async function dispatch(channel, payload = {}) {
    switch (channel) {
      case WORKER_REQUEST_CHANNELS.TERMINAL_GET_META:
        return terminalService.getMeta();
      case WORKER_REQUEST_CHANNELS.TERMINAL_START:
        return terminalService.start(payload.mode || 'shell');
      case WORKER_REQUEST_CHANNELS.TERMINAL_STOP:
        return terminalService.stop(payload.options || {});
      case WORKER_REQUEST_CHANNELS.TERMINAL_CLEAR:
        return terminalService.clear();
      case WORKER_REQUEST_CHANNELS.TERMINAL_INPUT:
        return terminalService.send(payload.data || '');
      case WORKER_REQUEST_CHANNELS.TERMINAL_RESIZE:
        return terminalService.resize(payload.cols, payload.rows);
      case WORKER_REQUEST_CHANNELS.TERMINAL_REVEAL:
        return terminalService.revealPath(payload.targetPath || payload.relativePath || '.');
      default:
        return requestService.handleRequest(channel, payload);
    }
  }

  return {
    async dispose() {
      stopTerminalEvents();
      stopWatchEvents();
      watchService.dispose();
      terminalService.dispose();
    },
    async handleRequest(message) {
      const request = normalizeWorkerRequest(message);

      try {
        const data = await dispatch(request.channel, request.payload);
        return createSuccessResponse(request, data);
      } catch (error) {
        return createErrorResponse(request, error);
      }
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export async function attachElectronWorkerProcess(options = {}) {
  const host = createElectronWorkerHost(options);

  const sendMessage = (message) => {
    if (process.parentPort?.postMessage) {
      process.parentPort.postMessage(message);
      return;
    }

    if (typeof process.send === 'function') {
      process.send(message);
    }
  };

  const unsubscribe = host.onEvent((event) => {
    sendMessage({
      kind: 'event',
      ...event,
    });
  });

  const onMessage = async (rawMessage) => {
    if (!rawMessage || typeof rawMessage !== 'object' || typeof rawMessage.channel !== 'string') {
      return;
    }

    const response = await host.handleRequest(rawMessage);
    sendMessage(response);
  };

  if (process.parentPort?.on) {
    process.parentPort.on('message', (event) => {
      onMessage(event?.data);
    });
  } else {
    process.on('message', onMessage);
  }

  const shutdown = async () => {
    unsubscribe();
    await host.dispose();
    process.exit(0);
  };

  process.on('disconnect', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  attachElectronWorkerProcess({
    frameworkRoot: process.env.PRESENTATION_FRAMEWORK_ROOT || process.cwd(),
  });
}
