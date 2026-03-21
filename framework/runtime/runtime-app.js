import express from 'express';
import { existsSync, statSync } from 'fs';
import { resolve, sep } from 'path';
import {
  FRAMEWORK_ROOT,
  PROJECT_PREVIEW_PATH,
  createPresentationTarget,
  getPresentationPreviewPath,
  getProjectPaths,
  resolveProjectFrameworkAssetAbs,
} from './deck-paths.js';
import { renderPresentationHtml } from './deck-assemble.js';
import { renderPresentationFailureHtml } from './preview-state-page.js';

function isInsideRoot(targetAbs, rootAbs) {
  const normalizedTarget = resolve(targetAbs);
  const normalizedRoot = resolve(rootAbs);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${sep}`);
}

function sendSafeFile(res, absPath, rootAbs) {
  const roots = Array.isArray(rootAbs) ? rootAbs : [rootAbs];
  const allowed = roots.some((candidateRoot) => isInsideRoot(absPath, candidateRoot));
  if (!allowed || !existsSync(absPath) || !statSync(absPath).isFile()) {
    res.status(404).end();
    return;
  }

  res.sendFile(absPath);
}

function getCurrentTargetResolver(options = {}) {
  if (typeof options.getCurrentTarget === 'function') {
    return () => {
      const nextTarget = options.getCurrentTarget();
      return nextTarget ? createPresentationTarget(nextTarget) : null;
    };
  }

  const normalizedCurrentTarget = options.currentTarget
    ? createPresentationTarget(options.currentTarget)
    : null;
  return () => normalizedCurrentTarget;
}

function getCurrentProjectTarget(resolveCurrentTarget) {
  const target = resolveCurrentTarget();
  return target?.kind === 'project' ? target : null;
}

export function renderPresentationHtmlResponse(targetInput, options = {}) {
  const { decorateHtml } = options;
  const target = createPresentationTarget(targetInput);
  const rendered = renderPresentationHtml(target);
  const html = typeof decorateHtml === 'function'
    ? decorateHtml(rendered.html, target)
    : rendered.html;

  return {
    rendered,
    html,
  };
}

function sendPresentationHtml(res, targetInput, options = {}) {
  try {
    const { html } = renderPresentationHtmlResponse(targetInput, options);
    res.type('html').send(html);
  } catch (err) {
    const fallback = renderPresentationFailureHtml(targetInput, err);
    const statusCode = fallback.kind === 'policy_error' ? 400 : 200;
    res.status(statusCode).type('html').send(fallback.html);
  }
}

export function createRuntimeApp(options = {}) {
  const {
    decorateHtml,
    onExport,
  } = options;
  const app = express();
  const resolveCurrentTarget = getCurrentTargetResolver(options);

  app.use(express.json());

  app.get('/', (req, res) => {
    res.status(404).type('text/plain').send('Web operator mode was removed. Launch Electron with npm run start.');
  });
  app.get(PROJECT_PREVIEW_PATH, (req, res) => {
    const currentProjectTarget = getCurrentProjectTarget(resolveCurrentTarget);
    if (!currentProjectTarget) {
      res.status(404).type('html').send(renderPolicyErrorPage('No project is currently open.'));
      return;
    }
    sendPresentationHtml(res, currentProjectTarget, { decorateHtml });
  });
  app.get(/^\/project-files\/(.+)$/, (req, res) => {
    const currentProjectTarget = getCurrentProjectTarget(resolveCurrentTarget);
    if (!currentProjectTarget) {
      res.status(404).end();
      return;
    }

    const projectPaths = getProjectPaths(currentProjectTarget.projectRootAbs);
    const relPath = req.params[0];
    const absPath = resolve(projectPaths.projectRootAbs, relPath);
    sendSafeFile(res, absPath, projectPaths.projectRootAbs);
  });
  app.get(/^\/project-framework\/(.+)$/, (req, res) => {
    const currentProjectTarget = getCurrentProjectTarget(resolveCurrentTarget);
    if (!currentProjectTarget) {
      res.status(404).end();
      return;
    }

    const projectPaths = getProjectPaths(currentProjectTarget.projectRootAbs);
    try {
      const absPath = resolveProjectFrameworkAssetAbs(projectPaths, req.params[0]);
      sendSafeFile(res, absPath, [
        FRAMEWORK_ROOT,
        projectPaths.frameworkBaseAbs,
        projectPaths.frameworkOverridesAbs,
      ]);
    } catch {
      res.status(404).end();
    }
  });

  if (typeof onExport === 'function') {
    app.post('/api/export', onExport);
  }

  return app;
}

function startServer(app, host = '127.0.0.1', port = 0) {
  return new Promise((resolvePromise, reject) => {
    const server = app.listen(port, host, () => resolvePromise(server));
    server.once('error', reject);
  });
}

function closeServer(server) {
  return new Promise((resolvePromise, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }

      resolvePromise();
    });
  });
}

export async function withRuntimeServer(targetInput, fn, options = {}) {
  const target = createPresentationTarget(targetInput);
  const app = createRuntimeApp({
    ...options,
    currentTarget: target.kind === 'project' ? target : options.currentTarget,
  });
  const host = '127.0.0.1';
  const server = await startServer(app, host, 0);
  const address = server.address();
  const baseUrl = `http://${host}:${address.port}`;
  const previewUrl = `${baseUrl}${getPresentationPreviewPath(target)}`;

  try {
    return await fn({ app, server, baseUrl, previewUrl, target });
  } finally {
    await closeServer(server);
  }
}
