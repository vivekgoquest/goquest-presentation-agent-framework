/* global Terminal, FitAddon */
const $ = (id) => document.getElementById(id);

const el = {
  appShell: $('app-shell'),
  watchStatus: $('watch-status'),
  toggleDiagnostics: $('toggle-diagnostics'),
  choosePath: $('choose-path'),
  createProject: $('create-project'),
  projectNameLabel: $('project-name-label'),
  runCheck: $('run-check'),
  runExport: $('run-export'),
  runCapture: $('run-capture'),
  runFinalize: $('run-finalize'),
  moreActions: $('more-actions'),
  moreMenu: $('more-menu'),
  startShell: $('start-shell'),
  stopTerminal: $('stop-terminal'),
  clearTerminal: $('clear-terminal'),
  welcomePanel: $('welcome-panel'),
  welcomeOpen: $('welcome-open'),
  welcomeCreate: $('welcome-create'),
  projectPath: $('project-path'),
  projectSlides: $('project-slides'),
  terminalPane: $('terminal-pane'),
  terminalContainer: $('terminal-container'),
  previewPane: $('preview-pane'),
  previewFrame: $('preview-frame'),
  splitHandle: $('split-handle'),
  toastContainer: $('toast-container'),
  diagnosticsDrawer: $('diagnostics-drawer'),
  closeDiagnostics: $('close-diagnostics'),
  metaJson: $('meta-json'),
  stateJson: $('state-json'),
  filesJson: $('files-json'),
  actionJson: $('action-json'),
  terminalMeta: $('terminal-meta'),
  errorLog: $('error-log'),
  statusPill: $('status-pill'),
  projectTitle: $('project-title'),
  projectPathLabel: $('project-path-label'),
  slideCount: $('slide-count'),
  projectStatusBadge: $('project-status-badge'),
};

const state = { meta: null, projectState: null, files: null, terminalMeta: null, hasProject: false, diagnosticsOpen: false, splitRatio: 0.35, terminalVisible: false };

// ── xterm ──
const FitAddonClass = (typeof FitAddon === 'function') ? FitAddon : FitAddon.FitAddon;
const fitAddon = new FitAddonClass();
const term = new Terminal({
  cursorBlink: true, cursorStyle: 'block', fontSize: 14,
  fontFamily: 'Menlo, "DejaVu Sans Mono", Consolas, monospace',
  lineHeight: 1.2,
  theme: {
    background: '#1e1e1e', foreground: '#cccccc', cursor: '#aeafad', cursorAccent: '#1e1e1e',
    selectionBackground: '#264f78', selectionForeground: '#ffffff',
    black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
    blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
    brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543',
    brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#e5e5e5',
  },
  scrollback: 5000, allowProposedApi: true,
});
term.loadAddon(fitAddon);
let xtermMounted = false;

function mountXterm() {
  if (xtermMounted) return;
  term.open(el.terminalContainer);
  xtermMounted = true;
  requestAnimationFrame(() => fitAddon.fit());
}

function fitTerminal() {
  if (!xtermMounted) return;
  try { fitAddon.fit(); const { cols, rows } = term; if (cols > 0 && rows > 0) window.electron.terminal.resize(cols, rows).catch(() => {}); } catch {}
}

term.onData((data) => { if (state.terminalMeta?.alive) window.electron.terminal.send(data); });

// ── Helpers ──
function stringify(v) { return JSON.stringify(v, null, 2); }
function setJson(e, v) { if (e) e.textContent = stringify(v); }
function setLoading(b, on) {
  if (!b) return;
  b.classList.toggle('loading', on);
  if (on) b.disabled = true;
  else b.disabled = false;
}

// ── Toasts ──
function showToast(msg, type = 'error', ms = 4000) {
  const t = document.createElement('div'); t.className = `toast toast-${type}`;
  const s = document.createElement('span'); s.textContent = msg;
  const x = document.createElement('button'); x.className = 'toast-dismiss'; x.textContent = '\u00D7'; x.onclick = () => t.remove();
  t.append(s, x); el.toastContainer.appendChild(t);
  if (ms > 0) setTimeout(() => { if (t.parentNode) t.remove(); }, ms);
  if (type === 'error' && el.errorLog) { const p = el.errorLog.textContent.trim(); el.errorLog.textContent = p ? `${p}\n${msg}` : msg; }
}

// ── Layout ──
function showTerminal() {
  if (state.terminalVisible) return;
  state.terminalVisible = true;
  el.terminalPane.style.display = 'flex';
  el.splitHandle.style.display = 'block';
  applySplitRatio();
  requestAnimationFrame(() => { mountXterm(); fitTerminal(); });
}

function showProjectLayout() {
  el.welcomePanel.style.display = 'none';
  el.previewPane.style.display = 'flex';
  // Terminal stays in whatever state it's in
  if (state.terminalVisible) {
    el.terminalPane.style.display = 'flex';
    el.splitHandle.style.display = 'block';
    applySplitRatio();
    requestAnimationFrame(() => { mountXterm(); fitTerminal(); });
  } else {
    el.previewPane.style.flex = '1';
  }
}

function showWelcomeLayout() {
  el.welcomePanel.style.display = 'flex';
  el.previewPane.style.display = 'none';
  el.terminalPane.style.display = 'none';
  el.splitHandle.style.display = 'none';
}

function applySplitRatio() {
  // Preview on the left (hero), terminal on the right
  const r = state.splitRatio; // terminal ratio
  el.previewPane.style.flex = `${1 - r}`;
  el.terminalPane.style.flex = `${r}`;
  el.splitHandle.style.left = `${(1 - r) * 100}%`;
}

// ── Split drag ──
(function initSplit() {
  let dragging = false;
  el.splitHandle.addEventListener('mousedown', (e) => {
    e.preventDefault(); dragging = true;
    el.splitHandle.classList.add('dragging');
    document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const rect = el.previewPane.parentElement.getBoundingClientRect();
    const previewRatio = (e.clientX - rect.left) / rect.width;
    state.splitRatio = Math.max(0.15, Math.min(0.7, 1 - previewRatio));
    applySplitRatio(); fitTerminal();
  });
  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false; el.splitHandle.classList.remove('dragging');
    document.body.style.cursor = ''; document.body.style.userSelect = '';
    fitTerminal();
  });
})();
window.addEventListener('resize', () => fitTerminal());

// ── State ──
function updateAppState() {
  const has = Boolean(state.meta?.active);
  state.hasProject = has;
  el.appShell.dataset.state = has ? 'project-active' : 'no-project';
  has ? showProjectLayout() : showWelcomeLayout();

  [el.runCheck, el.runExport, el.runCapture, el.runFinalize, el.moreActions].forEach(b => { if (b) b.disabled = !has; });

  if (has) {
    el.projectNameLabel.textContent = state.meta.title || state.meta.slug || 'Untitled';
  } else {
    el.projectNameLabel.textContent = '';
  }

  // Hidden compat
  if (has && state.meta) {
    if (el.projectTitle) el.projectTitle.textContent = state.meta.title || '';
    if (el.projectPathLabel) el.projectPathLabel.textContent = state.meta.projectRoot || '';
    if (el.statusPill) { el.statusPill.textContent = 'Active'; el.statusPill.className = 'status-pill active'; }
    const sc = countSlides(state.files);
    if (el.slideCount) el.slideCount.textContent = sc > 0 ? `${sc} slides` : '';
  }

  if (has && el.previewFrame && !el.previewFrame.srcdoc) loadBlankPreview();

  setJson(el.metaJson, state.meta || {});
  setJson(el.stateJson, state.projectState || {});
  setJson(el.filesJson, state.files || {});
}

function countSlides(f) {
  if (!f?.tree?.children) return 0;
  const sd = f.tree.children.find(c => c.name === 'slides');
  return sd?.children ? sd.children.filter(c => c.isDirectory || c.kind === 'slide-directory').length : 0;
}

function loadBlankPreview() {
  el.previewFrame.srcdoc = `<!DOCTYPE html>
<html><head><style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:#f0f0f0}
body{display:flex;align-items:center;justify-content:center;font-family:-apple-system,sans-serif}
.s{width:88%;max-width:960px;aspect-ratio:16/9;background:#fff;border-radius:4px;
box-shadow:0 1px 4px rgba(0,0,0,0.08),0 8px 32px rgba(0,0,0,0.06)}
</style></head><body><div class="s"></div></body></html>`;
}

function updateTerminalState(meta) {
  state.terminalMeta = meta;
  setJson(el.terminalMeta, meta || {});
  const alive = meta?.alive;
  const stopped = meta?.state === 'stopped';
  el.stopTerminal.style.display = alive ? '' : 'none';
  el.clearTerminal.style.display = (alive || stopped) ? '' : 'none';
  if (alive && xtermMounted) term.focus();
  // Auto-show terminal pane when a session starts
  if (alive && state.hasProject && !state.terminalVisible) showTerminal();
}

async function refreshProjectPanels() {
  const [meta, ps, files, tm] = await Promise.all([
    window.electron.project.getMeta(),
    window.electron.project.getState(),
    window.electron.project.getFiles().catch(() => ({ root: '', tree: {} })),
    window.electron.terminal.getMeta(),
  ]);
  state.meta = meta; state.projectState = ps; state.files = files;
  updateAppState(); updateTerminalState(tm);
}

function outputPath(name) {
  if (!state.meta?.projectRoot) throw new Error('Open a project first.');
  return `${state.meta.projectRoot}/outputs/${name}`;
}

async function runAction(fn, btn = null) {
  setLoading(btn, true);
  try { const r = await fn(); setJson(el.actionJson, r); await refreshProjectPanels(); return r; }
  catch (e) { showToast(e.message); throw e; }
  finally { setLoading(btn, false); }
}

// ── Project ──
async function choosePath() {
  try {
    const r = await window.electron.system.chooseDirectory();
    if (!r?.canceled && r?.path) { el.projectPath.value = r.path; return r.path; }
  } catch (e) { showToast(e.message); }
  return null;
}

async function openProject(path) {
  const p = path || el.projectPath.value.trim();
  if (!p) { const c = await choosePath(); if (c) return openProject(c); return; }
  await runAction(async () => {
    const r = await window.electron.project.open({ projectRoot: p });
    showToast('Project opened', 'success', 2500);
    return r;
  });
}

async function createProject() {
  // Always open folder picker for new projects
  const chosen = await choosePath();
  if (!chosen) return;
  const n = parseInt(el.projectSlides.value || '3', 10);
  await runAction(async () => {
    const r = await window.electron.project.create({ projectRoot: chosen, slides: n });
    showToast('Presentation created', 'success', 2500);
    return r;
  }, el.createProject);
}

async function toolbarOpen() {
  const c = await choosePath();
  if (c) { try { await openProject(c); } catch { /* toast shown */ } }
}

// ── More menu ──
function toggleMoreMenu() {
  const visible = el.moreMenu.style.display !== 'none';
  el.moreMenu.style.display = visible ? 'none' : '';
  if (!visible) {
    // Position near the button
    const rect = el.moreActions.getBoundingClientRect();
    el.moreMenu.style.left = `${rect.left}px`;
  }
}
document.addEventListener('click', (e) => {
  if (!el.moreMenu.contains(e.target) && e.target !== el.moreActions) {
    el.moreMenu.style.display = 'none';
  }
});

function toggleDiag() {
  state.diagnosticsOpen = !state.diagnosticsOpen;
  el.diagnosticsDrawer.style.display = state.diagnosticsOpen ? '' : 'none';
}

// ── Events ──
el.choosePath.addEventListener('click', toolbarOpen);
el.createProject.addEventListener('click', createProject);
el.welcomeOpen.addEventListener('click', toolbarOpen);
el.welcomeCreate.addEventListener('click', createProject);
el.moreActions.addEventListener('click', toggleMoreMenu);

el.runFinalize.addEventListener('click', () => runAction(() => window.electron.runtime.finalize(), el.runFinalize));
el.runExport.addEventListener('click', () => runAction(() => window.electron.runtime.export({ outputFile: outputPath('electron-export.pdf') }), el.runExport));
el.runCheck.addEventListener('click', () => { el.moreMenu.style.display = 'none'; runAction(() => window.electron.runtime.check({ outputDir: outputPath('electron-check') }), el.runCheck); });
el.runCapture.addEventListener('click', () => { el.moreMenu.style.display = 'none'; runAction(() => window.electron.runtime.capture({ outputDir: outputPath('electron-capture') }), el.runCapture); });

el.startShell.addEventListener('click', () => { showTerminal(); runAction(() => window.electron.terminal.start('shell'), el.startShell); });
el.stopTerminal.addEventListener('click', () => runAction(() => window.electron.terminal.stop(), el.stopTerminal));
el.clearTerminal.addEventListener('click', () => runAction(async () => { term.clear(); return window.electron.terminal.clear(); }, el.clearTerminal));

el.toggleDiagnostics.addEventListener('click', toggleDiag);
el.closeDiagnostics.addEventListener('click', toggleDiag);

window.electron.events.onEvent(async (event) => {
  switch (event.channel) {
    case 'terminal/output': term.write(event.data || ''); break;
    case 'terminal/clear': term.clear(); break;
    case 'terminal/ready':
    case 'terminal/meta':
    case 'terminal/exit': updateTerminalState(await window.electron.terminal.getMeta()); break;
    case 'watch/change': el.watchStatus.textContent = event.file; break;
    case 'project/changed': await refreshProjectPanels(); break;
  }
});

refreshProjectPanels().catch(e => showToast(e.message));
