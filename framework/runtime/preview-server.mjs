import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createProjectRef, getProjectPaths } from './deck-paths.js';
import { createRuntimeApp } from './runtime-app.js';

const execFileAsync = promisify(execFile);
const PREVIEW_SIGNALS = Object.freeze(['SIGINT', 'SIGTERM']);

function startServer(app, host = '127.0.0.1', port = 0) {
  return new Promise((resolvePromise, reject) => {
    const server = app.listen(port, host, () => resolvePromise(server));
    server.once('error', reject);
  });
}

function closeServer(server) {
  return new Promise((resolvePromise, reject) => {
    if (!server.listening) {
      resolvePromise();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolvePromise();
    });
  });
}

function buildPreviewUrl(projectRoot, host, server) {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Preview server did not expose a TCP address.');
  }

  return `http://${host}:${address.port}${getProjectPaths(projectRoot).previewPath}`;
}

function getOpenCommand(previewUrl, platform = process.platform) {
  if (platform === 'darwin') {
    return ['open', [previewUrl]];
  }

  if (platform === 'win32') {
    return ['cmd', ['/c', 'start', '', previewUrl]];
  }

  return ['xdg-open', [previewUrl]];
}

async function openPreviewInBrowser(previewUrl, options = {}) {
  const [command, args] = getOpenCommand(previewUrl, options.platform || process.platform);
  const runner = options.execFileAsync || execFileAsync;
  await runner(command, args);
}

function createDefaultApp(projectRoot) {
  return createRuntimeApp({
    currentTarget: createProjectRef(projectRoot),
  });
}

export async function previewPresentation(projectRootInput, options = {}) {
  const projectRoot = createProjectRef(projectRootInput).projectRootAbs;
  const mode = String(options.mode || 'serve').trim().toLowerCase() || 'serve';
  if (!['serve', 'open'].includes(mode)) {
    throw new Error(`Unsupported preview mode "${mode}". Use "serve" or "open".`);
  }

  const host = options.host || '127.0.0.1';
  const port = Number.isInteger(options.port) ? options.port : 0;
  const app = typeof options.appFactory === 'function'
    ? options.appFactory({ projectRoot })
    : createDefaultApp(projectRoot);
  const server = await startServer(app, host, port);
  const previewUrl = buildPreviewUrl(projectRoot, host, server);

  let resolveClosed;
  const waitUntilClose = new Promise((resolvePromise) => {
    resolveClosed = resolvePromise;
  });
  server.once('close', () => resolveClosed());

  let stopPromise = null;
  let removeSignalHandlers = () => {};

  const stop = async () => {
    if (stopPromise) {
      return stopPromise;
    }

    removeSignalHandlers();
    stopPromise = closeServer(server);
    return stopPromise;
  };

  if (options.installSignalHandlers !== false) {
    const onSignal = () => {
      void stop();
    };

    for (const signal of PREVIEW_SIGNALS) {
      process.on(signal, onSignal);
    }

    removeSignalHandlers = () => {
      for (const signal of PREVIEW_SIGNALS) {
        process.off(signal, onSignal);
      }
      removeSignalHandlers = () => {};
    };

    server.once('close', removeSignalHandlers);
  }

  if (mode === 'open') {
    try {
      const openPreview = options.openPreview || openPreviewInBrowser;
      await openPreview(previewUrl, options);
    } catch (error) {
      await stop();
      throw error;
    }
  }

  return {
    status: 'pass',
    projectRoot,
    previewUrl,
    summary: mode === 'open'
      ? 'Preview opened in the default browser.'
      : 'Preview server started.',
    stop,
    waitUntilClose,
  };
}
