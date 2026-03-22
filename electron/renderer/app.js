import {
  deriveActionUiModel,
  deriveProjectUiModel,
  deriveTerminalUiModel,
  normalizeRuntimeActionResult,
} from './ui-model.js';

/* global Terminal, FitAddon */
const $ = (id) => document.getElementById(id);

const el = {
  appShell: $('app-shell'),
  choosePath: $('choose-path'),
  createProject: $('create-project'),
  projectNameLabel: $('project-name-label'),
  primaryAction: $('primary-action'),
  secondaryAction: $('secondary-action'),
  actionStatusLabel: $('action-status-label'),
  moreActions: $('more-actions'),
  moreMenu: $('more-menu'),
  moreMenuItems: $('more-menu-items'),
  stopTerminal: $('stop-terminal'),
  clearTerminal: $('clear-terminal'),
  welcomePanel: $('welcome-panel'),
  welcomeOpen: $('welcome-open'),
  welcomeCreate: $('welcome-create'),
  projectPath: $('project-path'),
  projectSlides: $('project-slides'),
  terminalPane: $('terminal-pane'),
  terminalStateLabel: $('terminal-state-label'),
  terminalRetry: $('terminal-retry'),
  terminalEmptyState: $('terminal-empty-state'),
  terminalEmptyTitle: $('terminal-empty-title'),
  terminalEmptyDetail: $('terminal-empty-detail'),
  terminalContainer: $('terminal-container'),
  previewPane: $('preview-pane'),
  previewFrame: $('preview-frame'),
  exportModal: $('export-modal'),
  exportClose: $('export-close'),
  exportFormatPdf: $('export-format-pdf'),
  exportFormatPng: $('export-format-png'),
  exportSlideSummary: $('export-slide-summary'),
  exportSlideList: $('export-slide-list'),
  exportSelectAll: $('export-select-all'),
  exportClear: $('export-clear'),
  exportChooseFolder: $('export-choose-folder'),
  exportFolderPath: $('export-folder-path'),
  exportCancel: $('export-cancel'),
  exportConfirm: $('export-confirm'),
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

const state = {
  meta: null,
  projectState: null,
  files: null,
  slides: [],
  terminalMeta: null,
  hasProject: false,
  agentActionAvailability: {
    fixValidationIssues: false,
    reviewNarrative: false,
    applyNarrativeChanges: false,
    reviewVisual: false,
    applyVisualChanges: false,
    reasonUnavailable: '',
  },
  actionModel: {
    primary: null,
    secondary: null,
    menu: [],
  },
  diagnosticsOpen: false,
  terminalAutoFollow: true,
  terminalStartError: '',
  actionStatusTimer: null,
  exportDraft: {
    open: false,
    format: 'pdf',
    slideIds: [],
    outputDir: '',
  },
};

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

function getActiveBuffer() {
  return term.buffer?.active || null;
}

function isViewportAtBottom(buffer = getActiveBuffer()) {
  if (!buffer) return true;
  return (buffer.baseY - buffer.viewportY) <= 1;
}

function getViewportDistanceFromBottom(buffer = getActiveBuffer()) {
  if (!buffer) return 0;
  return Math.max(0, buffer.baseY - buffer.viewportY);
}

function restoreViewportAfterUpdate(distanceFromBottom, followTail) {
  const buffer = getActiveBuffer();
  if (!buffer) return;

  if (followTail) {
    term.scrollToBottom();
    state.terminalAutoFollow = true;
    return;
  }

  const nextLine = Math.max(0, buffer.baseY - distanceFromBottom);
  term.scrollToLine(nextLine);
  state.terminalAutoFollow = false;
}

function writeTerminalOutput(chunk) {
  if (!chunk) return;
  const distanceFromBottom = getViewportDistanceFromBottom();
  const followTail = state.terminalAutoFollow || isViewportAtBottom();

  term.write(chunk, () => {
    restoreViewportAfterUpdate(distanceFromBottom, followTail);
  });
}

function mountXterm() {
  if (xtermMounted) return;
  term.open(el.terminalContainer);
  xtermMounted = true;
  state.terminalAutoFollow = true;
  requestAnimationFrame(() => fitAddon.fit());
}

function fitTerminal() {
  if (!xtermMounted) return;
  const distanceFromBottom = getViewportDistanceFromBottom();
  const followTail = state.terminalAutoFollow || isViewportAtBottom();
  try {
    fitAddon.fit();
    requestAnimationFrame(() => restoreViewportAfterUpdate(distanceFromBottom, followTail));
    const { cols, rows } = term;
    if (cols > 0 && rows > 0) window.electron.terminal.resize(cols, rows).catch(() => {});
  } catch {}
}

term.onData((data) => { if (state.terminalMeta?.alive) window.electron.terminal.send(data); });
term.onScroll(() => {
  state.terminalAutoFollow = isViewportAtBottom();
});

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

function setActionStatus(message = '', tone = 'neutral', timeoutMs = 0) {
  if (state.actionStatusTimer) {
    clearTimeout(state.actionStatusTimer);
    state.actionStatusTimer = null;
  }

  el.actionStatusLabel.textContent = message;
  el.actionStatusLabel.dataset.tone = tone;

  if (timeoutMs > 0 && message) {
    state.actionStatusTimer = setTimeout(() => {
      el.actionStatusLabel.textContent = '';
      el.actionStatusLabel.dataset.tone = 'neutral';
      state.actionStatusTimer = null;
    }, timeoutMs);
  }
}

function bindToolbarAction(button, action) {
  button.dataset.actionId = action?.id || '';
  button.textContent = action?.label || '';
  button.disabled = !action?.enabled;
  button.style.display = action ? '' : 'none';
  button.title = action?.enabled ? '' : (action?.reasonDisabled || '');
}

function humanizeSlideId(slideId = '') {
  return String(slideId || '')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getExportPrimaryLabel(format = 'pdf') {
  return format === 'png' ? 'Export PNGs' : 'Export PDF';
}

function getExportSlideEntries() {
  return Array.isArray(state.slides) ? state.slides : [];
}

function createDefaultExportDraft() {
  return {
    open: true,
    format: 'pdf',
    outputDir: '',
    slideIds: getExportSlideEntries().map((slide) => slide.id),
  };
}

function closeExportModal() {
  state.exportDraft = {
    open: false,
    format: 'pdf',
    outputDir: '',
    slideIds: [],
  };
  renderExportModal();
}

function renderExportModal() {
  const open = Boolean(state.exportDraft.open);
  el.exportModal.dataset.open = open ? 'true' : 'false';
  el.exportModal.style.display = open ? '' : 'none';
  if (!open) {
    return;
  }

  const slides = getExportSlideEntries();
  const selected = new Set(state.exportDraft.slideIds);
  el.exportFormatPdf.checked = state.exportDraft.format === 'pdf';
  el.exportFormatPng.checked = state.exportDraft.format === 'png';
  el.exportSlideSummary.textContent = `${selected.size} of ${slides.length} slide${slides.length === 1 ? '' : 's'} selected`;
  el.exportFolderPath.textContent = state.exportDraft.outputDir || 'No folder selected';
  el.exportConfirm.textContent = getExportPrimaryLabel(state.exportDraft.format);
  el.exportConfirm.disabled = selected.size === 0 || !state.exportDraft.outputDir;

  el.exportSlideList.innerHTML = '';
  for (const slide of slides) {
    const label = document.createElement('label');
    label.className = 'export-slide-option';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = slide.id;
    input.checked = selected.has(slide.id);

    const textWrap = document.createElement('span');
    textWrap.className = 'export-slide-text';

    const order = document.createElement('span');
    order.className = 'export-slide-order';
    order.textContent = slide.orderLabel || slide.dirName || slide.id;

    const name = document.createElement('span');
    name.className = 'export-slide-name';
    name.textContent = humanizeSlideId(slide.id);

    textWrap.append(order, name);
    label.append(input, textWrap);
    el.exportSlideList.appendChild(label);
  }
}

function renderMenuActions(menuActions = []) {
  el.moreMenuItems.innerHTML = '';

  if (menuActions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'menu-empty';
    empty.textContent = 'No more actions right now.';
    el.moreMenuItems.appendChild(empty);
    return;
  }

  for (const action of menuActions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'menu-item';
    button.dataset.actionId = action.id;
    button.textContent = action.label;
    button.disabled = !action.enabled;
    button.title = action.enabled ? '' : (action.reasonDisabled || '');
    el.moreMenuItems.appendChild(button);
  }
}

function renderActionControls() {
  const model = deriveActionUiModel({
    meta: state.meta,
    projectState: state.projectState,
    agentActionAvailability: state.agentActionAvailability,
  });
  state.actionModel = model;
  bindToolbarAction(el.primaryAction, model.primary);
  bindToolbarAction(el.secondaryAction, model.secondary);
  renderMenuActions(model.menu);

  const moreEnabled = state.hasProject && model.menu.length > 0;
  el.moreActions.disabled = !moreEnabled;
  el.moreActions.style.display = state.hasProject ? '' : 'none';
}

// ── Layout ──
function showProjectLayout() {
  el.welcomePanel.style.display = 'none';
  el.terminalPane.style.display = 'flex';
  el.previewPane.style.display = 'flex';
  requestAnimationFrame(() => { mountXterm(); fitTerminal(); });
}

function showWelcomeLayout() {
  el.welcomePanel.style.display = 'flex';
  el.previewPane.style.display = 'none';
  el.terminalPane.style.display = 'none';
}

window.addEventListener('resize', () => fitTerminal());

// ── State ──
function updateAppState() {
  const has = Boolean(state.meta?.active);
  state.hasProject = has;
  el.appShell.dataset.state = has ? 'project-active' : 'no-project';
  if (!has) {
    setActionStatus('');
    closeExportModal();
  }
  has ? showProjectLayout() : showWelcomeLayout();
  const model = deriveProjectUiModel({
    meta: state.meta,
    projectState: state.projectState,
  });

  renderActionControls();

  el.projectNameLabel.textContent = has
    ? (state.meta.title || state.meta.slug || 'Untitled')
    : '';

  // Hidden compat
  if (has && state.meta) {
    if (el.projectTitle) el.projectTitle.textContent = state.meta.title || '';
    if (el.projectPathLabel) el.projectPathLabel.textContent = state.meta.projectRoot || '';
    if (el.statusPill) { el.statusPill.textContent = model.status.label; }
    const sc = countSlides(state.files);
    if (el.slideCount) el.slideCount.textContent = sc > 0 ? `${sc} slides` : '';
  }

  if (has && !el.previewFrame.src?.startsWith('presentation://')) loadPreview();

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
}

function updateTerminalState(meta) {
  const wasAlive = Boolean(state.terminalMeta?.alive);
  state.terminalMeta = meta;
  if (meta?.alive) {
    state.terminalStartError = '';
  }
  setJson(el.terminalMeta, meta || {});
  const model = deriveTerminalUiModel({
    meta,
    startError: state.terminalStartError,
  });
  el.stopTerminal.style.display = model.showStop ? '' : 'none';
  el.clearTerminal.style.display = model.showClear ? '' : 'none';
  el.terminalRetry.style.display = model.showRetry ? '' : 'none';
  el.terminalStateLabel.textContent = model.label;
  el.terminalEmptyState.style.display = model.showTerminal ? 'none' : 'flex';
  el.terminalEmptyTitle.textContent = model.label;
  el.terminalEmptyDetail.textContent = model.detail;
  el.terminalContainer.style.display = model.showTerminal ? '' : 'none';
  if (!wasAlive && meta?.alive && xtermMounted) term.focus();
  if (!meta?.alive) state.terminalAutoFollow = true;
}

async function refreshProjectPanels() {
  const [meta, ps, files, slidesResponse, tm, agentActionAvailability] = await Promise.all([
    window.electron.project.getMeta(),
    window.electron.project.getState(),
    window.electron.project.getFiles().catch(() => ({ root: '', tree: {} })),
    window.electron.project.getSlides().catch(() => ({ slides: [] })),
    window.electron.terminal.getMeta(),
    window.electron.review.getAvailability().catch(() => ({
      fixValidationIssues: false,
      reviewNarrative: false,
      applyNarrativeChanges: false,
      reviewVisual: false,
      applyVisualChanges: false,
      reasonUnavailable: 'Agent actions are unavailable right now.',
    })),
  ]);
  state.meta = meta;
  state.projectState = ps;
  state.files = files;
  state.slides = slidesResponse.slides || [];
  state.agentActionAvailability = agentActionAvailability || state.agentActionAvailability;
  updateAppState(); updateTerminalState(tm);
  setJson(el.actionJson, state.actionModel || {});
  renderExportModal();
}

async function runAction(fn, btn = null) {
  setLoading(btn, true);
  try {
    const r = await fn();
    setJson(el.actionJson, r);
    await refreshProjectPanels();
    return r;
  } catch (e) {
    const message = e?.message || 'Something went wrong.';
    showToast(message, 'error');
    throw e;
  } finally {
    setLoading(btn, false);
  }
}

function getActionDescriptor(actionId) {
  const descriptors = [
    state.actionModel.primary,
    state.actionModel.secondary,
    ...state.actionModel.menu,
  ].filter(Boolean);
  return descriptors.find((action) => action.id === actionId) || null;
}

function invokeProductAction(actionId, args = {}) {
  return window.electron.actions.invoke(actionId, args);
}

async function runProductAction(actionId, btn = null, args = {}) {
  const action = getActionDescriptor(actionId);
  if (!action) {
    throw new Error(`Unknown action "${actionId}".`);
  }

  el.moreMenu.style.display = 'none';
  setActionStatus(`${action.label} running...`, 'neutral');
  const result = await runAction(() => invokeProductAction(actionId, args), btn);
  const feedback = normalizeRuntimeActionResult(action.label, result);
  setActionStatus(feedback.message, feedback.tone, 3600);
  showToast(
    feedback.detail ? `${feedback.message} ${feedback.detail}` : feedback.message,
    feedback.tone === 'error' ? 'error' : feedback.tone === 'warning' ? 'warning' : 'success',
    feedback.tone === 'error' ? 5000 : 3200
  );
  return result;
}

function openExportModal() {
  if (!state.hasProject) {
    return;
  }
  if (getExportSlideEntries().length === 0) {
    showToast('No slides are available to export yet.', 'warning');
    return;
  }
  state.exportDraft = createDefaultExportDraft();
  renderExportModal();
}

async function chooseExportFolder() {
  const result = await window.electron.system.chooseDirectory();
  if (!result?.canceled && result?.path) {
    state.exportDraft.outputDir = result.path;
    renderExportModal();
  }
}

async function submitExport() {
  const args = {
    format: state.exportDraft.format,
    slideIds: [...state.exportDraft.slideIds],
    outputDir: state.exportDraft.outputDir,
  };
  await runProductAction('export.start', el.exportConfirm, args);
  closeExportModal();
}

async function startShellSession() {
  state.terminalStartError = '';
  updateTerminalState({
    ...(state.terminalMeta || {}),
    alive: false,
    state: 'starting',
    mode: 'shell',
  });

  try {
    const meta = await window.electron.terminal.start();
    updateTerminalState(meta);
    return meta;
  } catch (e) {
    state.terminalStartError = e?.message || 'Terminal failed to start.';
    const meta = await window.electron.terminal.getMeta().catch(() => ({
      alive: false,
      state: 'stopped',
    }));
    updateTerminalState(meta);
    showToast(state.terminalStartError, 'error');
    return null;
  }
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
  try {
    await runAction(async () => window.electron.project.open({ projectRoot: p }));
    await startShellSession();
  } catch (e) {
    if (e?.needsInitialization) {
      showToast('That folder is not an initialized presentation project yet.', 'error');
    }
  }
}

async function createProject() {
  const chosen = await choosePath();
  if (!chosen) return;
  const n = parseInt(el.projectSlides.value || '3', 10);
  await runAction(async () => window.electron.project.create({ projectRoot: chosen, slideCount: n }), el.createProject);
  await startShellSession();
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
  el.previewFrame.src = `presentation://preview/current?t=${Date.now()}`;
  await new Promise(resolve => { el.previewFrame.onload = resolve; });
  await refreshProjectPanels();
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
el.primaryAction.addEventListener('click', () => {
  const actionId = el.primaryAction.dataset.actionId;
  if (actionId) {
    runProductAction(actionId, el.primaryAction).catch(() => {});
  }
});
el.secondaryAction.addEventListener('click', () => {
  const actionId = el.secondaryAction.dataset.actionId;
  if (actionId) {
    runProductAction(actionId, el.secondaryAction).catch(() => {});
  }
});
el.moreMenuItems.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action-id]');
  if (!button || button.disabled) {
    return;
  }

  runProductAction(button.dataset.actionId, button).catch(() => {});
});

el.stopTerminal.addEventListener('click', () => runAction(() => window.electron.terminal.stop(), el.stopTerminal));
el.clearTerminal.addEventListener('click', () => runAction(async () => { term.clear(); return window.electron.terminal.clear(); }, el.clearTerminal));
el.terminalRetry.addEventListener('click', () => startShellSession());

el.exportModal.addEventListener('click', (event) => {
  if (event.target === el.exportModal || event.target.classList.contains('shell-modal-backdrop')) {
    closeExportModal();
  }
});
el.exportClose.addEventListener('click', closeExportModal);
el.exportCancel.addEventListener('click', closeExportModal);
el.exportFormatPdf.addEventListener('change', () => {
  state.exportDraft.format = 'pdf';
  renderExportModal();
});
el.exportFormatPng.addEventListener('change', () => {
  state.exportDraft.format = 'png';
  renderExportModal();
});
el.exportSelectAll.addEventListener('click', () => {
  state.exportDraft.slideIds = getExportSlideEntries().map((slide) => slide.id);
  renderExportModal();
});
el.exportClear.addEventListener('click', () => {
  state.exportDraft.slideIds = [];
  renderExportModal();
});
el.exportSlideList.addEventListener('change', (event) => {
  const input = event.target.closest('input[type="checkbox"]');
  if (!input) {
    return;
  }

  const selected = new Set(state.exportDraft.slideIds);
  if (input.checked) {
    selected.add(input.value);
  } else {
    selected.delete(input.value);
  }
  state.exportDraft.slideIds = getExportSlideEntries()
    .map((slide) => slide.id)
    .filter((slideId) => selected.has(slideId));
  renderExportModal();
});
el.exportChooseFolder.addEventListener('click', () => {
  chooseExportFolder().catch((error) => showToast(error.message, 'error'));
});
el.exportConfirm.addEventListener('click', () => {
  submitExport().catch((error) => showToast(error.message, 'error'));
});

el.closeDiagnostics.addEventListener('click', toggleDiag);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.exportDraft.open) {
    event.preventDefault();
    closeExportModal();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    toggleDiag();
  }
});

function handleActionEvent(event) {
  switch (event.status) {
    case 'queued':
    case 'running':
      setActionStatus(event.message || 'Working...', 'neutral');
      break;
    case 'needs_input':
      setActionStatus(event.message || 'Action needs review.', 'warning', 5000);
      break;
    case 'succeeded':
      setActionStatus(event.message || 'Action completed.', 'success', 3600);
      break;
    case 'failed':
      setActionStatus(event.message || 'Action failed.', 'error', 5000);
      break;
    default:
      break;
  }
  setJson(el.actionJson, event || {});
}

window.electron.build.onEvent(handleActionEvent);
window.electron.export.onEvent(handleActionEvent);
window.electron.review.onEvent(handleActionEvent);
window.electron.terminal.onOutput((event) => {
  writeTerminalOutput(event.data || '');
});
window.electron.terminal.onEvent(async (event) => {
  switch (event.channel) {
    case 'terminal/clear':
      state.terminalAutoFollow = true;
      term.clear();
      break;
    case 'terminal/ready':
    case 'terminal/meta':
    case 'terminal/exit':
      updateTerminalState(await window.electron.terminal.getMeta());
      break;
    case 'terminal/error':
      state.terminalStartError = event.message || 'Terminal failed to start.';
      updateTerminalState(await window.electron.terminal.getMeta().catch(() => state.terminalMeta));
      showToast(state.terminalStartError, 'error');
      break;
    default:
      break;
  }
});
window.electron.project.onChanged(() => {
  refreshProjectPanels().catch((error) => showToast(error.message, 'error'));
});
window.electron.preview.onChanged(() => {
  if (!state.hasProject) {
    return;
  }
  refreshPreview().catch((error) => showToast(error.message, 'error'));
});

refreshProjectPanels().catch(e => showToast(e.message));
