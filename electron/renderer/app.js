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
  filmstrip: $('filmstrip'),
  slideCounter: $('slide-counter'),
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

const state = { meta: null, projectState: null, files: null, terminalMeta: null, hasProject: false, diagnosticsOpen: false, currentSlide: 0, slideEntries: [] };

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
function showProjectLayout() {
  el.welcomePanel.style.display = 'none';
  el.previewPane.style.display = 'flex';
  el.terminalPane.style.display = 'flex';
  el.splitHandle.style.display = 'block';
  requestAnimationFrame(() => { mountXterm(); fitTerminal(); });
}

function showWelcomeLayout() {
  el.welcomePanel.style.display = 'flex';
  el.previewPane.style.display = 'none';
  el.terminalPane.style.display = 'none';
  el.splitHandle.style.display = 'none';
}

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

  if (has && !el.previewFrame.src?.startsWith('presentation://')) loadPreview();
  if (has) buildFilmstrip();

  setJson(el.metaJson, state.meta || {});
  setJson(el.stateJson, state.projectState || {});
  setJson(el.filesJson, state.files || {});
}

function countSlides(f) {
  if (!f?.tree?.children) return 0;
  const sd = f.tree.children.find(c => c.name === 'slides');
  return sd?.children ? sd.children.filter(c => c.isDirectory || c.kind === 'slide-directory').length : 0;
}

function loadPreview() {
  el.previewFrame.src = 'presentation://preview/current';
  el.previewFrame.onload = () => {
    // Re-navigate to current slide after load
    if (state.slideEntries.length > 0) {
      setTimeout(() => selectSlide(state.currentSlide), 80);
    }
  };
}

// ── Filmstrip ──
function buildFilmstrip() {
  if (!state.files?.tree?.children) return;
  const slidesDir = state.files.tree.children.find(c => c.name === 'slides');
  if (!slidesDir?.children) return;

  const slides = slidesDir.children
    .filter(c => c.kind === 'slide-directory' && c.slideId)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Skip rebuild if same slides
  const ids = slides.map(s => s.slideId).join(',');
  if (ids === state.slideEntries.map(s => s.slideId).join(',')) return;

  state.slideEntries = slides;
  if (state.currentSlide >= slides.length) state.currentSlide = Math.max(0, slides.length - 1);
  el.filmstrip.innerHTML = '';

  slides.forEach((slide, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'fs-thumb' + (i === state.currentSlide ? ' active' : '');

    const preview = document.createElement('div');
    preview.className = 'fs-preview';
    preview.textContent = String(i + 1);

    const label = document.createElement('div');
    label.className = 'fs-label';
    label.textContent = slide.slideId.replace(/-/g, ' ');

    thumb.append(preview, label);
    thumb.addEventListener('click', () => selectSlide(i));
    el.filmstrip.appendChild(thumb);
  });

  updateSlideCounter();
}

function selectSlide(index) {
  if (index < 0 || index >= state.slideEntries.length) return;
  state.currentSlide = index;

  // Update filmstrip active state
  const thumbs = el.filmstrip.querySelectorAll('.fs-thumb');
  thumbs.forEach((t, i) => t.classList.toggle('active', i === index));
  thumbs[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Navigate inside iframe (when live preview is connected)
  const slideId = state.slideEntries[index].slideId;
  try {
    el.previewFrame.contentWindow?.postMessage({ type: 'navigate-slide', slideId }, '*');
  } catch { /* cross-origin */ }

  updateSlideCounter();
}

function updateSlideCounter() {
  if (!state.slideEntries.length) {
    el.slideCounter.textContent = '';
    return;
  }
  el.slideCounter.textContent = `${state.currentSlide + 1} / ${state.slideEntries.length}`;
}

// Keyboard navigation — only when terminal isn't focused
document.addEventListener('keydown', (e) => {
  // Skip if terminal or input has focus
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (el.terminalContainer?.contains(document.activeElement)) return;
  if (!state.slideEntries.length) return;

  switch (e.key) {
    case 'ArrowDown': case 'ArrowRight': case 'PageDown':
      e.preventDefault(); selectSlide(state.currentSlide + 1); break;
    case 'ArrowUp': case 'ArrowLeft': case 'PageUp':
      e.preventDefault(); selectSlide(state.currentSlide - 1); break;
    case 'Home':
      e.preventDefault(); selectSlide(0); break;
    case 'End':
      e.preventDefault(); selectSlide(state.slideEntries.length - 1); break;
  }
});

// Listen for slide-visible messages from the preview iframe
window.addEventListener('message', (e) => {
  if (e.data?.type === 'slide-visible') {
    const idx = state.slideEntries.findIndex(s => s.slideId === e.data.slideId);
    if (idx >= 0 && idx !== state.currentSlide) {
      state.currentSlide = idx;
      const thumbs = el.filmstrip.querySelectorAll('.fs-thumb');
      thumbs.forEach((t, i) => t.classList.toggle('active', i === idx));
      thumbs[idx]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      updateSlideCounter();
    }
  }
});

function updateTerminalState(meta) {
  state.terminalMeta = meta;
  setJson(el.terminalMeta, meta || {});
  const alive = meta?.alive;
  const stopped = meta?.state === 'stopped';
  el.stopTerminal.style.display = alive ? '' : 'none';
  el.clearTerminal.style.display = (alive || stopped) ? '' : 'none';
  if (alive && xtermMounted) term.focus();
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
  // Auto-start shell in the project folder (projectContext is already set by onProjectChanged)
  window.electron.terminal.start('shell').catch(() => {});
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
  // Auto-start shell in the project folder
  window.electron.terminal.start('shell').catch(() => {});
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

async function refreshPreview() {
  const currentSlide = state.currentSlide;
  el.previewFrame.src = `presentation://preview/current?t=${Date.now()}`;
  await new Promise(resolve => { el.previewFrame.onload = resolve; });
  await refreshProjectPanels();
  selectSlide(currentSlide);
}

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
    case 'watch/change':
      el.watchStatus.textContent = event.file;
      if (state.hasProject && event.file) {
        refreshPreview();
      }
      break;
    case 'project/changed': await refreshProjectPanels(); break;
  }
});

refreshProjectPanels().catch(e => showToast(e.message));
