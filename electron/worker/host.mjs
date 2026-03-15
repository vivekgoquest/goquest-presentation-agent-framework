import { pathToFileURL } from 'url';
import { capturePresentation } from '../../framework/runtime/services/capture-service.mjs';
import { runDeckCheck } from '../../framework/runtime/services/check-service.mjs';
import { exportDeckPdf } from '../../framework/runtime/services/export-service.mjs';
import { finalizePresentation } from '../../framework/runtime/services/finalize-service.mjs';
import {
  createErrorResponse,
  createSuccessResponse,
  createWorkerEvent,
  normalizeWorkerRequest,
  WORKER_REQUEST_CHANNELS,
} from './ipc-contract.mjs';
import { createProjectService } from './project-service.mjs';
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
  const projectService = createProjectService({
    onProjectChanged({ paths }) {
      terminalService.stop({ announce: false, signal: 'project-switch' });
      terminalService.setProjectContext(paths?.projectRootAbs || null);
      watchService.setProjectRoot(paths?.projectRootAbs || null);
      emit(createWorkerEvent('project/changed', {
        meta: projectService.getMeta(),
        state: projectService.getState(),
      }));
    },
  });

  const stopTerminalEvents = terminalService.onEvent((event) => emit(event));
  const stopWatchEvents = watchService.onEvent((event) => emit(event));

  function requireActiveTarget() {
    return projectService.requireActiveProjectTarget();
  }

  async function dispatch(channel, payload = {}) {
    switch (channel) {
      case WORKER_REQUEST_CHANNELS.PROJECT_CREATE:
        return projectService.createProject(payload);
      case WORKER_REQUEST_CHANNELS.PROJECT_OPEN:
        return projectService.openProject(payload);
      case WORKER_REQUEST_CHANNELS.PROJECT_GET_META:
        return projectService.getMeta();
      case WORKER_REQUEST_CHANNELS.PROJECT_GET_STATE:
        return projectService.getState();
      case WORKER_REQUEST_CHANNELS.PROJECT_GET_FILES:
        return projectService.getFiles();
      case WORKER_REQUEST_CHANNELS.PROJECT_GET_PREVIEW_HTML:
        return projectService.getPreviewHtml();
      case WORKER_REQUEST_CHANNELS.RUNTIME_CAPTURE: {
        const target = requireActiveTarget();
        const outputDir = payload.outputDir || projectService.getOutputPaths().outputDirAbs;
        return capturePresentation(target, outputDir, payload.options || {});
      }
      case WORKER_REQUEST_CHANNELS.RUNTIME_CHECK:
        return runDeckCheck(requireActiveTarget(), payload.options || {});
      case WORKER_REQUEST_CHANNELS.RUNTIME_EXPORT: {
        const target = requireActiveTarget();
        return exportDeckPdf(target, payload.outputFile || null, payload.options || {});
      }
      case WORKER_REQUEST_CHANNELS.RUNTIME_FINALIZE:
        return finalizePresentation(requireActiveTarget(), payload.options || {});
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
        throw new Error(`Unsupported worker request channel: ${channel}`);
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
