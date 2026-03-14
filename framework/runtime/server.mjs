import { createServer } from 'http';
import { existsSync, mkdirSync, readdirSync, statSync, watch, writeFileSync } from 'fs';
import { spawn, spawnSync } from 'child_process';
import { relative, resolve } from 'path';
import { WebSocketServer } from 'ws';
import { generatePDF } from './pdf-export.js';
import {
  FRAMEWORK_ROOT,
  PROJECT_METADATA_FILENAME,
  PROJECT_SYSTEM_DIRNAME,
  createPresentationTarget,
  createWorkspaceRef,
  getPresentationId,
  getPresentationOutputPaths,
  getPresentationPaths,
  getProjectPaths,
  getSuggestedPdfName,
  listExampleDecks,
  listWorkspaceDecks,
  parsePresentationTargetCliArgs,
} from './deck-paths.js';
import { createRuntimeApp } from './runtime-app.js';
import { createTerminalSession } from './terminal-session.js';
import { getProjectState } from './project-state.js';

function parseStartArgs(argv) {
  let port = null;
  const passthrough = [];

  for (const arg of argv) {
    if (!arg.startsWith('--') && /^\d+$/.test(arg) && port === null) {
      port = Number.parseInt(arg, 10);
      continue;
    }
    passthrough.push(arg);
  }

  const parsed = parsePresentationTargetCliArgs(passthrough, {
    requireTarget: false,
  });

  return {
    port: port ?? 3000,
    target: parsed.target,
  };
}

const { port: PORT, target: initialTarget } = (() => {
  try {
    return parseStartArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Usage: npm run start -- [port] [--project /abs/path]\n\n${err.message}`);
    process.exit(1);
  }
})();

const HOST = process.env.HOST || '127.0.0.1';

let activeProjectTarget = initialTarget?.kind === 'project'
  ? createPresentationTarget(initialTarget)
  : null;
let activeProjectPaths = activeProjectTarget ? getProjectPaths(activeProjectTarget.projectRootAbs) : null;

const clients = new Set();
const terminalSession = createTerminalSession({
  frameworkRoot: FRAMEWORK_ROOT,
  projectRoot: activeProjectPaths?.projectRootAbs || null,
});

let debounceTimer = null;
let finalizePromise = null;
let activeWatchers = [];

function shouldIgnoreWatchPath(filename) {
  return (
    filename.includes('node_modules') ||
    filename.includes('/outputs/') ||
    filename.startsWith('outputs/') ||
    filename.startsWith('.git') ||
    filename.endsWith('.pdf') ||
    filename.endsWith('.DS_Store')
  );
}

function notifyChange(filename) {
  if (!filename || shouldIgnoreWatchPath(filename)) {
    return;
  }

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`\x1b[36m[${timestamp}] Changed: ${filename}\x1b[0m`);

    for (const client of clients) {
      client.write(`data: ${JSON.stringify({ file: filename, time: timestamp })}\n\n`);
    }
  }, 150);
}

function isInsideRoot(targetAbs, rootAbs) {
  const normalizedTarget = resolve(targetAbs);
  const normalizedRoot = resolve(rootAbs);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}/`) || normalizedTarget.startsWith(`${normalizedRoot}\\`);
}

function createDirectoryTreeWatcher(rootDir, displayPrefix = '') {
  const watchers = new Map();

  function toWatchLabel(dirAbs, filename = '') {
    const absPath = filename ? resolve(dirAbs, filename) : dirAbs;
    const relPath = relative(rootDir, absPath).replace(/\\/g, '/');
    return displayPrefix ? `${displayPrefix}${relPath}` : relPath;
  }

  function scanDirectory(dirAbs) {
    if (!watchers.has(dirAbs)) {
      const watcher = watch(dirAbs, (eventType, filename) => {
        const relativePath = filename ? toWatchLabel(dirAbs, String(filename)) : toWatchLabel(dirAbs);
        notifyChange(relativePath);

        if (eventType === 'rename') {
          refresh();
        }
      });

      watchers.set(dirAbs, watcher);
    }

    for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const childAbs = resolve(dirAbs, entry.name);
      const childRel = toWatchLabel(childAbs);
      if (shouldIgnoreWatchPath(childRel)) {
        continue;
      }

      scanDirectory(childAbs);
    }
  }

  function refresh() {
    scanDirectory(rootDir);

    for (const [dirAbs, watcher] of watchers) {
      try {
        readdirSync(dirAbs);
      } catch {
        watcher.close();
        watchers.delete(dirAbs);
      }
    }
  }

  refresh();

  return () => {
    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();
  };
}

function createWatchHandle(rootDir, displayPrefix = '') {
  try {
    const watcher = watch(rootDir, { recursive: true }, (_eventType, filename) => {
      if (!filename) {
        return;
      }

      const relativePath = String(filename).replace(/\\/g, '/');
      notifyChange(displayPrefix ? `${displayPrefix}${relativePath}` : relativePath);
    });

    return () => watcher.close();
  } catch (err) {
    if (err?.code !== 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
      throw err;
    }

    console.warn(`[watch] Recursive fs.watch unavailable for ${rootDir}; using directory-tree fallback.`);
    return createDirectoryTreeWatcher(rootDir, displayPrefix);
  }
}

function replaceWatchRoots() {
  for (const stop of activeWatchers) {
    stop();
  }
  activeWatchers = [];

  const nextRoots = [
    { root: FRAMEWORK_ROOT, prefix: 'framework-host/' },
  ];

  if (activeProjectPaths && !isInsideRoot(activeProjectPaths.sourceDirAbs, FRAMEWORK_ROOT)) {
    nextRoots.push({ root: activeProjectPaths.sourceDirAbs, prefix: '' });
  }

  for (const watchRoot of nextRoots) {
    activeWatchers.push(createWatchHandle(watchRoot.root, watchRoot.prefix));
  }
}

replaceWatchRoots();

const LIVE_RELOAD_SCRIPT = `
<script>
(function() {
  var dot = document.createElement('div');
  dot.style.cssText = 'position:fixed;bottom:8px;left:8px;width:8px;height:8px;border-radius:50%;z-index:99999;transition:background .3s;';
  dot.title = 'Live reload connected';
  document.body.appendChild(dot);

  var es = new EventSource('/api/live-reload');
  es.onopen = function() { dot.style.background = '#4caf50'; };
  es.onmessage = function(e) {
    var data = JSON.parse(e.data);
    if (data.connected) {
      dot.style.background = '#4caf50';
      return;
    }
    dot.style.background = '#ff9800';
    setTimeout(function() { location.reload(); }, 100);
  };
  es.onerror = function() {
    dot.style.background = '#f44336';
    dot.title = 'Live reload disconnected';
  };
})();
</script>
`;

function injectLiveReload(html) {
  if (html.includes('</body>')) {
    return html.replace('</body>', `${LIVE_RELOAD_SCRIPT}\n</body>`);
  }

  return `${html}${LIVE_RELOAD_SCRIPT}`;
}

function renderWorkspaceIndexHtml() {
  const exampleDecks = listExampleDecks();
  const workspaceDecks = listWorkspaceDecks();

  const renderDeckLinks = (decks) => decks
    .map((deck) => `      <li><a href="${deck.previewHref}">${deck.label}</a><span>${deck.workspaceId}</span></li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Goquest Presentation Workspaces</title>
  <style>
    body { font-family: "Aptos", "Inter", "Segoe UI", sans-serif; max-width: 860px; margin: 4rem auto; color: #1d1d1f; }
    h1 { font-size: 1.8rem; font-weight: 800; }
    h2 { margin-top: 2.4rem; font-size: 1.05rem; text-transform: uppercase; letter-spacing: 0.08em; color: #6a6a72; }
    ul { list-style: none; padding: 0; margin-top: 1rem; }
    li { margin: 0.8rem 0; display: flex; gap: 0.8rem; align-items: baseline; }
    a { color: #b71c1c; text-decoration: none; font-size: 1.05rem; font-weight: 700; min-width: 180px; }
    a:hover { text-decoration: underline; }
    span { color: #6a6a72; font-size: 0.95rem; }
    code { background: #f3f3f5; padding: 0.12rem 0.4rem; border-radius: 6px; }
    .hint { color: #888; font-size: 0.92rem; margin-top: 2rem; line-height: 1.5; }
  </style>
</head>
<body>
  <h1>Goquest Presentation Workspaces</h1>
  <p>The operator console now lives at <a href="/">/</a>. This page remains a simple browser for raw preview routes.</p>

  <h2>Example Decks</h2>
  <ul>
${renderDeckLinks(exampleDecks)}
  </ul>

  <h2>Deck Workspaces</h2>
  <ul>
${workspaceDecks.length > 0 ? renderDeckLinks(workspaceDecks) : '      <li><span>No deck workspaces yet. Create one with <code>npm run new -- --deck sample</code>.</span></li>'}
  </ul>

  <p class="hint">Project-folder mode uses <code>npm run start -- --project /abs/path</code>. Legacy deck work remains available under <code>decks/&lt;slug&gt;/</code>.</p>
${LIVE_RELOAD_SCRIPT}
</body>
</html>`;
}

function resolveProjectRelativePath(projectRootAbs, relativePath = '.') {
  const absPath = resolve(projectRootAbs, relativePath);
  if (!isInsideRoot(absPath, projectRootAbs)) {
    throw new Error('Path must stay inside the opened project.');
  }
  return absPath;
}

function openPathInSystem(absPath) {
  if (process.platform === 'darwin') {
    const child = spawn('open', [absPath], { detached: true, stdio: 'ignore' });
    child.unref();
    return;
  }

  if (process.platform === 'win32') {
    const child = spawn('explorer.exe', [absPath], { detached: true, stdio: 'ignore' });
    child.unref();
    return;
  }

  const child = spawn('xdg-open', [absPath], { detached: true, stdio: 'ignore' });
  child.unref();
}

function runFinalizeCommand(projectRootAbs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [resolve(FRAMEWORK_ROOT, 'framework/runtime/finalize-deck.mjs'), '--project', projectRootAbs],
      {
        cwd: FRAMEWORK_ROOT,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('exit', (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }

      reject(new Error(`Finalize failed with code ${code}.\n${stdout}\n${stderr}`.trim()));
    });
    child.on('error', reject);
  });
}

function runCreateProjectCommand(projectRootAbs, options = {}) {
  const { slideCount = 3, copyFramework = false } = options;

  return new Promise((resolvePromise, reject) => {
    const args = [
      resolve(FRAMEWORK_ROOT, 'framework/runtime/new-deck.mjs'),
      '--project',
      projectRootAbs,
      '--slides',
      String(slideCount),
    ];

    if (copyFramework) {
      args.push('--copy-framework');
    }

    const child = spawn(process.execPath, args, {
      cwd: FRAMEWORK_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });

    child.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `Project creation failed with code ${code}.`));
        return;
      }

      try {
        resolvePromise(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`Project creation succeeded but returned invalid JSON.\n${stdout}\n${stderr}\n${err.message}`.trim()));
      }
    });
    child.on('error', reject);
  });
}

function openFolderDialog() {
  if (process.platform !== 'darwin') {
    const err = new Error('Native folder selection is currently supported only on macOS.');
    err.code = 'UNSUPPORTED_PLATFORM';
    throw err;
  }

  const result = spawnSync(
    'osascript',
    [
      '-e',
      'set chosenFolder to choose folder with prompt "Select a presentation project folder"',
      '-e',
      'POSIX path of chosenFolder',
    ],
    {
      encoding: 'utf8',
    }
  );

  if (result.status !== 0) {
    const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
    const cancelled = /user canceled/i.test(output);
    const err = new Error(cancelled ? 'Folder selection cancelled.' : output || 'Folder selection failed.');
    err.code = cancelled ? 'CANCELLED' : 'OSASCRIPT_FAILED';
    throw err;
  }

  return String(result.stdout || '').trim();
}

function getActiveProjectMeta() {
  if (!activeProjectTarget || !activeProjectPaths) {
    return {
      active: false,
      kind: 'none',
      projectRoot: '',
      previewPath: '/preview/',
    };
  }

  return {
    active: true,
    kind: 'project',
    projectRoot: activeProjectPaths.projectRootAbs,
    title: activeProjectPaths.title,
    slug: activeProjectPaths.slug,
    previewPath: '/preview/',
    projectMode: activeProjectPaths.metadata.projectMode,
    frameworkMode: activeProjectPaths.metadata.frameworkMode,
    frameworkVersion: activeProjectPaths.metadata.frameworkVersion,
    frameworkCopiedAt: activeProjectPaths.metadata.frameworkCopiedAt,
    canvasPolicy: activeProjectPaths.metadata.canvasPolicy,
    outputsPath: activeProjectPaths.outputsDirAbs,
  };
}

function getActiveProjectState() {
  if (!activeProjectPaths) {
    return {
      status: 'no_project',
      projectRoot: '',
    };
  }

  return getProjectState(activeProjectPaths.projectRootAbs);
}

function setActiveProject(projectRootAbs) {
  const nextTarget = createPresentationTarget({ projectRoot: projectRootAbs });
  const nextPaths = getProjectPaths(nextTarget.projectRootAbs);

  terminalSession.stopSession({ announce: false, signal: 'project-switch' });
  terminalSession.setProjectContext(nextPaths.projectRootAbs);

  activeProjectTarget = nextTarget;
  activeProjectPaths = nextPaths;
  replaceWatchRoots();
  return nextPaths;
}

async function handlePreviewExport(req, res) {
  let target;
  try {
    if (req.body?.projectRoot) {
      target = createPresentationTarget({ projectRoot: req.body.projectRoot });
    } else {
      target = createWorkspaceRef(req.body?.ownerType, req.body?.ownerName);
    }
  } catch (err) {
    return res.status(400).json({
      error: 'Invalid presentation target',
      detail: err.message,
    });
  }

  if (target.kind === 'workspace' && target.ownerType !== 'deck') {
    return res.status(400).json({
      error: 'Preview export is only supported for deck workspaces and open project folders.',
      detail: 'Use the CLI export path for examples.',
    });
  }

  try {
    const pdfBuffer = await generatePDF(target);
    const outputPaths = getPresentationOutputPaths(target);
    mkdirSync(outputPaths.outputDirAbs, { recursive: true });
    writeFileSync(outputPaths.pdfAbs, pdfBuffer);

    const filename = getSuggestedPdfName(target);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
      'X-Export-Saved-To': outputPaths.pdfRel,
    });
    res.send(pdfBuffer);
  } catch (err) {
    const isPolicyError = typeof err?.message === 'string' && err.message.includes('Deck policy violation');
    if (isPolicyError) {
      console.warn(err.message);
    } else {
      console.error(err);
    }
    res.status(isPolicyError ? 400 : 500).json({
      error: isPolicyError ? 'Deck policy violation' : 'Export failed',
      detail: err.message,
    });
  }
}

const app = createRuntimeApp({
  decorateHtml: injectLiveReload,
  onExport: handlePreviewExport,
  getCurrentTarget: () => activeProjectTarget,
});

app.get('/api/live-reload', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write('data: {"connected":true}\n\n');

  clients.add(res);
  req.on('close', () => clients.delete(res));
});

app.get('/api/console/workspaces', (req, res) => {
  const mapDeck = (deck) => ({
    label: deck.label,
    workspaceId: deck.workspaceId,
    previewHref: deck.previewHref,
    ownerType: deck.ownerType,
    ownerName: deck.slug,
  });

  res.json({
    decks: listWorkspaceDecks().map(mapDeck),
    examples: listExampleDecks().map(mapDeck),
  });
});

app.get('/api/console/terminal/meta', (req, res) => {
  res.json(terminalSession.getMeta());
});

app.post('/api/console/terminal/start', (req, res) => {
  try {
    const mode = req.body?.mode || 'shell';
    terminalSession.setProjectContext(activeProjectPaths?.projectRootAbs || null);
    res.json(terminalSession.startSession(mode));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/console/terminal/stop', (req, res) => {
  res.json(terminalSession.stopSession());
});

app.post('/api/console/terminal/clear', (req, res) => {
  terminalSession.clearBacklog();
  res.json({ ok: true });
});

app.post('/api/console/terminal/reveal', (req, res) => {
  if (!activeProjectPaths) {
    res.status(404).json({ error: 'Reveal in terminal is only available in project mode.' });
    return;
  }

  try {
    const absPath = resolveProjectRelativePath(activeProjectPaths.projectRootAbs, req.body?.relativePath || '.');
    res.json(terminalSession.revealPath(absPath));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/project/open-dialog', (req, res) => {
  try {
    const projectRoot = openFolderDialog();
    res.json({
      ok: true,
      supported: true,
      projectRoot,
    });
  } catch (err) {
    if (err.code === 'UNSUPPORTED_PLATFORM') {
      res.status(501).json({
        error: err.message,
        supported: false,
      });
      return;
    }

    if (err.code === 'CANCELLED') {
      res.status(400).json({
        error: err.message,
        cancelled: true,
      });
      return;
    }

    res.status(500).json({ error: err.message });
  }
});

app.post('/api/project/open', (req, res) => {
  try {
    const projectRootAbs = resolve(String(req.body?.projectRoot || ''));
    if (!projectRootAbs || projectRootAbs === resolve('/')) {
      throw new Error('Provide a valid project folder path.');
    }

    if (!existsSync(projectRootAbs) || !statSync(projectRootAbs).isDirectory()) {
      throw new Error(`Project folder does not exist: ${projectRootAbs}`);
    }

    const metadataAbs = resolve(projectRootAbs, PROJECT_SYSTEM_DIRNAME, PROJECT_METADATA_FILENAME);
    if (!existsSync(metadataAbs)) {
      res.status(409).json({
        error: 'This folder is not initialized as a presentation project yet.',
        needsInitialization: true,
        projectRoot: projectRootAbs,
      });
      return;
    }

    setActiveProject(projectRootAbs);
    res.json({
      ok: true,
      meta: getActiveProjectMeta(),
      state: getActiveProjectState(),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/project/create', async (req, res) => {
  try {
    const projectRootAbs = resolve(String(req.body?.projectRoot || ''));
    const slideCount = Number.parseInt(req.body?.slides ?? '3', 10);
    const copyFramework = Boolean(req.body?.copyFramework);

    if (!projectRootAbs || projectRootAbs === resolve('/')) {
      throw new Error('Choose a target folder for the presentation project.');
    }

    if (!Number.isFinite(slideCount) || slideCount < 1 || slideCount > 99) {
      throw new Error('Slides must be a whole number between 1 and 99.');
    }

    const result = await runCreateProjectCommand(projectRootAbs, {
      slideCount,
      copyFramework,
    });

    setActiveProject(projectRootAbs);
    res.json({
      ok: true,
      result,
      meta: getActiveProjectMeta(),
      state: getActiveProjectState(),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/project/open-path', (req, res) => {
  if (!activeProjectPaths) {
    res.status(404).json({ error: 'Open path is only available in project mode.' });
    return;
  }

  try {
    let absPath = activeProjectPaths.projectRootAbs;
    if (req.body?.kind === 'outputs') {
      mkdirSync(activeProjectPaths.outputsDirAbs, { recursive: true });
      absPath = activeProjectPaths.outputsDirAbs;
    } else if (req.body?.relativePath) {
      absPath = resolveProjectRelativePath(activeProjectPaths.projectRootAbs, req.body.relativePath);
    }
    openPathInSystem(absPath);
    res.json({ ok: true, path: absPath });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/project/finalize', async (req, res) => {
  if (!activeProjectTarget || !activeProjectPaths) {
    res.status(404).json({ error: 'Finalize is only available in project mode.' });
    return;
  }

  if (finalizePromise) {
    res.status(409).json({ error: 'Finalize is already running for this project.' });
    return;
  }

  try {
    finalizePromise = runFinalizeCommand(activeProjectPaths.projectRootAbs);
    await finalizePromise;
    const outputPaths = getPresentationOutputPaths(activeProjectTarget);
    res.json({
      ok: true,
      outputDir: outputPaths.outputDirAbs,
      pdfPath: outputPaths.pdfAbs,
      reportPath: outputPaths.reportAbs,
      summaryPath: outputPaths.summaryAbs,
      slidesDir: outputPaths.slidesDirAbs,
      state: getActiveProjectState(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    finalizePromise = null;
  }
});

app.get('/workspaces/', (req, res) => {
  res.type('html').send(renderWorkspaceIndexHtml());
});

app.get('/', (req, res) => {
  if (activeProjectTarget?.kind === 'project') {
    res.sendFile(resolve(FRAMEWORK_ROOT, 'framework/console/project-console.html'));
    return;
  }

  res.sendFile(resolve(FRAMEWORK_ROOT, 'framework/console/launcher.html'));
});

const server = createServer(app);
const terminalSocketServer = new WebSocketServer({ noServer: true });

terminalSocketServer.on('connection', (socket) => {
  terminalSession.connectClient(socket);

  socket.on('message', (raw) => {
    const response = terminalSession.handleClientMessage(raw);
    if (response) {
      socket.send(JSON.stringify(response));
    }
  });

  socket.on('close', () => {
    terminalSession.disconnectClient(socket);
  });
});

server.on('upgrade', (req, socket, head) => {
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
  if (requestUrl.pathname !== '/api/console/terminal') {
    socket.destroy();
    return;
  }

  terminalSocketServer.handleUpgrade(req, socket, head, (ws) => {
    terminalSocketServer.emit('connection', ws, req);
  });
});

server.listen(PORT, HOST, () => {
  console.log('\nGoquest Presentation Agent Framework');
  if (activeProjectPaths) {
    console.log(`Project:           ${activeProjectPaths.sourceDirAbs}`);
    console.log(`Project preview:   http://${HOST}:${PORT}/preview/`);
  }
  console.log(`Operator console:  http://${HOST}:${PORT}/`);
  console.log(`Workspace browser: http://${HOST}:${PORT}/workspaces/\n`);
  if (activeProjectTarget) {
    console.log(`Current target:    ${getPresentationId(activeProjectTarget)}\n`);
  }
});
