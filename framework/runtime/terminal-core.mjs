import os from 'os';
import { spawn as spawnProcess } from 'node:child_process';
import { resolve } from 'path';
import { spawn as spawnPty } from 'node-pty';
import {
  createTerminalClearEvent,
  createTerminalErrorEvent,
  createTerminalExitEvent,
  createTerminalMetaEvent,
  createTerminalOutputEvent,
  createTerminalReadyEvent,
  toTerminalSocketMessage,
} from './terminal-events.mjs';

const DEFAULT_COLS = 120;
const DEFAULT_ROWS = 32;
const BACKLOG_LIMIT = 120000;
const VALID_MODES = new Set(['shell']);
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

export function createTerminalCoreSession(options = {}) {
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
  const listeners = new Set();

  function emitToListeners(event) {
    for (const listener of listeners) {
      listener(event);
    }
  }

  function sendSocketMessage(client, event) {
    const payload = JSON.stringify(toTerminalSocketMessage(event));
    if (client.readyState === 1) {
      client.send(payload);
    }
  }

  function emitToClients(event) {
    for (const client of clients) {
      sendSocketMessage(client, event);
    }
  }

  function emitEvent(event) {
    emitToListeners(event);
    emitToClients(event);
  }

  function appendBacklog(chunk) {
    backlog = trimBacklog(`${backlog}${chunk}`);
  }

  function clearBacklog() {
    backlog = '';
    emitEvent(createTerminalClearEvent());
  }

  function writeSystemOutput(chunk) {
    if (typeof chunk !== 'string') {
      throw new Error('Terminal system output must be a string.');
    }

    if (!chunk) {
      return getMeta();
    }

    lastOutputAt = Date.now();
    appendBacklog(chunk);
    emitEvent(createTerminalOutputEvent(chunk));
    return getMeta();
  }

  function getEffectiveState() {
    if (!backend) {
      return terminalState === 'stopped' ? 'stopped' : 'idle';
    }

    if (terminalState === 'starting') {
      return 'starting';
    }

    return 'running';
  }

  function resolveLaunchDetails(mode) {
    if (!VALID_MODES.has(mode)) {
      throw new Error(`Unsupported terminal mode "${mode}".`);
    }

    return {
      cwd: projectRoot || frameworkRoot,
      launchCommand: '',
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

  function emitMeta() {
    emitEvent(createTerminalMetaEvent(getMeta()));
  }

  function emitReady(target) {
    const event = createTerminalReadyEvent(getMeta());
    if (target) {
      sendSocketMessage(target, event);
      return;
    }

    emitEvent(event);
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
    emitEvent(createTerminalOutputEvent(data));
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
    emitEvent(createTerminalExitEvent({
      code: code ?? null,
      signal: signal ?? null,
      mode: sessionMode,
    }));
    lastStopMode = sessionMode;
    terminalState = 'stopped';
    resetActiveProcessState();
    emitMeta();
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
    emitMeta();
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
      emitEvent(createTerminalExitEvent({
        code: null,
        signal,
        mode: previousMode,
      }));
    }

    emitMeta();
    return getMeta();
  }

  function connectClient(client) {
    clients.add(client);
    if (backend) {
      emitReady(client);
      if (backlog) {
        sendSocketMessage(client, createTerminalOutputEvent(backlog));
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
    emitMeta();
    return getMeta();
  }

  function onEvent(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function sendInput(data) {
    if (typeof data !== 'string') {
      throw new Error('Terminal input must be a string.');
    }

    if (!backend) {
      throw new Error('Terminal session is not running. Launch the shell first.');
    }

    backend.write(data);
    return getMeta();
  }

  function resizeTerminal(nextCols, nextRows) {
    const parsedCols = Number.parseInt(nextCols, 10);
    const parsedRows = Number.parseInt(nextRows, 10);
    if (!Number.isFinite(parsedCols) || !Number.isFinite(parsedRows) || parsedCols < 2 || parsedRows < 1) {
      throw new Error('Resize requires integer cols >= 2 and rows >= 1.');
    }

    cols = parsedCols;
    rows = parsedRows;
    if (backend) {
      backend.resize(cols, rows);
    }
    emitMeta();
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
      try {
        sendInput(message.data);
        return null;
      } catch (err) {
        return toTerminalSocketMessage(createTerminalErrorEvent(err.message));
      }
    }

    if (message.type === 'resize') {
      try {
        resizeTerminal(message.cols, message.rows);
        return null;
      } catch (err) {
        return toTerminalSocketMessage(createTerminalErrorEvent(err.message));
      }
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
    onEvent,
    revealPath,
    resizeTerminal,
    sendInput,
    setProjectContext,
    startSession,
    stopSession,
    writeSystemOutput,
  };
}

export const createTerminalSession = createTerminalCoreSession;
