import os from 'os';
import { spawn as spawnProcess } from 'node:child_process';
import { resolve } from 'path';
import { spawn as spawnPty } from 'node-pty';

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;
const BACKLOG_LIMIT = 120000;
const STALLED_AFTER_MS = 60000;
const VALID_MODES = new Set(['shell', 'codex', 'claude']);
const PTY_BRIDGE_PATH = resolve(import.meta.dirname, 'pty-bridge.py');

function resolveShell() {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe';
  }

  return process.env.SHELL || '/bin/bash';
}

function resolveShellArgs() {
  if (process.platform === 'win32') {
    return [];
  }

  return ['-i'];
}

function trimBacklog(backlog) {
  return backlog.length > BACKLOG_LIMIT
    ? backlog.slice(-BACKLOG_LIMIT)
    : backlog;
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function createNodePtyBackend(options) {
  const {
    shell,
    shellArgs,
    cwd,
    env,
    cols,
    rows,
    onOutput,
    onExit,
    onReady,
  } = options;

  const ptyProcess = spawnPty(shell, shellArgs, {
    name: 'xterm-256color',
    cwd,
    env,
    cols,
    rows,
  });

  ptyProcess.onData(onOutput);
  ptyProcess.onExit(({ exitCode, signal }) => {
    onExit({
      code: exitCode ?? null,
      signal: signal ?? null,
    });
  });

  if (typeof onReady === 'function') {
    onReady({ pid: ptyProcess.pid || null });
  }

  return {
    kind: 'node-pty',
    write(data) {
      ptyProcess.write(data);
    },
    resize(nextCols, nextRows) {
      ptyProcess.resize(nextCols, nextRows);
    },
    dispose() {
      ptyProcess.kill();
    },
  };
}

function createPythonPtyBackend(options) {
  const {
    shell,
    shellArgs,
    cwd,
    env,
    cols,
    rows,
    onOutput,
    onExit,
    onReady,
  } = options;

  const child = spawnProcess(
    'python3',
    [
      PTY_BRIDGE_PATH,
      '--shell',
      shell,
      '--cols',
      String(cols),
      '--rows',
      String(rows),
      '--',
      ...shellArgs,
    ],
    {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );

  let shellPid = child.pid || null;
  let stdoutBuffer = '';
  let lastExit = null;
  let closed = false;

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  function handleBridgeMessage(line) {
    if (!line.trim()) {
      return;
    }

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      onOutput(line);
      return;
    }

    if (message.type === 'ready') {
      shellPid = message.pid ?? shellPid;
      if (typeof onReady === 'function') {
        onReady({ pid: shellPid });
      }
      return;
    }

    if (message.type === 'output' && typeof message.data === 'string') {
      onOutput(message.data);
      return;
    }

    if (message.type === 'exit') {
      lastExit = {
        code: message.code ?? null,
        signal: message.signal ?? null,
      };
      return;
    }

    if (message.type === 'error' && message.message) {
      onOutput(`\r\n[pty bridge error] ${message.message}\r\n`);
    }
  }

  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk;

    let newlineIndex = stdoutBuffer.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = stdoutBuffer.slice(0, newlineIndex);
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      handleBridgeMessage(line);
      newlineIndex = stdoutBuffer.indexOf('\n');
    }
  });

  child.stderr.on('data', (chunk) => {
    onOutput(`\r\n[pty stderr] ${chunk}\r\n`);
  });

  child.on('exit', (code, signal) => {
    if (closed) {
      return;
    }

    closed = true;
    const exitMessage = lastExit || {
      code: code ?? null,
      signal: signal ?? null,
    };
    onExit(exitMessage);
  });

  return {
    kind: 'python-pty',
    write(data) {
      if (!child.stdin.destroyed) {
        child.stdin.write(`${JSON.stringify({ type: 'input', data })}\n`);
      }
    },
    resize(nextCols, nextRows) {
      if (!child.stdin.destroyed) {
        child.stdin.write(`${JSON.stringify({ type: 'resize', cols: nextCols, rows: nextRows })}\n`);
      }
    },
    dispose() {
      closed = true;
      child.kill();
    },
  };
}

export function createTerminalSession(options = {}) {
  const frameworkRoot = options.frameworkRoot || options.cwd || process.cwd();
  const env = {
    ...process.env,
    BASH_SILENCE_DEPRECATION_WARNING: '1',
    TERM: process.env.TERM || 'xterm-256color',
  };

  let shell = resolveShell();
  let shellArgs = resolveShellArgs();
  let backend = null;
  let backlog = '';
  let cols = DEFAULT_COLS;
  let rows = DEFAULT_ROWS;
  let sessionMode = null;
  let sessionCounter = 0;
  let shellPid = null;
  let projectRoot = options.projectRoot || null;
  let activeCwd = projectRoot || frameworkRoot;
  let launchCommand = '';
  let lastOutputAt = null;
  let terminalState = 'idle';
  let lastStopMode = null;
  let lastExit = null;

  const clients = new Set();

  function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  function appendBacklog(chunk) {
    backlog = trimBacklog(`${backlog}${chunk}`);
  }

  function clearBacklog() {
    backlog = '';
    broadcast({ type: 'clear' });
  }

  function getEffectiveState() {
    if (!backend) {
      return terminalState === 'stopped' ? 'stopped' : 'idle';
    }

    if (terminalState === 'starting') {
      return 'starting';
    }

    if (sessionMode && sessionMode !== 'shell' && lastOutputAt && (Date.now() - lastOutputAt) > STALLED_AFTER_MS) {
      return 'stalled';
    }

    return 'running';
  }

  function resolveLaunchDetails(mode) {
    if (!VALID_MODES.has(mode)) {
      throw new Error(`Unsupported terminal mode "${mode}".`);
    }

    if (mode === 'shell') {
      return {
        cwd: projectRoot || frameworkRoot,
        launchCommand: '',
      };
    }

    if (!projectRoot) {
      throw new Error(`Open a presentation project before launching ${mode}.`);
    }

    const command = mode === 'codex'
      ? `codex --add-dir ${shellEscape(projectRoot)}`
      : `claude --add-dir ${shellEscape(projectRoot)}`;

    return {
      cwd: frameworkRoot,
      launchCommand: `${command}\n`,
    };
  }

  function getMeta() {
    return {
      cwd: activeCwd,
      shell,
      pid: shellPid,
      alive: Boolean(backend),
      cols,
      rows,
      mode: sessionMode,
      platform: os.platform(),
      backend: backend?.kind || null,
      state: getEffectiveState(),
      lastOutputAt: lastOutputAt ? new Date(lastOutputAt).toISOString() : null,
      launchCommand: launchCommand || '',
      frameworkRoot,
      projectRoot: projectRoot || '',
      lastStopMode: lastStopMode || null,
      lastExit,
    };
  }

  function emitReady(target) {
    const payload = JSON.stringify({
      type: 'ready',
      ...getMeta(),
    });

    if (target) {
      if (target.readyState === 1) {
        target.send(payload);
      }
      return;
    }

    for (const client of clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  function resetActiveProcessState() {
    backend = null;
    shellPid = null;
    sessionMode = null;
    launchCommand = '';
    activeCwd = projectRoot || frameworkRoot;
  }

  function launchModeCommand(mode) {
    if (!launchCommand || !backend) {
      return;
    }

    setTimeout(() => {
      if (backend && sessionMode === mode) {
        backend.write(launchCommand);
      }
    }, 80);
  }

  function handleBackendOutput(sessionId, data) {
    if (sessionId !== sessionCounter) {
      return;
    }

    lastOutputAt = Date.now();
    terminalState = 'running';
    appendBacklog(data);
    broadcast({
      type: 'output',
      data,
    });
  }

  function handleBackendExit(sessionId, { code, signal }) {
    if (sessionId !== sessionCounter) {
      return;
    }

    lastExit = {
      code: code ?? null,
      signal: signal ?? null,
    };
    appendBacklog(`\r\n[terminal exited${code !== null ? ` with code ${code}` : ''}${signal ? ` (${signal})` : ''}]\r\n`);
    broadcast({
      type: 'exit',
      code: code ?? null,
      signal: signal ?? null,
      mode: sessionMode,
    });
    lastStopMode = sessionMode;
    terminalState = 'stopped';
    resetActiveProcessState();
  }

  function handleBackendReady(sessionId, ready) {
    if (sessionId !== sessionCounter) {
      return;
    }

    shellPid = ready.pid ?? shellPid;
    emitReady();
    launchModeCommand(sessionMode);
  }

  function startBackend(mode, cwd) {
    shell = resolveShell();
    shellArgs = resolveShellArgs();
    sessionMode = mode;
    activeCwd = cwd;

    const sessionId = ++sessionCounter;
    try {
      return createNodePtyBackend({
        shell,
        shellArgs,
        cwd: activeCwd,
        env,
        cols,
        rows,
        onOutput: (data) => handleBackendOutput(sessionId, data),
        onExit: (exit) => handleBackendExit(sessionId, exit),
        onReady: (ready) => handleBackendReady(sessionId, ready),
      });
    } catch (err) {
      console.warn(`[terminal] node-pty unavailable (${err.message}); falling back to python pty bridge.`);
      return createPythonPtyBackend({
        shell,
        shellArgs,
        cwd: activeCwd,
        env,
        cols,
        rows,
        onOutput: (data) => handleBackendOutput(sessionId, data),
        onExit: (exit) => handleBackendExit(sessionId, exit),
        onReady: (ready) => handleBackendReady(sessionId, ready),
      });
    }
  }

  function startSession(mode = 'shell') {
    const launchDetails = resolveLaunchDetails(mode);

    if (backend) {
      stopSession({ announce: false });
    }

    clearBacklog();
    lastOutputAt = null;
    lastExit = null;
    lastStopMode = null;
    terminalState = 'starting';
    launchCommand = launchDetails.launchCommand;
    backend = startBackend(mode, launchDetails.cwd);
    return getMeta();
  }

  function stopSession(options = {}) {
    const {
      announce = true,
      signal = 'stopped',
    } = options;

    if (!backend) {
      terminalState = 'stopped';
      return getMeta();
    }

    const activeBackend = backend;
    const previousMode = sessionMode;
    sessionCounter += 1;
    lastExit = {
      code: null,
      signal,
    };
    lastStopMode = previousMode;
    terminalState = 'stopped';
    resetActiveProcessState();
    activeBackend.dispose();

    if (announce) {
      clearBacklog();
      broadcast({
        type: 'exit',
        code: null,
        signal,
        mode: previousMode,
      });
    }

    return getMeta();
  }

  function connectClient(client) {
    clients.add(client);
    if (backend) {
      emitReady(client);
      if (backlog) {
        client.send(JSON.stringify({
          type: 'output',
          data: backlog,
        }));
      }
    }
  }

  function disconnectClient(client) {
    clients.delete(client);
  }

  function revealPath(targetPath) {
    const nextPath = resolve(projectRoot || frameworkRoot, targetPath);
    if (!backend) {
      startSession('shell');
    }

    if (sessionMode !== 'shell') {
      throw new Error('Reveal in terminal requires shell mode. Stop the current agent session first.');
    }

    backend.write(`cd ${shellEscape(nextPath)}\npwd\n`);
    return getMeta();
  }

  function setProjectContext(nextProjectRoot) {
    projectRoot = nextProjectRoot || null;
    if (!backend) {
      activeCwd = projectRoot || frameworkRoot;
    }
    return getMeta();
  }

  function handleClientMessage(raw) {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return {
        type: 'error',
        message: 'Expected JSON messages over the terminal socket.',
      };
    }

    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      return {
        type: 'error',
        message: 'Terminal messages must be JSON objects with a type field.',
      };
    }

    if (message.type === 'input') {
      if (typeof message.data !== 'string') {
        return {
          type: 'error',
          message: 'Terminal input messages must include a string data field.',
        };
      }

      if (!backend) {
        return {
          type: 'error',
          message: 'Terminal session is not running. Launch Codex, Claude, or Shell first.',
        };
      }

      backend.write(message.data);
      return null;
    }

    if (message.type === 'resize') {
      const nextCols = Number.parseInt(message.cols, 10);
      const nextRows = Number.parseInt(message.rows, 10);
      if (!Number.isFinite(nextCols) || !Number.isFinite(nextRows) || nextCols < 2 || nextRows < 1) {
        return {
          type: 'error',
          message: 'Resize messages must include integer cols >= 2 and rows >= 1.',
        };
      }

      cols = nextCols;
      rows = nextRows;
      if (backend) {
        backend.resize(cols, rows);
      }
      return null;
    }

    return {
      type: 'error',
      message: `Unsupported terminal message type: ${message.type}`,
    };
  }

  return {
    clearBacklog,
    connectClient,
    disconnectClient,
    getMeta,
    handleClientMessage,
    revealPath,
    setProjectContext,
    startSession,
    stopSession,
  };
}
