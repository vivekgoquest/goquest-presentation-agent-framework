(function initOperatorConsole() {
  const STORAGE_KEY = 'presentation-framework.console.selection';
  const RECONNECT_DELAY_MS = 1000;
  const MIN_COLS = 40;
  const MAX_COLS = 240;
  const MIN_ROWS = 12;
  const MAX_ROWS = 120;

  const workspaceSelect = document.getElementById('workspace-select');
  const workspaceSelectGroup = document.getElementById('workspace-select-group');
  const projectSummary = document.getElementById('project-summary');
  const projectTitle = document.getElementById('project-title');
  const projectMetaText = document.getElementById('project-meta-text');
  const reloadPreviewButton = document.getElementById('reload-preview');
  const openPreviewLink = document.getElementById('open-preview');
  const previewFrame = document.getElementById('preview-frame');
  const previewStatus = document.getElementById('preview-status');
  const terminalStatus = document.getElementById('terminal-status');
  const terminalPane = document.getElementById('terminal-pane');
  const terminalHint = document.getElementById('terminal-hint');

  const term = new Terminal({
    cursorBlink: true,
    convertEol: false,
    scrollback: 5000,
    fontFamily: '"SFMono-Regular", "Menlo", "Consolas", monospace',
    fontSize: 13,
    theme: {
      background: '#0a1322',
      foreground: '#eef4ff',
      cursor: '#73b0ff',
      black: '#08101d',
      blue: '#73b0ff',
      brightBlue: '#97c6ff',
      brightCyan: '#81f4ff',
      brightGreen: '#9df0bb',
      brightMagenta: '#f4a7ff',
      brightRed: '#ff9c9c',
      brightWhite: '#ffffff',
      brightYellow: '#ffe399',
      cyan: '#5fd0e5',
      green: '#7ad28b',
      magenta: '#d69cff',
      red: '#ff7d7d',
      white: '#e7eef9',
      yellow: '#f4c56a',
    },
  });
  const fitAddon = new FitAddon.FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalPane);
  fitAddon.fit();

  let socket = null;
  let reconnectTimer = null;
  let resizeFrame = null;
  let lastResizeSignature = '';
  let pendingReady = false;
  let workspaceIndex = [];
  let projectMeta = null;
  let hasTerminalInteraction = false;

  function setTerminalHintVisible(visible) {
    if (!terminalHint) {
      return;
    }

    terminalPane.classList.toggle('has-output', !visible);
  }

  function markTerminalInteraction() {
    hasTerminalInteraction = true;
    setTerminalHintVisible(false);
    terminalPane.classList.add('is-focused');
  }

  function setTerminalStatus(message) {
    terminalStatus.textContent = message;
  }

  function setPreviewStatus(message) {
    previewStatus.textContent = message;
  }

  function makeWorkspaceValue(item) {
    return `${item.ownerType}:${item.ownerName}`;
  }

  function findWorkspace(value) {
    return workspaceIndex.find((item) => makeWorkspaceValue(item) === value) || null;
  }

  function loadPreview(item) {
    if (!item) {
      previewFrame.src = '/workspaces/';
      openPreviewLink.href = '/workspaces/';
      setPreviewStatus('No workspace selected.');
      return;
    }

    previewFrame.src = item.previewHref;
    openPreviewLink.href = item.previewHref;
    setPreviewStatus(`Previewing ${item.workspaceId}`);
    localStorage.setItem(STORAGE_KEY, makeWorkspaceValue(item));
  }

  function loadProjectPreview(meta) {
    projectMeta = meta;
    projectSummary.hidden = false;
    workspaceSelectGroup.hidden = true;
    projectTitle.textContent = `${meta.title} (${meta.slug})`;
    projectMetaText.textContent = `${meta.projectRoot} • ${meta.frameworkMode} framework • v${meta.frameworkVersion}`;
    previewFrame.src = meta.previewPath;
    openPreviewLink.href = meta.previewPath;
    setPreviewStatus(`Previewing ${meta.projectRoot}`);
  }

  function populateWorkspaceSelect(payload) {
    const groups = [
      {
        label: 'Deck workspaces',
        items: payload.decks || [],
      },
      {
        label: 'Examples',
        items: payload.examples || [],
      },
    ];

    workspaceIndex = groups.flatMap((group) => group.items);
    workspaceSelect.innerHTML = '';

    for (const group of groups) {
      if (!group.items.length) {
        continue;
      }

      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;

      for (const item of group.items) {
        const option = document.createElement('option');
        option.value = makeWorkspaceValue(item);
        option.textContent = `${item.label} (${item.workspaceId})`;
        optgroup.appendChild(option);
      }

      workspaceSelect.appendChild(optgroup);
    }

    if (!workspaceIndex.length) {
      loadPreview(null);
      return;
    }

    const saved = localStorage.getItem(STORAGE_KEY);
    const initial = findWorkspace(saved) || workspaceIndex[0];
    workspaceSelect.value = makeWorkspaceValue(initial);
    loadPreview(initial);
  }

  async function loadWorkspaces() {
    const response = await fetch('/api/console/workspaces');
    if (!response.ok) {
      throw new Error('Failed to load workspaces.');
    }

    populateWorkspaceSelect(await response.json());
  }

  async function loadProjectMeta() {
    const response = await fetch('/api/project/meta');
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error('Failed to load project metadata.');
    }

    return response.json();
  }

  async function loadTerminalMeta() {
    const response = await fetch('/api/console/terminal/meta');
    if (!response.ok) {
      throw new Error('Failed to load terminal metadata.');
    }

    const meta = await response.json();
    if (meta.alive) {
      setTerminalStatus(`Shell ready in ${meta.cwd} (${meta.shell})`);
    } else {
      setTerminalStatus(`Terminal idle in ${meta.cwd}; connect to start a shell.`);
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getTerminalDimensions() {
    try {
      fitAddon.fit();
    } catch {
      // Ignore fit timing issues and fall back below.
    }

    if (Number.isFinite(term.cols) && Number.isFinite(term.rows) && term.cols > 1 && term.rows > 1) {
      return {
        cols: clamp(term.cols, MIN_COLS, MAX_COLS),
        rows: clamp(term.rows, MIN_ROWS, MAX_ROWS),
      };
    }

    const proposed = fitAddon.proposeDimensions();
    if (proposed && Number.isFinite(proposed.cols) && Number.isFinite(proposed.rows)) {
      return {
        cols: clamp(proposed.cols, MIN_COLS, MAX_COLS),
        rows: clamp(proposed.rows, MIN_ROWS, MAX_ROWS),
      };
    }

    const paneWidth = terminalPane.clientWidth || 960;
    const paneHeight = terminalPane.clientHeight || 480;
    return {
      cols: clamp(Math.floor((paneWidth - 16) / 9), MIN_COLS, MAX_COLS),
      rows: clamp(Math.floor((paneHeight - 16) / 18), MIN_ROWS, MAX_ROWS),
    };
  }

  function sendResize() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const dimensions = getTerminalDimensions();
    const signature = `${dimensions.cols}x${dimensions.rows}`;
    if (signature === lastResizeSignature) {
      return;
    }

    lastResizeSignature = signature;

    socket.send(JSON.stringify({
      type: 'resize',
      cols: dimensions.cols,
      rows: dimensions.rows,
    }));
  }

  function scheduleResize() {
    if (resizeFrame !== null) {
      window.cancelAnimationFrame(resizeFrame);
    }

    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = null;
      sendResize();
    });
  }

  function scheduleReconnect() {
    if (reconnectTimer) {
      return;
    }

    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connectTerminal();
    }, RECONNECT_DELAY_MS);
  }

  function handleSocketMessage(event) {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (!message || typeof message !== 'object') {
      return;
    }

    if (message.type === 'ready') {
      pendingReady = false;
      setTerminalStatus(`Shell ready in ${message.cwd} (${message.shell}, pid ${message.pid})`);
      return;
    }

    if (message.type === 'output' && typeof message.data === 'string') {
      term.write(message.data);
      return;
    }

    if (message.type === 'exit') {
      setTerminalStatus('Terminal exited. Start typing or reconnect to create a fresh shell.');
      term.writeln('');
      term.writeln('[terminal exited]');
      return;
    }

    if (message.type === 'error' && message.message) {
      setTerminalStatus(`Terminal error: ${message.message}`);
      term.writeln('');
      term.writeln(`[console error] ${message.message}`);
    }
  }

  function connectTerminal() {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    pendingReady = true;
    lastResizeSignature = '';
    setTerminalStatus('Connecting terminal…');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${protocol}//${window.location.host}/api/console/terminal`);

    socket.addEventListener('open', () => {
      scheduleResize();
    });

    socket.addEventListener('message', handleSocketMessage);

    socket.addEventListener('close', () => {
      if (pendingReady) {
        setTerminalStatus('Terminal disconnected. Retrying…');
      } else {
        setTerminalStatus('Terminal disconnected. Reconnecting…');
      }
      scheduleReconnect();
    });

    socket.addEventListener('error', () => {
      setTerminalStatus('Terminal websocket error. Reconnecting…');
      socket.close();
    });
  }

  const resizeObserver = new ResizeObserver(() => {
    scheduleResize();
  });
  resizeObserver.observe(terminalPane);

  term.onData((data) => {
    markTerminalInteraction();
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(JSON.stringify({
      type: 'input',
      data,
    }));
  });

  terminalPane.addEventListener('pointerdown', () => {
    markTerminalInteraction();
  });

  terminalPane.addEventListener('focusout', () => {
    if (!hasTerminalInteraction) {
      terminalPane.classList.remove('is-focused');
    }
  });

  workspaceSelect.addEventListener('change', () => {
    loadPreview(findWorkspace(workspaceSelect.value));
  });

  reloadPreviewButton.addEventListener('click', () => {
    if (previewFrame.contentWindow) {
      previewFrame.contentWindow.location.reload();
    } else if (previewFrame.src) {
      previewFrame.src = previewFrame.src;
    }
  });

  previewFrame.addEventListener('load', () => {
    if (projectMeta) {
      setPreviewStatus(`Previewing ${projectMeta.projectRoot}`);
      return;
    }
    const current = findWorkspace(workspaceSelect.value);
    if (current) {
      setPreviewStatus(`Previewing ${current.workspaceId}`);
    }
  });

  Promise.all([loadProjectMeta(), loadTerminalMeta()])
    .then(async ([meta]) => {
      if (meta) {
        loadProjectPreview(meta);
        return;
      }
      await loadWorkspaces();
    })
    .catch((err) => {
      setPreviewStatus(err.message);
      setTerminalStatus(err.message);
    })
    .finally(() => {
      connectTerminal();
    });
})();
