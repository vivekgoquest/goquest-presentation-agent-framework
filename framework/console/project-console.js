(function initProjectConsole() {
  /* ── Constants ────────────────────────────── */
  const SPLIT_KEY = 'presentation-framework.project.split';
  const ROOT_PRIORITY = new Map([
    ['brief.md', 0], ['outline.md', 1], ['revisions.md', 2],
    ['theme.css', 3], ['assets', 4], ['slides', 5],
    ['outputs', 6], ['.presentation', 7],
  ]);

  /* ── Elements ─────────────────────────────── */
  const $ = (id) => document.getElementById(id);
  const projectTitle       = $('project-title');
  const projectMeta        = $('project-meta');
  const statusPill         = $('status-pill');
  const agentStatusEl      = $('agent-status');
  const previewStatusEl    = $('preview-status');
  const previewFrame       = $('preview-frame');
  const openPreview        = $('open-preview');
  const reloadPreview      = $('reload-preview');
  const exportPdf          = $('export-pdf');
  const finalizeProject    = $('finalize-project');
  const openProjectFolder  = $('open-project-folder');
  const openOutputsFolder  = $('open-outputs-folder');
  const openPdfButton      = $('open-pdf');
  const openScreenshotsBtn = $('open-screenshots');
  const openSummaryButton  = $('open-summary');
  const briefChip          = $('brief-chip');
  const outlineChip        = $('outline-chip');
  const slidesChip         = $('slides-chip');
  const pdfChip            = $('pdf-chip');
  const fileTree           = $('file-tree');
  const filesOverlay       = $('files-overlay');
  const toggleFiles        = $('toggle-files');
  const closeFiles         = $('close-files');
  const selectionToolbar   = $('selection-toolbar');
  const selectionPath      = $('selection-path');
  const copyPath           = $('copy-path');
  const openSelected       = $('open-selected');
  const revealSelected     = $('reveal-selected');
  const launcher           = $('agent-launcher');
  const taskInput          = $('agent-task');
  const sendToClaude       = $('send-to-claude');
  const sendToCodex        = $('send-to-codex');
  const terminalShell      = $('terminal-shell');
  const terminalPane       = $('terminal-pane');
  const restartTerminal    = $('restart-terminal');
  const stopTerminal       = $('stop-terminal');
  const clearTerminal      = $('clear-terminal');
  const mainDivider        = $('main-divider');
  const prevSlideBtn       = $('prev-slide');
  const nextSlideBtn       = $('next-slide');
  const slideCounterEl     = $('slide-counter');

  // Hidden state-holders for JS compat
  const workspaceStatusChip = $('workspace-status-chip');
  const terminalStateChip   = $('terminal-state-chip');
  const lastOutputChip      = $('last-output-chip');
  const outputsHint         = $('outputs-hint');
  const terminalMode        = $('terminal-mode');
  const terminalCwd         = $('terminal-cwd');
  const terminalContext     = $('terminal-context');

  const collapsedPaths = new Set(['.presentation', 'outputs']);
  const state = {
    projectMeta: null,
    projectState: null,
    selectedNode: null,
    treeRoot: null,
    socket: null,
    term: null,
    fitAddon: null,
    resizeObserver: null,
    xtermAssetsPromise: null,
    terminalMeta: null,
    previewTarget: '/preview/',
    liveReload: null,
    terminalMetaTimer: null,
    slideIndex: 0,
    slideCount: 0,
    previewSlides: null,
  };

  /* ── Menus ────────────────────────────────── */
  function setupMenus() {
    document.querySelectorAll('.menu-trigger').forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = trigger.closest('.menu');
        const wasOpen = menu.classList.contains('open');
        closeAllMenus();
        if (!wasOpen) menu.classList.add('open');
      });
    });

    // Close menu after clicking an item
    document.querySelectorAll('.menu-dropdown button, .menu-dropdown a').forEach((item) => {
      item.addEventListener('click', () => closeAllMenus());
    });

    document.addEventListener('click', closeAllMenus);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeAllMenus();
    });
  }

  function closeAllMenus() {
    document.querySelectorAll('.menu.open').forEach((m) => m.classList.remove('open'));
  }

  /* ── Helpers ──────────────────────────────── */
  function setChip(node, message, tone) {
    if (!node) return;
    node.textContent = message;
    node.classList.remove('is-busy', 'is-good', 'is-error');
    if (tone) node.classList.add(tone);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function toneForStatus(status) {
    if (['finalized', 'ready_to_finalize'].includes(status)) return 'is-good';
    if (['onboarding', 'in_progress', 'starting', 'stalled'].includes(status)) return 'is-busy';
    if (status === 'policy_error') return 'is-error';
    return '';
  }

  function prettyStatus(status) {
    return String(status || '').replaceAll('_', ' ');
  }

  /* ── Status pill (unified) ────────────────── */
  function updateStatusPill() {
    const ps = state.projectState;
    if (!ps) return;
    const label = prettyStatus(ps.status);
    const first = label.charAt(0).toUpperCase() + label.slice(1);
    setChip(statusPill, first, toneForStatus(ps.status));
  }

  /* ── Files overlay ────────────────────────── */
  function setFilesOpen(open) {
    filesOverlay.classList.toggle('open', open);
  }

  /* ── Divider resizing ─────────────────────── */
  function applyStoredLayout() {
    const stored = localStorage.getItem(SPLIT_KEY);
    if (stored) {
      document.documentElement.style.setProperty('--split', stored);
    }
  }

  function installDividerResize() {
    mainDivider.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      mainDivider.setPointerCapture(e.pointerId);

      function move(ev) {
        const pct = Math.max(25, Math.min(75, (ev.clientX / window.innerWidth) * 100));
        const val = `${pct.toFixed(1)}%`;
        document.documentElement.style.setProperty('--split', val);
        localStorage.setItem(SPLIT_KEY, val);
        scheduleTerminalResize();
      }

      function end() {
        mainDivider.releasePointerCapture(e.pointerId);
        mainDivider.removeEventListener('pointermove', move);
        mainDivider.removeEventListener('pointerup', end);
        mainDivider.removeEventListener('pointercancel', end);
      }

      mainDivider.addEventListener('pointermove', move);
      mainDivider.addEventListener('pointerup', end);
      mainDivider.addEventListener('pointercancel', end);
    });
  }

  /* ── Fetch ────────────────────────────────── */
  async function fetchJson(url, options) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      ...options,
    });
    let payload = null;
    const ct = response.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      payload = await response.json();
    } else {
      payload = { error: await response.text() };
    }
    if (!response.ok) {
      throw new Error(payload?.error || payload?.detail || `Request failed: ${response.status}`);
    }
    return payload;
  }

  /* ── File tree ────────────────────────────── */
  function nodeAbsolutePath(node) {
    if (!state.projectMeta || !node) return '';
    if (!node.relativePath || node.relativePath === '.') return state.projectMeta.projectRoot;
    return `${state.projectMeta.projectRoot}/${node.relativePath}`;
  }

  function updateSelectionToolbar() {
    if (!state.selectedNode) {
      selectionToolbar.hidden = true;
      return;
    }
    selectionToolbar.hidden = false;
    selectionPath.textContent = nodeAbsolutePath(state.selectedNode);
  }

  function updatePreviewTarget(slideId = '') {
    state.previewTarget = slideId ? `/preview/#${slideId}` : '/preview/';
    if (previewFrame.getAttribute('src') !== state.previewTarget) {
      previewFrame.setAttribute('src', state.previewTarget);
    }
    openPreview.href = state.previewTarget;
  }

  function selectNode(node) {
    state.selectedNode = node;
    updateSelectionToolbar();
    renderTree();
    if (node.slideId) {
      updatePreviewTarget(node.slideId);
      setChip(previewStatusEl, `#${node.slideId}`, 'is-good');
    }
  }

  function toggleNode(node) {
    if (!node.isDirectory || node.relativePath === '.') return;
    if (collapsedPaths.has(node.relativePath)) {
      collapsedPaths.delete(node.relativePath);
    } else {
      collapsedPaths.add(node.relativePath);
    }
    renderTree();
  }

  function compareRootNodes(a, b) {
    const ap = ROOT_PRIORITY.has(a.relativePath) ? ROOT_PRIORITY.get(a.relativePath) : Number.MAX_SAFE_INTEGER;
    const bp = ROOT_PRIORITY.has(b.relativePath) ? ROOT_PRIORITY.get(b.relativePath) : Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  }

  function findNodeByRelativePath(node, rp) {
    if (!node) return null;
    if (node.relativePath === rp) return node;
    if (!node.children?.length) return null;
    for (const child of node.children) {
      const m = findNodeByRelativePath(child, rp);
      if (m) return m;
    }
    return null;
  }

  function createTreeItem(node) {
    const item = document.createElement('li');
    item.className = 'tree-item';
    const row = document.createElement('div');
    const rowButton = document.createElement('button');
    rowButton.type = 'button';
    rowButton.className = 'tree-row';
    rowButton.dataset.path = node.relativePath;
    rowButton.dataset.kind = node.kind;
    if (node.slideId) rowButton.dataset.slideId = node.slideId;
    if (node.isSystem) rowButton.classList.add('is-system');
    if (node.isPrimary) rowButton.classList.add('is-primary');
    if (state.selectedNode?.relativePath === node.relativePath) rowButton.classList.add('is-selected');
    rowButton.addEventListener('click', () => selectNode(node));

    if (node.isDirectory && node.children?.length) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'tree-toggle';
      toggle.textContent = collapsedPaths.has(node.relativePath) ? '\u25B8' : '\u25BE';
      toggle.addEventListener('click', (e) => { e.stopPropagation(); toggleNode(node); });
      row.appendChild(toggle);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'tree-spacer';
      row.appendChild(spacer);
    }

    const label = document.createElement('span');
    label.className = 'tree-label';
    const name = document.createElement('span');
    name.className = 'tree-name';
    name.textContent = node.relativePath === '.' ? 'Project root' : node.name;
    label.appendChild(name);

    if (!['directory', 'file', 'root'].includes(node.kind)) {
      const kind = document.createElement('span');
      kind.className = 'tree-kind';
      kind.textContent = node.kind.replace('-directory', '').replace('-file', '');
      label.appendChild(kind);
    }

    rowButton.appendChild(label);
    row.appendChild(rowButton);
    item.appendChild(row);

    if (node.isDirectory && node.children?.length && !collapsedPaths.has(node.relativePath)) {
      const children = document.createElement('ul');
      children.className = 'tree-children tree-list';
      node.children.forEach((child) => children.appendChild(createTreeItem(child)));
      item.appendChild(children);
    }

    return item;
  }

  function renderTree() {
    fileTree.innerHTML = '';
    if (!state.treeRoot) {
      const empty = document.createElement('p');
      empty.className = 'tree-empty';
      empty.textContent = 'Project files are not available yet.';
      fileTree.appendChild(empty);
      return;
    }
    const ordered = [...state.treeRoot.children].sort(compareRootNodes);
    const authoring = ordered.filter((c) => !c.isSystem);
    const system = ordered.filter((c) => c.isSystem);

    if (authoring.length) {
      const list = document.createElement('ul');
      list.className = 'tree-list';
      authoring.forEach((c) => list.appendChild(createTreeItem(c)));
      fileTree.appendChild(list);
    }
    if (system.length) {
      const section = document.createElement('section');
      section.className = 'tree-section';
      const heading = document.createElement('div');
      heading.className = 'tree-section-heading';
      heading.textContent = 'System Files';
      section.appendChild(heading);
      const list = document.createElement('ul');
      list.className = 'tree-list';
      system.forEach((c) => list.appendChild(createTreeItem(c)));
      section.appendChild(list);
      fileTree.appendChild(section);
    }
  }

  /* ── Project state UI ─────────────────────── */
  function updateProjectStateUi() {
    const ps = state.projectState;
    if (!ps) return;

    setChip(workspaceStatusChip, `Project ${prettyStatus(ps.status)}`, toneForStatus(ps.status));
    updateStatusPill();

    if (ps.lastPolicyError && ps.status === 'policy_error') {
      setChip(previewStatusEl, ps.lastPolicyError, 'is-error');
    } else {
      const hint = ps.nextStep || '';
      setChip(previewStatusEl, hint, toneForStatus(ps.status));
    }

    setChip(briefChip, ps.briefComplete ? 'B' : 'B', ps.briefComplete ? 'is-good' : 'is-busy');
    briefChip.title = ps.briefComplete ? 'Brief complete' : 'Brief incomplete';

    if (ps.outlineRequired) {
      setChip(outlineChip, 'O', ps.outlineComplete ? 'is-good' : 'is-busy');
      outlineChip.title = ps.outlineComplete ? 'Outline locked' : 'Outline incomplete';
    } else {
      setChip(outlineChip, 'O', '');
      outlineChip.title = 'Outline not required';
    }

    setChip(slidesChip, 'S', ps.remainingSlides.length === 0 ? 'is-good' : 'is-busy');
    slidesChip.title = `Slides ${ps.slidesComplete}/${ps.slidesTotal}`;

    setChip(pdfChip, 'P', ps.pdfReady ? 'is-good' : 'is-busy');
    pdfChip.title = ps.pdfReady ? 'PDF ready' : 'PDF pending';

    const finalizeAllowed = ['ready_to_finalize', 'finalized'].includes(ps.status);
    exportPdf.disabled = !finalizeAllowed;
    finalizeProject.disabled = !finalizeAllowed;
    openPdfButton.disabled = !ps.pdfReady;
    openScreenshotsBtn.disabled = !ps.reportReady;
    openSummaryButton.disabled = !ps.summaryReady;

    if (outputsHint) {
      if (ps.pdfReady || ps.reportReady || ps.summaryReady) {
        const parts = [];
        if (ps.pdfReady) parts.push('PDF ready');
        if (ps.reportReady) parts.push('screenshots ready');
        if (ps.summaryReady) parts.push('summary ready');
        outputsHint.textContent = parts.join(' \u2022 ');
      } else {
        outputsHint.textContent = ps.nextStep || '';
      }
    }
  }

  /* ── Data loaders ─────────────────────────── */
  async function loadProjectMeta() {
    const meta = await fetchJson('/api/project/meta');
    if (!meta.active) { window.location.href = '/'; return; }
    state.projectMeta = meta;
    projectTitle.textContent = meta.title;
    if (projectMeta) projectMeta.textContent = `${meta.projectRoot} \u2022 ${meta.frameworkMode} framework \u2022 v${meta.frameworkVersion}`;
    updatePreviewTarget();
  }

  async function loadProjectState() {
    const ps = await fetchJson('/api/project/state');
    state.projectState = ps;
    updateProjectStateUi();
  }

  async function loadProjectFiles() {
    const payload = await fetchJson('/api/project/files');
    state.treeRoot = payload.tree;
    if (state.selectedNode?.relativePath) {
      state.selectedNode = findNodeByRelativePath(state.treeRoot, state.selectedNode.relativePath);
    }
    updateSelectionToolbar();
    renderTree();
  }

  /* ── Terminal / xterm ─────────────────────── */
  function ensureXtermStyle() {
    if (document.querySelector('link[data-xterm-style="true"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/node_modules/xterm/css/xterm.css';
    link.dataset.xtermStyle = 'true';
    document.head.appendChild(link);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[data-dynamic-src="${src}"]`)) { resolve(); return; }
      const s = document.createElement('script');
      s.src = src; s.async = true; s.dataset.dynamicSrc = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(s);
    });
  }

  async function ensureTerminalAssets() {
    if (state.xtermAssetsPromise) return state.xtermAssetsPromise;
    state.xtermAssetsPromise = (async () => {
      ensureXtermStyle();
      if (!window.Terminal) await loadScript('/node_modules/xterm/lib/xterm.js');
      if (!window.FitAddon) await loadScript('/node_modules/@xterm/addon-fit/lib/addon-fit.js');
    })();
    return state.xtermAssetsPromise;
  }

  let resizeFrame = null;
  let lastResizeSignature = '';

  function getTerminalDimensions() {
    if (!state.term) return null;
    try { state.fitAddon.fit(); } catch {}
    return {
      cols: Math.max(40, Math.min(200, state.term.cols || 120)),
      rows: Math.max(14, Math.min(120, state.term.rows || 32)),
    };
  }

  function sendResize() {
    if (!state.socket || state.socket.readyState !== WebSocket.OPEN || !state.terminalMeta?.alive) return;
    const d = getTerminalDimensions();
    if (!d) return;
    const sig = `${d.cols}x${d.rows}`;
    if (sig === lastResizeSignature) return;
    lastResizeSignature = sig;
    state.socket.send(JSON.stringify({ type: 'resize', cols: d.cols, rows: d.rows }));
  }

  function scheduleTerminalResize() {
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { resizeFrame = null; sendResize(); });
  }

  async function ensureTerminalUi() {
    await ensureTerminalAssets();
    if (state.term) {
      launcher.hidden = true;
      terminalShell.hidden = false;
      scheduleTerminalResize();
      return;
    }
    launcher.hidden = true;
    terminalShell.hidden = false;

    state.term = new window.Terminal({
      cursorBlink: true, convertEol: false, scrollback: 5000,
      fontFamily: '"SFMono-Regular", "Menlo", "Consolas", monospace',
      fontSize: 13,
      theme: {
        background: '#07101d', foreground: '#eef4ff', cursor: '#7cb7ff',
        black: '#08101d', blue: '#7cb7ff', brightBlue: '#9ac9ff',
        brightCyan: '#81f4ff', brightGreen: '#9df0bb', brightMagenta: '#f4a7ff',
        brightRed: '#ff9c9c', brightWhite: '#ffffff', brightYellow: '#ffe399',
        cyan: '#5fd0e5', green: '#7ad28b', magenta: '#d69cff',
        red: '#ff7d7d', white: '#e7eef9', yellow: '#f4c56a',
      },
    });
    state.fitAddon = new window.FitAddon.FitAddon();
    state.term.loadAddon(state.fitAddon);
    state.term.open(terminalPane);
    state.fitAddon.fit();

    state.term.onData((data) => {
      if (!state.socket || state.socket.readyState !== WebSocket.OPEN) return;
      state.socket.send(JSON.stringify({ type: 'input', data }));
    });

    state.resizeObserver = new ResizeObserver(() => scheduleTerminalResize());
    state.resizeObserver.observe(terminalPane);
  }

  function showLauncher() {
    launcher.hidden = false;
    terminalShell.hidden = true;
  }

  /* ── Terminal meta / status ───────────────── */
  function describeTimeAgo(ts) {
    if (!ts) return '';
    const ds = Math.max(0, Math.floor((Date.now() - Date.parse(ts)) / 1000));
    if (ds < 5) return 'just now';
    if (ds < 60) return `${ds}s ago`;
    return `${Math.floor(ds / 60)}m ago`;
  }

  function updateTerminalMeta(meta) {
    state.terminalMeta = meta;
    const label = meta?.mode ? meta.mode.charAt(0).toUpperCase() + meta.mode.slice(1) : 'Shell';

    // Hidden state holders
    if (terminalMode) terminalMode.textContent = meta?.mode ? `${label} \u2022 ${prettyStatus(meta.state)}` : 'Shell';
    if (terminalCwd) terminalCwd.textContent = meta?.cwd || '';
    if (terminalContext) {
      if (meta?.mode === 'shell') {
        terminalContext.textContent = meta?.projectRoot ? `Project root: ${meta.projectRoot}` : 'Plain shell';
      } else if (meta?.mode) {
        terminalContext.textContent = `Framework root: ${meta.frameworkRoot} \u2022 Project root: ${meta.projectRoot}`;
      } else {
        terminalContext.textContent = '';
      }
    }

    setChip(terminalStateChip, `Terminal ${prettyStatus(meta?.state || 'idle')}`, toneForStatus(meta?.state));
    setChip(lastOutputChip, describeTimeAgo(meta?.lastOutputAt), meta?.state === 'stalled' ? 'is-error' : '');

    // Visible agent status line
    if (meta?.alive) {
      const timeHint = meta.lastOutputAt ? ` \u2022 ${describeTimeAgo(meta.lastOutputAt)}` : '';
      setChip(agentStatusEl, `${label} \u2022 ${prettyStatus(meta.state)}${timeHint}`, meta.state === 'stalled' ? 'is-error' : 'is-good');
      restartTerminal.disabled = false;
      stopTerminal.disabled = false;
      clearTerminal.disabled = false;
    } else {
      setChip(agentStatusEl, 'Agent idle', '');
      restartTerminal.disabled = true;
      stopTerminal.disabled = true;
      clearTerminal.disabled = true;
    }
  }

  /* ── WebSocket ────────────────────────────── */
  function connectTerminalSocket() {
    if (state.socket && (state.socket.readyState === WebSocket.OPEN || state.socket.readyState === WebSocket.CONNECTING)) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    state.socket = new WebSocket(`${proto}//${window.location.host}/api/console/terminal`);

    state.socket.addEventListener('open', () => scheduleTerminalResize());

    state.socket.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'ready') { updateTerminalMeta(msg); scheduleTerminalResize(); return; }
      if (msg.type === 'output' && typeof msg.data === 'string') { state.term?.write(msg.data); state.term?.scrollToBottom(); return; }
      if (msg.type === 'clear') { state.term?.clear(); return; }
      if (msg.type === 'exit') {
        state.term?.clear();
        updateTerminalMeta({
          alive: false, cwd: state.projectMeta?.projectRoot || '', mode: null,
          state: 'stopped', lastOutputAt: null,
          projectRoot: state.projectMeta?.projectRoot || '',
          frameworkRoot: state.terminalMeta?.frameworkRoot || '',
        });
        showLauncher();
        return;
      }
      if (msg.type === 'error') { setChip(agentStatusEl, msg.message || 'Terminal error', 'is-error'); }
    });

    state.socket.addEventListener('close', () => { state.socket = null; });
  }

  async function waitForSocketOpen() {
    connectTerminalSocket();
    if (state.socket?.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      const sock = state.socket;
      const timeout = setTimeout(() => reject(new Error('Timed out')), 5000);
      function cleanup() { clearTimeout(timeout); sock?.removeEventListener('open', ok); sock?.removeEventListener('error', fail); }
      function ok() { cleanup(); resolve(); }
      function fail() { cleanup(); reject(new Error('Socket failed')); }
      sock?.addEventListener('open', ok, { once: true });
      sock?.addEventListener('error', fail, { once: true });
    });
  }

  async function refreshTerminalMeta() {
    const meta = await fetchJson('/api/console/terminal/meta');
    updateTerminalMeta(meta);
    if (meta.alive) { await ensureTerminalUi(); connectTerminalSocket(); } else { showLauncher(); }
  }

  async function startTerminal(mode) {
    setChip(agentStatusEl, `Starting ${mode}\u2026`, 'is-busy');
    state.term?.clear();
    lastResizeSignature = '';
    await fetchJson('/api/console/terminal/start', { method: 'POST', body: JSON.stringify({ mode }) });
    await ensureTerminalUi();
    connectTerminalSocket();
    await refreshTerminalMeta();
  }

  async function stopCurrentTerminal() {
    await fetchJson('/api/console/terminal/stop', { method: 'POST' });
    state.term?.clear();
    showLauncher();
    await refreshTerminalMeta();
  }

  async function clearCurrentTerminal() {
    await fetchJson('/api/console/terminal/clear', { method: 'POST' });
    state.term?.clear();
  }

  async function triggerOpenPath(payload) {
    return fetchJson('/api/project/open-path', { method: 'POST', body: JSON.stringify(payload) });
  }

  async function revealInTerminal(node) {
    try {
      await fetchJson('/api/console/terminal/reveal', {
        method: 'POST',
        body: JSON.stringify({ relativePath: node?.relativePath === '.' ? '' : node?.relativePath || '' }),
      });
      await ensureTerminalUi();
      connectTerminalSocket();
      await refreshTerminalMeta();
    } catch (err) { setChip(agentStatusEl, err.message, 'is-error'); }
  }

  async function sendTerminalInput(data) {
    await waitForSocketOpen();
    state.socket.send(JSON.stringify({ type: 'input', data }));
  }

  async function sendTask(mode) {
    const prompt = taskInput.value.trim();
    if (!prompt) { setChip(agentStatusEl, 'Add a task first.', 'is-error'); return; }
    if (!state.terminalMeta?.alive || state.terminalMeta.mode !== mode) {
      await startTerminal(mode);
      await sleep(mode === 'shell' ? 100 : 1200);
    }
    await sendTerminalInput(`${prompt}\n`);
    setChip(agentStatusEl, `Sent task to ${mode}.`, 'is-good');
  }

  /* ── Export / Finalize ────────────────────── */
  async function downloadPdf() {
    exportPdf.disabled = true;
    setChip(statusPill, 'Exporting\u2026', 'is-busy');
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRoot: state.projectMeta.projectRoot }),
      });
      if (!response.ok) {
        const p = await response.json();
        throw new Error(p.detail || p.error || 'Export failed.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${state.projectMeta.slug}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setChip(statusPill, 'Exported', 'is-good');
      await Promise.all([loadProjectFiles(), loadProjectState()]);
    } catch (err) { setChip(statusPill, err.message, 'is-error'); }
    finally { exportPdf.disabled = false; }
  }

  async function finalizeCurrentProject() {
    finalizeProject.disabled = true;
    setChip(statusPill, 'Finalizing\u2026', 'is-busy');
    try {
      await fetchJson('/api/project/finalize', { method: 'POST' });
      setChip(statusPill, 'Finalized', 'is-good');
      await Promise.all([loadProjectFiles(), loadProjectState()]);
    } catch (err) { setChip(statusPill, err.message, 'is-error'); }
    finally { finalizeProject.disabled = false; }
  }

  /* ── Slide navigation ──────────────────────── */
  const PREVIEW_INJECT_CSS = `
    .export-bar { display: none !important; }
    .dot-nav { display: none !important; }
    html {
      scroll-snap-type: y mandatory;
      scroll-behavior: smooth;
    }
    .slide {
      scroll-snap-align: center;
    }
  `;

  function setupPreviewSlides() {
    let doc;
    try { doc = previewFrame.contentDocument; } catch { return; }
    if (!doc || !doc.body) return;

    // Inject CSS to hide redundant chrome and enable snap
    if (!doc.querySelector('[data-workspace-injected]')) {
      const style = doc.createElement('style');
      style.setAttribute('data-workspace-injected', 'true');
      style.textContent = PREVIEW_INJECT_CSS;
      doc.head.appendChild(style);
    }

    // Discover slides
    const slides = doc.querySelectorAll('.slide');
    state.previewSlides = slides;
    state.slideCount = slides.length;

    if (slides.length === 0) {
      slideCounterEl.textContent = 'No slides';
      prevSlideBtn.disabled = true;
      nextSlideBtn.disabled = true;
      return;
    }

    // Find initial slide from hash
    const hash = previewFrame.getAttribute('src')?.split('#')[1];
    if (hash) {
      const idx = Array.from(slides).findIndex((s) => s.id === hash);
      if (idx >= 0) state.slideIndex = idx;
    } else {
      state.slideIndex = 0;
    }

    updateSlideNav();

    // Track scroll to update counter
    previewFrame.contentWindow.addEventListener('scroll', onPreviewScroll, { passive: true });
  }

  let scrollTrackFrame = null;
  function onPreviewScroll() {
    if (scrollTrackFrame) return;
    scrollTrackFrame = requestAnimationFrame(() => {
      scrollTrackFrame = null;
      if (!state.previewSlides?.length) return;
      const win = previewFrame.contentWindow;
      const center = win.scrollY + win.innerHeight / 2;
      let closest = 0;
      let closestDist = Infinity;
      state.previewSlides.forEach((s, i) => {
        const slideCenter = s.offsetTop + s.offsetHeight / 2;
        const dist = Math.abs(slideCenter - center);
        if (dist < closestDist) { closestDist = dist; closest = i; }
      });
      if (closest !== state.slideIndex) {
        state.slideIndex = closest;
        updateSlideNav();
      }
    });
  }

  function updateSlideNav() {
    const n = state.slideCount;
    const i = state.slideIndex;
    slideCounterEl.textContent = n > 0 ? `${i + 1} / ${n}` : 'No slides';
    prevSlideBtn.disabled = n === 0 || i <= 0;
    nextSlideBtn.disabled = n === 0 || i >= n - 1;
  }

  function navigateSlide(delta) {
    if (!state.previewSlides?.length) return;
    const next = Math.max(0, Math.min(state.slideCount - 1, state.slideIndex + delta));
    if (next === state.slideIndex) return;
    state.slideIndex = next;
    state.previewSlides[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
    updateSlideNav();
  }

  function handlePreviewLoad() {
    setupPreviewSlides();
    const hash = previewFrame.getAttribute('src')?.split('#')[1];
    if (hash) { setChip(previewStatusEl, `#${hash}`, 'is-good'); }
    else if (state.projectMeta) { setChip(previewStatusEl, '', ''); }
  }

  /* ── Live reload ──────────────────────────── */
  function connectWorkspaceLiveReload() {
    if (state.liveReload) return;
    state.liveReload = new EventSource('/api/live-reload');
    state.liveReload.onmessage = (event) => {
      let payload;
      try { payload = JSON.parse(event.data); } catch { return; }
      if (payload.connected) return;
      Promise.allSettled([loadProjectFiles(), loadProjectState(), refreshTerminalMeta()]).catch(() => {});
    };
  }

  /* ── Event listeners ──────────────────────── */
  copyPath?.addEventListener('click', async () => {
    if (state.selectedNode) await navigator.clipboard.writeText(nodeAbsolutePath(state.selectedNode));
  });
  openSelected?.addEventListener('click', () => {
    if (!state.selectedNode) return;
    triggerOpenPath({ relativePath: state.selectedNode.relativePath === '.' ? '' : state.selectedNode.relativePath })
      .catch((err) => setChip(statusPill, err.message, 'is-error'));
  });
  revealSelected?.addEventListener('click', () => { if (state.selectedNode) revealInTerminal(state.selectedNode); });

  toggleFiles?.addEventListener('click', () => setFilesOpen(true));
  closeFiles?.addEventListener('click', () => setFilesOpen(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setFilesOpen(false); });

  document.querySelectorAll('[data-launch-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      startTerminal(btn.dataset.launchMode).catch((err) => setChip(agentStatusEl, err.message, 'is-error'));
    });
  });

  sendToClaude?.addEventListener('click', () => sendTask('claude').catch((err) => setChip(agentStatusEl, err.message, 'is-error')));
  sendToCodex?.addEventListener('click', () => sendTask('codex').catch((err) => setChip(agentStatusEl, err.message, 'is-error')));
  restartTerminal?.addEventListener('click', () => {
    const mode = state.terminalMeta?.mode || state.terminalMeta?.lastStopMode || 'shell';
    startTerminal(mode).catch((err) => setChip(agentStatusEl, err.message, 'is-error'));
  });
  stopTerminal?.addEventListener('click', () => stopCurrentTerminal().catch((err) => setChip(agentStatusEl, err.message, 'is-error')));
  clearTerminal?.addEventListener('click', () => clearCurrentTerminal().catch((err) => setChip(agentStatusEl, err.message, 'is-error')));
  reloadPreview?.addEventListener('click', () => {
    if (previewFrame.contentWindow) previewFrame.contentWindow.location.reload();
    else previewFrame.setAttribute('src', state.previewTarget || '/preview/');
  });
  exportPdf?.addEventListener('click', () => downloadPdf());
  finalizeProject?.addEventListener('click', () => finalizeCurrentProject());
  openProjectFolder?.addEventListener('click', () => triggerOpenPath({}).catch((err) => setChip(statusPill, err.message, 'is-error')));
  openOutputsFolder?.addEventListener('click', () => triggerOpenPath({ kind: 'outputs' }).catch((err) => setChip(statusPill, err.message, 'is-error')));
  openPdfButton?.addEventListener('click', () => triggerOpenPath({ relativePath: 'outputs/deck.pdf' }).catch((err) => setChip(statusPill, err.message, 'is-error')));
  openScreenshotsBtn?.addEventListener('click', () => triggerOpenPath({ relativePath: 'outputs/slides' }).catch((err) => setChip(statusPill, err.message, 'is-error')));
  openSummaryButton?.addEventListener('click', () => triggerOpenPath({ relativePath: 'outputs/summary.md' }).catch((err) => setChip(statusPill, err.message, 'is-error')));
  previewFrame?.addEventListener('load', handlePreviewLoad);
  prevSlideBtn?.addEventListener('click', () => navigateSlide(-1));
  nextSlideBtn?.addEventListener('click', () => navigateSlide(1));

  /* ── Quick action buttons ──────────────────── */
  const PROMPT_ACTIONS = {
    'review-deck':       'Read prompts/review-deck.md and follow the instructions.',
    'review-deck-swarm': 'Read prompts/review-deck-swarm.md and follow the instructions.',
    'verify-deck':       'Read prompts/verify-deck.md and follow the instructions.',
    'fix-warnings':      'Read prompts/fix-warnings.md and follow the instructions.',
  };

  document.querySelectorAll('[data-prompt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.prompt;

      // Direct actions — no Claude needed
      if (key === 'finalize') { finalizeCurrentProject(); return; }
      if (key === 'export') { downloadPdf(); return; }

      // Prompt actions — send to Claude
      const template = PROMPT_ACTIONS[key];
      if (!template) return;
      const projectPath = state.projectMeta?.projectRoot || '';
      taskInput.value = `${template} The project is at ${projectPath}.`;
      sendTask('claude').catch((err) => setChip(agentStatusEl, err.message, 'is-error'));
    });
  });

  /* ── Bootstrap ────────────────────────────── */
  async function bootstrap() {
    setupMenus();
    applyStoredLayout();
    installDividerResize();
    connectWorkspaceLiveReload();
    await Promise.all([loadProjectMeta(), loadProjectFiles(), loadProjectState()]);
    await refreshTerminalMeta();
    state.terminalMetaTimer = setInterval(() => refreshTerminalMeta().catch(() => {}), 5000);
  }

  bootstrap().catch((err) => {
    setChip(statusPill, err.message, 'is-error');
    setChip(agentStatusEl, err.message, 'is-error');
  });
})();
