import express from 'express';
import { existsSync, readdirSync, statSync } from 'fs';
import { resolve, sep } from 'path';
import {
  FRAMEWORK_ROOT,
  PROJECT_SYSTEM_DIRNAME,
  PROJECT_PREVIEW_PATH,
  createPresentationTarget,
  createProjectRef,
  createWorkspaceRef,
  getPresentationPaths,
  getPresentationPreviewPath,
  getProjectPaths,
  resolveProjectFrameworkAssetAbs,
} from './deck-paths.js';
import { renderPresentationHtml } from './deck-assemble.js';
import { classifyPolicyErrorMessage, getProjectState } from './project-state.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderPolicyErrorPage(message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Deck Policy Violation</title>
  <style>
    body { font-family: "Aptos", "Inter", "Segoe UI", sans-serif; max-width: 760px; margin: 4rem auto; color: #1d1d1f; }
    pre { white-space: pre-wrap; background: #f5f5f7; padding: 1rem 1.25rem; border-radius: 12px; }
    p { line-height: 1.6; }
  </style>
</head>
<body>
  <h1>Deck Policy Violation</h1>
  <p>This deck is blocked until its workspace follows the framework contract. Ask the agent to fix the reported issue in theme.css or the slide source folders, then reload this preview.</p>
  <pre>${escapeHtml(message)}</pre>
</body>
</html>`;
}

function renderProjectOnboardingPage(state) {
  const outlineRow = state.outlineRequired
    ? `<li><strong>Outline</strong><span>${state.outlineComplete ? 'Locked' : 'Still scaffolded'}</span></li>`
    : '';
  const slideStatus = state.remainingSlides.length > 0
    ? `${state.remainingSlides.length} slide${state.remainingSlides.length === 1 ? '' : 's'} still scaffolded`
    : 'All slide sources have been drafted';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(state.title)} • Build In Progress</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #07111e;
      --panel: rgba(17, 28, 45, 0.92);
      --line: rgba(173, 189, 217, 0.18);
      --text: #eef4ff;
      --muted: #a2b3ce;
      --accent: #7bb7ff;
      --chip: rgba(123, 183, 255, 0.14);
    }

    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 2rem;
      font-family: "Aptos", "Inter", "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(123, 183, 255, 0.22), transparent 26%),
        linear-gradient(180deg, #060e19 0%, var(--bg) 100%);
      color: var(--text);
    }

    main {
      width: min(860px, calc(100vw - 3rem));
      padding: 2rem;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: linear-gradient(180deg, rgba(22, 34, 53, 0.96), var(--panel));
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.32);
    }

    h1 {
      margin: 0.25rem 0 0;
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1.02;
    }

    p {
      margin: 0;
      line-height: 1.6;
      color: var(--muted);
    }

    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.4rem 0.72rem;
      border-radius: 999px;
      background: var(--chip);
      border: 1px solid rgba(123, 183, 255, 0.18);
      color: var(--accent);
      font-size: 0.82rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .lede {
      margin-top: 1rem;
      max-width: 60ch;
      font-size: 1.02rem;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
      margin-top: 1.5rem;
    }

    .card {
      padding: 1rem 1.1rem;
      border: 1px solid var(--line);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.03);
    }

    .card strong {
      display: block;
      margin-bottom: 0.28rem;
      font-size: 0.82rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }

    .card span {
      font-size: 1.18rem;
      font-weight: 700;
    }

    .checklist {
      list-style: none;
      padding: 0;
      margin: 1.65rem 0 0;
      display: grid;
      gap: 0.8rem;
    }

    .checklist li {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding: 0.88rem 1rem;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.02);
    }

    .checklist li span {
      color: var(--muted);
      text-align: right;
    }

    .next-step {
      margin-top: 1.4rem;
      padding: 1rem 1.1rem;
      border-radius: 16px;
      background: rgba(123, 183, 255, 0.1);
      border: 1px solid rgba(123, 183, 255, 0.2);
    }

    .next-step strong {
      display: block;
      margin-bottom: 0.35rem;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--accent);
    }

    code {
      padding: 0.14rem 0.42rem;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text);
    }
  </style>
</head>
<body>
  <main>
    <span class="eyebrow">Project onboarding</span>
    <h1>${escapeHtml(state.title)} is still being assembled</h1>
    <p class="lede">This project is not broken. It is still scaffolded, so preview, export, and finalize stay blocked until the core authoring files are filled in.</p>

    <div class="grid">
      <div class="card">
        <strong>Status</strong>
        <span>${escapeHtml(state.status.replaceAll('_', ' '))}</span>
      </div>
      <div class="card">
        <strong>Slides complete</strong>
        <span>${state.slidesComplete}/${state.slidesTotal}</span>
      </div>
      <div class="card">
        <strong>PDF</strong>
        <span>${state.pdfReady ? 'Ready' : 'Not generated yet'}</span>
      </div>
    </div>

    <ul class="checklist">
      <li><strong>Brief</strong><span>${state.briefComplete ? 'Complete' : 'Still scaffolded'}</span></li>
      ${outlineRow}
      <li><strong>Slides</strong><span>${escapeHtml(slideStatus)}</span></li>
      <li><strong>Outputs</strong><span>${state.pdfReady ? 'PDF ready' : 'No PDF yet'}</span></li>
    </ul>

    <div class="next-step">
      <strong>Next step</strong>
      <p>${escapeHtml(state.nextStep)}</p>
    </div>
  </main>
</body>
</html>`;
}

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

const PRIMARY_PROJECT_PATHS = new Set([
  'brief.md',
  'outline.md',
  'revisions.md',
  'theme.css',
  'assets',
  'slides',
  'outputs',
]);

function deriveSlideId(relativePath) {
  const match = relativePath.match(/^slides\/\d{3}-([a-z0-9-]+)(?:\/|$)/);
  return match ? match[1] : '';
}

function buildProjectTreeNode(absPath, rootAbs) {
  const entries = readdirSync(absPath, { withFileTypes: true })
    .filter((entry) => !['.DS_Store', 'Thumbs.db'].includes(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const relativePath = absPath === rootAbs ? '.' : absPath.slice(rootAbs.length + 1).replace(/\\/g, '/');
  const systemManaged = relativePath === PROJECT_SYSTEM_DIRNAME || relativePath.startsWith(`${PROJECT_SYSTEM_DIRNAME}/`);
  const slideId = deriveSlideId(relativePath);
  const isDirectory = absPath === rootAbs || statSync(absPath).isDirectory();

  let kind = 'directory';
  if (relativePath === '.') {
    kind = 'root';
  } else if (systemManaged) {
    kind = isDirectory ? 'system-directory' : 'system-file';
  } else if (slideId && isDirectory && /^slides\/\d{3}-[a-z0-9-]+$/.test(relativePath)) {
    kind = 'slide-directory';
  } else if (slideId && /\/slide\.html$/.test(relativePath)) {
    kind = 'slide-file';
  } else if (relativePath.startsWith('outputs/')) {
    kind = isDirectory ? 'output-directory' : 'output-file';
  } else if (!isDirectory) {
    kind = 'file';
  }

  return {
    name: absPath === rootAbs ? '.' : absPath.split(sep).pop(),
    relativePath,
    kind,
    isDirectory,
    isSystem: systemManaged,
    isPrimary: PRIMARY_PROJECT_PATHS.has(relativePath),
    slideId: slideId || null,
    children: entries.map((entry) => {
      const childAbs = resolve(absPath, entry.name);
      if (entry.isDirectory()) {
        return buildProjectTreeNode(childAbs, rootAbs);
      }
      const childRelativePath = childAbs.slice(rootAbs.length + 1).replace(/\\/g, '/');
      const childSystemManaged = childRelativePath === PROJECT_SYSTEM_DIRNAME || childRelativePath.startsWith(`${PROJECT_SYSTEM_DIRNAME}/`);
      const childSlideId = deriveSlideId(childRelativePath);
      return {
        name: entry.name,
        relativePath: childRelativePath,
        kind: childSystemManaged
          ? 'system-file'
          : childSlideId && /\/slide\.html$/.test(childRelativePath)
            ? 'slide-file'
            : childRelativePath.startsWith('outputs/')
              ? 'output-file'
              : 'file',
        isDirectory: false,
        isSystem: childSystemManaged,
        isPrimary: PRIMARY_PROJECT_PATHS.has(childRelativePath),
        slideId: childSlideId || null,
      };
    }),
  };
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

export function renderWorkspaceHtmlResponse(workspaceRef, options = {}) {
  const normalized = createWorkspaceRef(workspaceRef.ownerType, workspaceRef.ownerName);
  return renderPresentationHtmlResponse(normalized, options);
}

function sendPresentationHtml(res, targetInput, options = {}) {
  try {
    const { html } = renderPresentationHtmlResponse(targetInput, options);
    res.type('html').send(html);
  } catch (err) {
    const target = createPresentationTarget(targetInput);
    if (target.kind === 'project') {
      const category = classifyPolicyErrorMessage(err?.message || '');
      if (category.startsWith('incomplete_')) {
        const state = getProjectState(target.projectRootAbs);
        res.type('html').send(renderProjectOnboardingPage(state));
        return;
      }
    }

    res.status(400).type('html').send(renderPolicyErrorPage(err.message));
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

  app.get('/', (req, res, next) => next());
  app.get(PROJECT_PREVIEW_PATH, (req, res) => {
    const currentProjectTarget = getCurrentProjectTarget(resolveCurrentTarget);
    if (!currentProjectTarget) {
      res.status(404).type('html').send(renderPolicyErrorPage('No project is currently open.'));
      return;
    }
    sendPresentationHtml(res, currentProjectTarget, { decorateHtml });
  });
  app.get('/api/project/meta', (req, res) => {
    const currentProjectTarget = getCurrentProjectTarget(resolveCurrentTarget);
    if (!currentProjectTarget) {
      res.json({
        active: false,
        kind: 'none',
        projectRoot: '',
        previewPath: PROJECT_PREVIEW_PATH,
      });
      return;
    }

    const projectPaths = getProjectPaths(currentProjectTarget.projectRootAbs);
    res.json({
      active: true,
      kind: 'project',
      projectRoot: projectPaths.projectRootAbs,
      title: projectPaths.title,
      slug: projectPaths.slug,
      previewPath: PROJECT_PREVIEW_PATH,
      projectMode: projectPaths.metadata.projectMode,
      frameworkMode: projectPaths.metadata.frameworkMode,
      frameworkVersion: projectPaths.metadata.frameworkVersion,
      frameworkCopiedAt: projectPaths.metadata.frameworkCopiedAt,
      canvasPolicy: projectPaths.metadata.canvasPolicy,
      outputsPath: projectPaths.outputsDirAbs,
    });
  });
  app.get('/api/project/state', (req, res) => {
    const currentProjectTarget = getCurrentProjectTarget(resolveCurrentTarget);
    if (!currentProjectTarget) {
      res.json({
        status: 'no_project',
        projectRoot: '',
      });
      return;
    }

    res.json(getProjectState(currentProjectTarget.projectRootAbs));
  });
  app.get('/api/project/files', (req, res) => {
    const currentProjectTarget = getCurrentProjectTarget(resolveCurrentTarget);
    if (!currentProjectTarget) {
      res.status(404).json({ error: 'No project is open.' });
      return;
    }

    const projectPaths = getProjectPaths(currentProjectTarget.projectRootAbs);
    res.json({
      root: projectPaths.projectRootAbs,
      tree: buildProjectTreeNode(projectPaths.projectRootAbs, projectPaths.projectRootAbs),
    });
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

  app.get(/^\/decks\/([^/]+)$/, (req, res) => {
    res.redirect(`/decks/${req.params[0]}/`);
  });

  app.get('/decks/:slug/', (req, res) => {
    return sendPresentationHtml(res, { ownerType: 'deck', ownerName: req.params.slug }, { decorateHtml });
  });

  app.get(/^\/examples\/([^/]+)$/, (req, res) => {
    res.redirect(`/examples/${req.params[0]}/`);
  });

  app.get('/examples/:name/', (req, res) => {
    return sendPresentationHtml(res, { ownerType: 'example', ownerName: req.params.name }, { decorateHtml });
  });

  app.use(express.static(FRAMEWORK_ROOT, { index: false }));

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
