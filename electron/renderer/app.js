import {
  deriveActionUiModel,
  deriveProjectUiModel,
  deriveTerminalUiModel,
  formatTerminalOutputEvent,
  normalizeRuntimeActionResult,
} from './ui-model.js';
import {
  getTerminalClipboardAction,
  getTerminalContextMenuItems,
  getTerminalShortcutHint,
  getTerminalSurfaceState,
  runTerminalClipboardAction,
} from './terminal-interaction.js';
import {
  createTerminalProjectPathLinkProvider,
  openTerminalExternalLink,
} from './terminal-links.js';
import {
  getTerminalSearchAction,
  getTerminalSearchUiModel,
  isTerminalSearchShortcut,
} from './terminal-search.js';
import { renderElectronPreviewHtml } from '../preview-document-shell.mjs';

/* global Terminal, FitAddon, SearchAddon, WebLinksAddon */
const $ = (id) => document.getElementById(id);

// -----------------------------------------------------------------------------
// DOM Wiring and UI State
// -----------------------------------------------------------------------------

const el = {
  appShell: $('app-shell'),
  mainSplit: document.querySelector('.main-split'),
  choosePath: $('choose-path'),
  createProject: $('create-project'),
  projectNameLabel: $('project-name-label'),
  projectContextLabel: $('project-context-label'),
  primaryAction: $('primary-action'),
  secondaryAction: $('secondary-action'),
  actionStatusLabel: $('action-status-label'),
  moreActions: $('more-actions'),
  moreMenu: $('more-menu'),
  moreMenuItems: $('more-menu-items'),
  stopTerminal: $('stop-terminal'),
  clearTerminal: $('clear-terminal'),
  terminalFind: $('terminal-find'),
  terminalSearch: $('terminal-search'),
  terminalSearchInput: $('terminal-search-input'),
  terminalSearchPrev: $('terminal-search-prev'),
  terminalSearchNext: $('terminal-search-next'),
  terminalSearchClose: $('terminal-search-close'),
  welcomePanel: $('welcome-panel'),
  projectPath: $('project-path'),
  projectSlides: $('project-slides'),
  projectLauncherModal: $('project-launcher-modal'),
  projectLauncherTitle: $('project-launcher-title'),
  projectLauncherSubtitle: $('project-launcher-subtitle'),
  projectLauncherPathInput: $('project-launcher-path-input'),
  projectLauncherBrowse: $('project-launcher-browse'),
  projectLauncherSlidesField: $('project-launcher-slides-field'),
  projectLauncherSlidesInput: $('project-launcher-slides-input'),
  projectLauncherClose: $('project-launcher-close'),
  projectLauncherCancel: $('project-launcher-cancel'),
  projectLauncherSubmit: $('project-launcher-submit'),
  terminalPane: $('terminal-pane'),
  terminalStateLabel: $('terminal-state-label'),
  terminalRetry: $('terminal-retry'),
  terminalEmptyState: $('terminal-empty-state'),
  terminalEmptyTitle: $('terminal-empty-title'),
  terminalEmptyDetail: $('terminal-empty-detail'),
  terminalContainer: $('terminal-container'),
  previewPane: $('preview-pane'),
  paneSplitHandle: $('pane-split-handle'),
  previewSubtitle: $('preview-subtitle'),
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
  actionDescriptors: [],
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
  projectLauncher: {
    open: false,
    mode: 'create',
    path: '',
    slides: 3,
  },
  paneSplitPercent: 52,
  paneDrag: {
    active: false,
    pointerId: null,
  },
  pendingTerminalChunks: [],
  terminalFlushScheduled: false,
  previewRefreshTimer: null,
  projectRefreshTimer: null,
  terminalFitScheduled: false,
  loadedPreviewProjectRoot: '',
  terminalSearch: {
    open: false,
    query: '',
  },
};

// ── xterm ──
const FitAddonClass = (typeof FitAddon === 'function') ? FitAddon : FitAddon.FitAddon;
const SearchAddonClass = (typeof SearchAddon === 'function') ? SearchAddon : SearchAddon.SearchAddon;
const WebLinksAddonClass = (typeof WebLinksAddon === 'function') ? WebLinksAddon : WebLinksAddon.WebLinksAddon;
const fitAddon = new FitAddonClass();
const searchAddon = new SearchAddonClass();
const webLinksAddon = new WebLinksAddonClass((event, uri) => {
  openTerminalExternalLink(uri, {
    openExternal: (targetUrl) => window.electron.system.openExternal(targetUrl),
  }).catch(() => {});
});
const term = new Terminal({
  cursorBlink: true, cursorStyle: 'block', fontSize: 14,
  fontFamily: 'Menlo, "DejaVu Sans Mono", Consolas, monospace',
  lineHeight: 1.2,
  theme: {
    background: '#1e1e1e', foreground: '#cccccc', cursor: '#aeafad', cursorAccent: '#1e1e1e',
    selectionBackground: 'rgba(124, 183, 244, 0.34)', selectionInactiveBackground: 'rgba(124, 183, 244, 0.22)', selectionForeground: '#ffffff',
    black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510',
    blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
    brightBlack: '#666666', brightRed: '#f14c4c', brightGreen: '#23d18b', brightYellow: '#f5f543',
    brightBlue: '#3b8eea', brightMagenta: '#d670d6', brightCyan: '#29b8db', brightWhite: '#e5e5e5',
  },
  scrollback: 5000, allowProposedApi: true,
});
term.loadAddon(fitAddon);
term.loadAddon(searchAddon);
term.loadAddon(webLinksAddon);
term.registerLinkProvider(createTerminalProjectPathLinkProvider(term, {
  getProjectRoot: () => state.meta?.projectRoot || state.terminalMeta?.projectRoot || '',
  onActivate: (targetPath) => {
    window.electron.terminal.reveal(targetPath).catch(() => {});
  },
}));
let xtermMounted = false;

// -----------------------------------------------------------------------------
// Terminal Rendering
// -----------------------------------------------------------------------------

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

function flushTerminalOutputQueue() {
  state.terminalFlushScheduled = false;
  if (state.pendingTerminalChunks.length === 0) {
    return;
  }

  const chunk = state.pendingTerminalChunks.join('');
  state.pendingTerminalChunks.length = 0;

  const distanceFromBottom = getViewportDistanceFromBottom();
  const followTail = state.terminalAutoFollow || isViewportAtBottom();

  term.write(chunk, () => {
    restoreViewportAfterUpdate(distanceFromBottom, followTail);
  });
}

function scheduleTerminalFlush() {
  if (state.terminalFlushScheduled) {
    return;
  }

  state.terminalFlushScheduled = true;
  requestAnimationFrame(() => flushTerminalOutputQueue());
}

function writeTerminalOutput(chunk) {
  if (!chunk) return;
  state.pendingTerminalChunks.push(chunk);
  scheduleTerminalFlush();
}

function mountXterm() {
  if (xtermMounted) return;
  term.open(el.terminalContainer);
  xtermMounted = true;
  state.terminalAutoFollow = true;
  updateTerminalSurfaceState();
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

function scheduleTerminalFit() {
  if (state.terminalFitScheduled) {
    return;
  }

  state.terminalFitScheduled = true;
  requestAnimationFrame(() => {
    state.terminalFitScheduled = false;
    fitTerminal();
  });
}

function applyPaneSplit() {
  el.appShell.style.setProperty('--terminal-pane-percent', String(state.paneSplitPercent));
}

function clampPaneSplitPercent(value) {
  return Math.max(32, Math.min(68, value));
}

function updatePaneSplitFromClientX(clientX) {
  const bounds = el.mainSplit?.getBoundingClientRect?.() || null;
  if (!bounds || bounds.width <= 0) {
    return;
  }

  const nextPercent = clampPaneSplitPercent(((clientX - bounds.left) / bounds.width) * 100);
  if (Math.abs(nextPercent - state.paneSplitPercent) < 0.25) {
    return;
  }

  state.paneSplitPercent = nextPercent;
  applyPaneSplit();
  scheduleTerminalFit();
}

term.onData((data) => {
  if (state.terminalMeta?.alive) {
    window.electron.terminal.send(data);
  }
});
term.onScroll(() => {
  state.terminalAutoFollow = isViewportAtBottom();
});
term.onSelectionChange(() => {
  updateTerminalSurfaceState();
});

function isTerminalFocused() {
  return Boolean(
    state.terminalMeta?.alive
    && xtermMounted
    && document.activeElement
    && el.terminalPane.contains(document.activeElement)
  );
}

function updateTerminalSurfaceState() {
  const surfaceState = getTerminalSurfaceState({
    terminalFocused: isTerminalFocused(),
    hasSelection: term.hasSelection(),
  });
  el.terminalPane.dataset.terminalFocused = surfaceState.focused;
  el.terminalPane.dataset.terminalSelection = surfaceState.selection;
  el.terminalContainer.title = getTerminalShortcutHint({
    platform: navigator.userAgentData?.platform || (navigator.platform || ''),
  });
}

function renderTerminalSearch() {
  const model = getTerminalSearchUiModel(state.terminalSearch);
  el.terminalSearch.dataset.open = model.open ? 'true' : 'false';
  el.terminalSearch.style.display = model.open ? '' : 'none';
  el.terminalSearchInput.placeholder = model.placeholder;
  if (el.terminalSearchInput.value !== model.query) {
    el.terminalSearchInput.value = model.query;
  }
  el.terminalSearchPrev.disabled = !model.canNavigate;
  el.terminalSearchNext.disabled = !model.canNavigate;
}

function applyTerminalSearch(direction = 'next') {
  const query = String(state.terminalSearch.query || '');
  if (!query.trim()) {
    renderTerminalSearch();
    return false;
  }

  if (direction === 'previous') {
    return searchAddon.findPrevious(query);
  }

  return searchAddon.findNext(query);
}

function openTerminalSearch(prefill = state.terminalSearch.query || '') {
  state.terminalSearch.open = true;
  state.terminalSearch.query = String(prefill || state.terminalSearch.query || '');
  renderTerminalSearch();
  requestAnimationFrame(() => {
    el.terminalSearchInput.focus();
    el.terminalSearchInput.select();
  });
}

function closeTerminalSearch() {
  state.terminalSearch.open = false;
  renderTerminalSearch();
  term.focus();
}

async function handleTerminalClipboardShortcut(event) {
  const action = getTerminalClipboardAction({
    platform: navigator.userAgentData?.platform || (navigator.platform || ''),
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    terminalFocused: isTerminalFocused(),
    hasSelection: term.hasSelection(),
  });

  if (!action) {
    return false;
  }

  event.preventDefault();
  await runTerminalClipboardAction(action, {
    terminal: term,
    clipboard: {
      readText: () => window.electron.system.readClipboardText(),
      writeText: (value) => window.electron.system.writeClipboardText(value),
    },
    sendTerminalInput: (value) => window.electron.terminal.send(value),
  });
  return true;
}

async function openTerminalContextMenu(event) {
  if (!state.terminalMeta?.alive || !xtermMounted) {
    return;
  }

  event.preventDefault();
  const items = getTerminalContextMenuItems({
    terminalFocused: true,
    hasSelection: term.hasSelection(),
  });
  if (items.length === 0) {
    return;
  }

  await window.electron.terminal.showContextMenu({
    items,
    selectionText: term.getSelection(),
  });
}

// -----------------------------------------------------------------------------
// UI Helpers and Export Modal
// -----------------------------------------------------------------------------

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

function openProjectLauncher(mode = 'create') {
  state.projectLauncher = {
    open: true,
    mode,
    path: el.projectPath.value.trim(),
    slides: Math.max(1, Number.parseInt(el.projectSlides.value || '3', 10) || 3),
  };
  renderProjectLauncher();
  requestAnimationFrame(() => {
    el.projectLauncherPathInput.focus();
    el.projectLauncherPathInput.select();
  });
}

function closeProjectLauncher() {
  state.projectLauncher.open = false;
  renderProjectLauncher();
}

function renderProjectLauncher() {
  const open = Boolean(state.projectLauncher.open);
  const createMode = state.projectLauncher.mode !== 'open';
  const trimmedPath = String(state.projectLauncher.path || '').trim();
  const slideCount = Math.max(1, Number.parseInt(String(state.projectLauncher.slides || '3'), 10) || 3);

  el.projectLauncherModal.dataset.open = open ? 'true' : 'false';
  el.projectLauncherModal.style.display = open ? '' : 'none';
  if (!open) {
    return;
  }

  el.projectLauncherTitle.textContent = createMode ? 'New project' : 'Open project';
  el.projectLauncherSubtitle.textContent = createMode
    ? 'Type a folder path for the new project, or browse to choose one.'
    : 'Type an existing project folder path, or browse to choose one.';
  el.projectLauncherPathInput.value = trimmedPath;
  el.projectLauncherSlidesField.style.display = createMode ? '' : 'none';
  el.projectLauncherSlidesInput.value = String(slideCount);
  el.projectLauncherSubmit.textContent = createMode ? 'Create project' : 'Open project';
  el.projectLauncherSubmit.disabled = !trimmedPath;
}

async function browseProjectLauncher() {
  const chosenPath = await choosePath();
  if (!chosenPath) {
    return;
  }

  state.projectLauncher.path = chosenPath;
  renderProjectLauncher();
}

async function submitProjectLauncher() {
  const projectRoot = String(state.projectLauncher.path || '').trim();
  if (!projectRoot) {
    return;
  }

  const slideCount = Math.max(1, Number.parseInt(String(state.projectLauncher.slides || '3'), 10) || 3);
  el.projectPath.value = projectRoot;
  el.projectSlides.value = String(slideCount);

  if (state.projectLauncher.mode === 'open') {
    await runAction(async () => window.electron.project.open({ projectRoot }), el.projectLauncherSubmit);
  } else {
    await runAction(async () => window.electron.project.create({ projectRoot, slideCount }), el.projectLauncherSubmit);
  }

  closeProjectLauncher();
}

function getMenuSections(menuActions = []) {
  const sections = [
    {
      label: 'Project',
      actions: menuActions.filter((action) => action.id === 'validate_presentation'),
    },
    {
      label: 'Capture',
      actions: menuActions.filter((action) => action.id === 'capture_screenshots'),
    },
    {
      label: 'Review',
      actions: menuActions.filter((action) => [
        'review_narrative_presentation',
        'review_visual_presentation',
      ].includes(action.id)),
    },
    {
      label: 'Fix',
      actions: menuActions.filter((action) => [
        'fix_validation_issues',
        'apply_narrative_review_changes',
        'apply_visual_review_changes',
      ].includes(action.id)),
    },
  ];

  return sections.filter((section) => section.actions.length > 0);
}

function renderMenuActions(menuActions = []) {
  el.moreMenuItems.innerHTML = '';

  if (menuActions.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'menu-empty';
    empty.textContent = 'No additional actions are available right now.';
    el.moreMenuItems.appendChild(empty);
    return;
  }

  for (const section of getMenuSections(menuActions)) {
    const label = document.createElement('div');
    label.className = 'menu-section-label';
    label.textContent = section.label;
    el.moreMenuItems.appendChild(label);

    for (const action of section.actions) {
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
}

function renderActionControls() {
  const model = deriveActionUiModel({
    meta: state.meta,
    projectState: state.projectState,
    actions: state.actionDescriptors,
  });
  state.actionModel = model;
  bindToolbarAction(el.primaryAction, model.primary);
  bindToolbarAction(el.secondaryAction, model.secondary);
  renderMenuActions(model.menu);

  const moreEnabled = state.hasProject && model.menu.length > 0;
  el.moreActions.disabled = !moreEnabled;
  el.moreActions.style.display = state.hasProject ? '' : 'none';
}

// -----------------------------------------------------------------------------
// Layout and Derived State
// -----------------------------------------------------------------------------

function showProjectLayout() {
  el.welcomePanel.style.display = 'none';
  el.terminalPane.style.display = 'flex';
  el.previewPane.style.display = 'flex';
  el.paneSplitHandle.style.display = window.innerWidth >= 1024 ? 'block' : 'none';
  applyPaneSplit();
  requestAnimationFrame(() => { mountXterm(); scheduleTerminalFit(); });
}

function showWelcomeLayout() {
  el.welcomePanel.style.display = 'flex';
  el.previewPane.style.display = 'none';
  el.terminalPane.style.display = 'none';
  el.paneSplitHandle.style.display = 'none';
}

window.addEventListener('resize', () => {
  if (state.hasProject) {
    el.paneSplitHandle.style.display = window.innerWidth >= 1024 ? 'block' : 'none';
    applyPaneSplit();
  }
  scheduleTerminalFit();
});

// ── State ──
function updateAppState() {
  const has = Boolean(state.meta?.active);
  state.hasProject = has;
  el.appShell.dataset.state = has ? 'project-active' : 'no-project';
  if (!has) {
    setActionStatus('');
    closeExportModal();
    state.loadedPreviewProjectRoot = '';
    el.previewFrame.removeAttribute('src');
    el.previewFrame.srcdoc = '';
    delete el.previewPane.dataset.previewKind;
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
  el.projectContextLabel.textContent = has ? formatProjectContext(state.meta, model) : '';
  el.previewSubtitle.textContent = has
    ? formatPreviewSubtitle(state.projectState, state.files)
    : 'Live preview';

  // Hidden compat
  if (has && state.meta) {
    if (el.projectTitle) el.projectTitle.textContent = state.meta.title || '';
    if (el.projectPathLabel) el.projectPathLabel.textContent = state.meta.projectRoot || '';
    if (el.statusPill) { el.statusPill.textContent = model.status.label; }
    const sc = countSlides(state.files);
    if (el.slideCount) el.slideCount.textContent = sc > 0 ? `${sc} slides` : '';
  }

  if (has && state.loadedPreviewProjectRoot !== state.meta?.projectRoot) loadPreview();

  setJson(el.metaJson, state.meta || {});
  setJson(el.stateJson, state.projectState || {});
  setJson(el.filesJson, state.files || {});
}

function countSlides(f) {
  if (!f?.tree?.children) return 0;
  const sd = f.tree.children.find(c => c.name === 'slides');
  return sd?.children ? sd.children.filter(c => c.isDirectory || c.kind === 'slide-directory').length : 0;
}

function formatProjectContext(meta, model) {
  if (!meta?.active) {
    return '';
  }

  const folderName = formatProjectLeaf(meta.projectRoot || '') || meta.slug || '';
  const statusLabel = model?.status?.label || '';
  return [folderName, statusLabel].filter(Boolean).join(' • ');
}

function formatPreviewSubtitle(projectState, files) {
  const slideCount = countSlides(files);
  const status = projectState?.status || '';

  switch (status) {
    case 'ready_to_finalize':
      return 'Ready to export';
    case 'finalized':
      return 'Live preview';
    case 'policy_error':
      return 'Preview blocked';
    case 'onboarding':
    case 'in_progress':
      return 'Draft preview';
    default:
      return slideCount > 0 ? 'Live preview' : 'Preview';
  }
}

function loadPreview() {
  schedulePreviewRefresh(0);
}

function formatProjectLeaf(pathValue = '') {
  return String(pathValue || '').split(/[\\/]/).filter(Boolean).at(-1) || '';
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
  el.clearTerminal.style.display = 'none';
  el.terminalFind.style.display = model.showTerminal ? '' : 'none';
  el.terminalRetry.style.display = model.showRetry ? '' : 'none';
  const projectLeaf = formatProjectLeaf(meta?.projectRoot || state.meta?.projectRoot || '');
  const runningSubtitle = [model.label, projectLeaf, model.context, model.cwdContext, model.commandContext].filter(Boolean).join(' • ');
  el.terminalStateLabel.textContent = meta?.alive
    ? (runningSubtitle || model.label)
    : model.label;
  el.terminalEmptyState.style.display = model.showTerminal ? 'none' : 'flex';
  el.terminalEmptyTitle.textContent = model.label;
  el.terminalEmptyDetail.textContent = model.detail;
  el.terminalContainer.style.display = model.showTerminal ? '' : 'none';
  if (!model.showTerminal && state.terminalSearch.open) {
    state.terminalSearch.open = false;
  }
  renderTerminalSearch();
  if (!wasAlive && meta?.alive && xtermMounted) term.focus();
  if (!meta?.alive) state.terminalAutoFollow = true;
  updateTerminalSurfaceState();
}

async function refreshProjectPanels() {
  const [meta, ps, files, slidesResponse, tm, actionDescriptorsResponse] = await Promise.all([
    window.electron.project.getMeta(),
    window.electron.project.getState(),
    window.electron.project.getFiles().catch(() => ({ root: '', tree: {} })),
    window.electron.project.getSlides().catch(() => ({ slides: [] })),
    window.electron.terminal.getMeta(),
    window.electron.actions.list().catch(() => ({ actions: [] })),
  ]);
  state.meta = meta;
  state.projectState = ps;
  state.files = files;
  state.slides = slidesResponse.slides || [];
  state.actionDescriptors = actionDescriptorsResponse.actions || [];
  updateAppState(); updateTerminalState(tm);
  setJson(el.actionJson, { actions: state.actionDescriptors });
  renderExportModal();
}

function scheduleProjectPanelsRefresh(delayMs = 120) {
  if (state.projectRefreshTimer) {
    clearTimeout(state.projectRefreshTimer);
  }

  state.projectRefreshTimer = setTimeout(() => {
    state.projectRefreshTimer = null;
    refreshProjectPanels().catch((error) => showToast(error.message, 'error'));
  }, delayMs);
}

// -----------------------------------------------------------------------------
// Action Invocation and Terminal Control
// -----------------------------------------------------------------------------

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
  return state.actionDescriptors.find((action) => action.id === actionId) || null;
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
  await runProductAction('export_presentation_artifacts', el.exportConfirm, args);
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

// -----------------------------------------------------------------------------
// Project Lifecycle and Menu Actions
// -----------------------------------------------------------------------------

async function choosePath() {
  try {
    const r = await window.electron.system.chooseDirectory();
    if (!r?.canceled && r?.path) { el.projectPath.value = r.path; return r.path; }
  } catch (e) { showToast(e.message); }
  return null;
}

async function openProject(path) {
  const p = path || el.projectPath.value.trim();
  if (!p) {
    openProjectLauncher('open');
    return;
  }
  try {
    await runAction(async () => window.electron.project.open({ projectRoot: p }));
  } catch (e) {
    if (e?.needsInitialization) {
      showToast('That folder is not an initialized presentation project yet.', 'error');
    }
  }
}

function createProject() {
  openProjectLauncher('create');
}

function toolbarOpen() {
  openProjectLauncher('open');
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
  const previewDocument = await window.electron.preview.getDocument();
  const html = renderElectronPreviewHtml(previewDocument?.html || '', {
    kind: previewDocument?.kind || 'slides',
    viewport: previewDocument?.viewport || null,
  });

  state.loadedPreviewProjectRoot = state.meta?.projectRoot || '';
  el.previewPane.dataset.previewKind = previewDocument?.kind || 'slides';
  el.previewFrame.removeAttribute('src');
  el.previewFrame.srcdoc = html;
  await new Promise((resolve) => { el.previewFrame.onload = resolve; });
}

function schedulePreviewRefresh(delayMs = 80) {
  if (state.previewRefreshTimer) {
    clearTimeout(state.previewRefreshTimer);
  }

  state.previewRefreshTimer = setTimeout(() => {
    state.previewRefreshTimer = null;
    refreshPreview().catch((error) => showToast(error.message, 'error'));
  }, delayMs);
}

function toggleDiag() {
  state.diagnosticsOpen = !state.diagnosticsOpen;
  el.diagnosticsDrawer.style.display = state.diagnosticsOpen ? '' : 'none';
}

function stopPaneDrag() {
  if (!state.paneDrag.active) {
    return;
  }

  state.paneDrag.active = false;
  state.paneDrag.pointerId = null;
  el.paneSplitHandle.dataset.dragging = 'false';
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
}

function startPaneDrag(event) {
  if (!state.hasProject || window.innerWidth < 1024) {
    return;
  }

  state.paneDrag.active = true;
  state.paneDrag.pointerId = event.pointerId;
  el.paneSplitHandle.dataset.dragging = 'true';
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
  el.paneSplitHandle.setPointerCapture?.(event.pointerId);
  updatePaneSplitFromClientX(event.clientX);
}

function handlePaneDrag(event) {
  if (!state.paneDrag.active) {
    return;
  }

  updatePaneSplitFromClientX(event.clientX);
}

function handlePaneKeyAdjust(event) {
  if (!state.hasProject || window.innerWidth < 1024) {
    return;
  }

  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
    return;
  }

  event.preventDefault();
  const delta = event.key === 'ArrowLeft' ? -2 : 2;
  state.paneSplitPercent = clampPaneSplitPercent(state.paneSplitPercent + delta);
  applyPaneSplit();
  scheduleTerminalFit();
}

// -----------------------------------------------------------------------------
// Event Wiring
// -----------------------------------------------------------------------------

el.choosePath.addEventListener('click', toolbarOpen);
el.createProject.addEventListener('click', createProject);
el.projectLauncherModal.addEventListener('click', (event) => {
  if (event.target === el.projectLauncherModal || event.target.classList.contains('shell-modal-backdrop')) {
    closeProjectLauncher();
  }
});
el.projectLauncherClose.addEventListener('click', closeProjectLauncher);
el.projectLauncherCancel.addEventListener('click', closeProjectLauncher);
el.projectLauncherBrowse.addEventListener('click', () => {
  browseProjectLauncher().catch((error) => showToast(error.message, 'error'));
});
el.projectLauncherPathInput.addEventListener('input', () => {
  state.projectLauncher.path = el.projectLauncherPathInput.value || '';
  renderProjectLauncher();
});
el.projectLauncherSlidesInput.addEventListener('input', () => {
  state.projectLauncher.slides = el.projectLauncherSlidesInput.value || '3';
  renderProjectLauncher();
});
el.projectLauncherPathInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !el.projectLauncherSubmit.disabled) {
    event.preventDefault();
    submitProjectLauncher().catch((error) => showToast(error.message, 'error'));
  }
});
el.projectLauncherSlidesInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !el.projectLauncherSubmit.disabled) {
    event.preventDefault();
    submitProjectLauncher().catch((error) => showToast(error.message, 'error'));
  }
});
el.projectLauncherSubmit.addEventListener('click', () => {
  submitProjectLauncher().catch((error) => showToast(error.message, 'error'));
});
el.moreActions.addEventListener('click', toggleMoreMenu);
el.paneSplitHandle.addEventListener('pointerdown', startPaneDrag);
el.paneSplitHandle.addEventListener('pointermove', handlePaneDrag);
el.paneSplitHandle.addEventListener('pointerup', stopPaneDrag);
el.paneSplitHandle.addEventListener('pointercancel', stopPaneDrag);
el.paneSplitHandle.addEventListener('keydown', handlePaneKeyAdjust);
document.addEventListener('pointermove', handlePaneDrag);
document.addEventListener('pointerup', stopPaneDrag);
document.addEventListener('pointercancel', stopPaneDrag);
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
el.terminalFind.addEventListener('click', () => openTerminalSearch(term.getSelection() || state.terminalSearch.query || ''));
el.terminalRetry.addEventListener('click', () => startShellSession());
el.terminalSearchInput.addEventListener('input', () => {
  state.terminalSearch.query = el.terminalSearchInput.value || '';
  renderTerminalSearch();
  applyTerminalSearch('next');
});
el.terminalSearchInput.addEventListener('keydown', (event) => {
  const action = getTerminalSearchAction({
    searchOpen: state.terminalSearch.open,
    key: event.key,
    shiftKey: event.shiftKey,
  });
  if (!action) {
    return;
  }

  event.preventDefault();
  if (action === 'close') {
    closeTerminalSearch();
    return;
  }

  applyTerminalSearch(action);
});
el.terminalSearchPrev.addEventListener('click', () => applyTerminalSearch('previous'));
el.terminalSearchNext.addEventListener('click', () => applyTerminalSearch('next'));
el.terminalSearchClose.addEventListener('click', closeTerminalSearch);
el.terminalContainer.addEventListener('contextmenu', (event) => {
  openTerminalContextMenu(event).catch((error) => showToast(error.message || 'Terminal menu failed.', 'error'));
});

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
document.addEventListener('focusin', () => {
  updateTerminalSurfaceState();
});
document.addEventListener('focusout', () => {
  requestAnimationFrame(() => updateTerminalSurfaceState());
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.projectLauncher.open) {
    event.preventDefault();
    closeProjectLauncher();
    return;
  }

  if (event.key === 'Escape' && state.exportDraft.open) {
    event.preventDefault();
    closeExportModal();
    return;
  }

  if (isTerminalSearchShortcut({
    platform: navigator.userAgentData?.platform || (navigator.platform || ''),
    key: event.key,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    terminalFocused: isTerminalFocused(),
  })) {
    event.preventDefault();
    openTerminalSearch(term.getSelection() || state.terminalSearch.query || '');
    return;
  }

  handleTerminalClipboardShortcut(event).catch((error) => {
    showToast(error.message || 'Clipboard action failed.', 'error');
  });

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

window.electron.actions.onEvent(handleActionEvent);
window.electron.terminal.onOutput((event) => {
  writeTerminalOutput(formatTerminalOutputEvent(event));
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
window.electron.terminal.onContextMenuAction((event = {}) => {
  if (event.action === 'paste' && event.text) {
    term.focus();
    window.electron.terminal.send(String(event.text));
    return;
  }

  if (event.action === 'selectAll') {
    term.focus();
    term.selectAll();
  }
});
window.electron.project.onChanged((event) => {
  if (event?.meta?.active && !event?.file) {
    const projectRoot = event.meta.projectRoot || '';
    const terminalProjectRoot = state.terminalMeta?.projectRoot || '';
    if (!state.terminalMeta?.alive || terminalProjectRoot !== projectRoot) {
      startShellSession().catch((error) => showToast(error.message, 'error'));
    }
  }
  scheduleProjectPanelsRefresh();
});
window.electron.preview.onChanged(() => {
  if (!state.hasProject) {
    return;
  }
  schedulePreviewRefresh();
});
window.electron.system.onNativeMenuCommand((event = {}) => {
  switch (event.commandId) {
    case 'project:new':
      openProjectLauncher('create');
      break;
    case 'project:open':
      openProjectLauncher('open');
      break;
    default:
      break;
  }
});

applyPaneSplit();
renderTerminalSearch();
renderProjectLauncher();
refreshProjectPanels().catch(e => showToast(e.message));
