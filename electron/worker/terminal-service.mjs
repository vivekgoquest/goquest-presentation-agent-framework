import { createTerminalCoreSession } from '../../framework/runtime/terminal-core.mjs';

export function createTerminalService(options = {}) {
  const terminal = createTerminalCoreSession({
    frameworkRoot: options.frameworkRoot || process.cwd(),
    projectRoot: options.projectRoot || null,
  });

  return {
    clear() {
      terminal.clearBacklog();
      return { ok: true };
    },
    dispose() {
      terminal.stopSession({ announce: false, signal: 'worker-dispose' });
    },
    getMeta() {
      return terminal.getMeta();
    },
    onEvent(listener) {
      return terminal.onEvent(listener);
    },
    revealPath(targetPath) {
      return terminal.revealPath(targetPath);
    },
    resize(cols, rows) {
      return terminal.resizeTerminal(cols, rows);
    },
    send(data) {
      terminal.sendInput(data);
      return { ok: true };
    },
    setProjectContext(projectRoot) {
      return terminal.setProjectContext(projectRoot);
    },
    start(mode = 'shell') {
      return terminal.startSession(mode);
    },
    stop(options = {}) {
      return terminal.stopSession(options);
    },
  };
}
