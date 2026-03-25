import test from 'node:test';
import assert from 'node:assert/strict';

import {
  extractShellIntegrationSignalsFromOutput,
  extractTerminalCwdFromOutput,
  resolveShellLaunchOptions,
} from '../terminal-core.mjs';

function waitFor(predicate, timeoutMs = 15000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolve, reject) => {
    function poll() {
      if (predicate()) {
        resolve();
        return;
      }

      if (Date.now() > deadline) {
        reject(new Error('Timed out waiting for terminal event.'));
        return;
      }

      setTimeout(poll, intervalMs);
    }

    poll();
  });
}

test('extractTerminalCwdFromOutput parses OSC 7 working-directory sequences', () => {
  assert.equal(
    extractTerminalCwdFromOutput('\u001b]7;file://host.example/Users/vivek/project\u0007'),
    '/Users/vivek/project'
  );
  assert.equal(
    extractTerminalCwdFromOutput('\u001b]7;file://host.example/Users/vivek/My%20Project\u001b\\'),
    '/Users/vivek/My Project'
  );
  assert.equal(
    extractTerminalCwdFromOutput('plain output only'),
    ''
  );
});

test('extractShellIntegrationSignalsFromOutput parses OSC 133 prompt and command markers', () => {
  assert.deepEqual(
    extractShellIntegrationSignalsFromOutput([
      '\u001b]133;A\u0007',
      '\u001b]133;B\u0007',
      '\u001b]133;C\u0007',
      '\u001b]133;D;0\u0007',
    ].join('')),
    [
      { kind: 'prompt_start', exitCode: null },
      { kind: 'command_start', exitCode: null },
      { kind: 'command_executing', exitCode: null },
      { kind: 'command_finish', exitCode: 0 },
    ]
  );

  assert.deepEqual(
    extractShellIntegrationSignalsFromOutput('\u001b]133;D;17\u001b\\'),
    [{ kind: 'command_finish', exitCode: 17 }]
  );
  assert.deepEqual(extractShellIntegrationSignalsFromOutput('plain output only'), []);
});

test('resolveShellLaunchOptions prefers login-shell startup for common POSIX shells', () => {
  const bashLaunch = resolveShellLaunchOptions({
    platform: 'darwin',
    env: { SHELL: '/bin/bash' },
  });
  assert.equal(bashLaunch.shell, '/bin/bash');
  assert.deepEqual(bashLaunch.shellArgs, ['-l']);
  assert.equal(bashLaunch.loginShell, true);

  const zshLaunch = resolveShellLaunchOptions({
    platform: 'linux',
    env: { SHELL: '/bin/zsh' },
  });
  assert.equal(zshLaunch.shell, '/bin/zsh');
  assert.deepEqual(zshLaunch.shellArgs, ['-l']);
  assert.equal(zshLaunch.loginShell, true);

  const fishLaunch = resolveShellLaunchOptions({
    platform: 'linux',
    env: { SHELL: '/opt/homebrew/bin/fish' },
  });
  assert.equal(fishLaunch.shell, '/opt/homebrew/bin/fish');
  assert.deepEqual(fishLaunch.shellArgs, ['-l']);
  assert.equal(fishLaunch.loginShell, true);
});

test('resolveShellLaunchOptions keeps interactive fallback for unknown shells and normalizes env', () => {
  const launch = resolveShellLaunchOptions({
    platform: 'linux',
    env: {
      SHELL: '/usr/local/bin/elvish',
      CUSTOM_FLAG: '1',
      TERM: '',
    },
  });

  assert.equal(launch.shell, '/usr/local/bin/elvish');
  assert.deepEqual(launch.shellArgs, ['-i']);
  assert.equal(launch.loginShell, false);
  assert.equal(launch.env.CUSTOM_FLAG, '1');
  assert.equal(launch.env.TERM, 'xterm-256color');
  assert.equal(launch.env.BASH_SILENCE_DEPRECATION_WARNING, '1');
});

test('resolveShellLaunchOptions preserves Windows default shell behavior', () => {
  const launch = resolveShellLaunchOptions({
    platform: 'win32',
    env: {
      COMSPEC: 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',
    },
  });

  assert.equal(launch.shell, 'C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe');
  assert.deepEqual(launch.shellArgs, []);
  assert.equal(launch.loginShell, false);
});

test('terminal core starts a shell session and relays output', async (t) => {
  const { createTerminalCoreSession } = await import('../terminal-core.mjs');
  const messages = [];
  const client = {
    readyState: 1,
    send(payload) {
      messages.push(JSON.parse(payload));
    },
  };

  const session = createTerminalCoreSession({
    frameworkRoot: process.cwd(),
    projectRoot: process.cwd(),
  });

  t.after(() => {
    try {
      session.stopSession({ announce: false });
    } catch {
      // ignore cleanup races in the test harness
    }
  });

  session.connectClient(client);
  const meta = session.startSession('shell');

  assert.equal(meta.mode, 'shell');
  session.handleClientMessage(JSON.stringify({
    type: 'input',
    data: 'echo __TERM_CORE_OK__\nexit\n',
  }));

  await waitFor(() =>
    messages.some((message) => message.type === 'output' && message.data.includes('__TERM_CORE_OK__'))
  );
  await waitFor(() =>
    messages.some((message) => message.type === 'exit')
  );

  assert.equal(session.getMeta().state, 'stopped');
});

test('terminal core emits transport-neutral lifecycle events', async (t) => {
  const { createTerminalCoreSession } = await import('../terminal-core.mjs');
  const events = [];
  const session = createTerminalCoreSession({
    frameworkRoot: process.cwd(),
    projectRoot: process.cwd(),
  });

  t.after(() => {
    try {
      session.stopSession({ announce: false });
    } catch {
      // ignore cleanup races in the test harness
    }
  });

  const unsubscribe = session.onEvent((event) => {
    events.push(event);
  });
  t.after(() => unsubscribe());

  const meta = session.startSession('shell');
  assert.equal(meta.mode, 'shell');

  session.sendInput('echo __TERM_EVENT_OK__\nexit\n');
  session.writeSystemOutput('system notice\r\n');

  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/output' && event.data.includes('__TERM_EVENT_OK__'))
  );
  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/exit')
  );

  assert(events.some((event) => event.channel === 'terminal/ready'));
  assert(events.some((event) => event.channel === 'terminal/output' && event.source === 'pty' && event.data.includes('__TERM_EVENT_OK__')));
  assert(events.some((event) => event.channel === 'terminal/output' && event.source === 'system' && event.data.includes('system notice')));
  assert.equal(session.getMeta().state, 'stopped');
});

test('terminal core accepts input immediately after ready', async (t) => {
  const { createTerminalCoreSession } = await import('../terminal-core.mjs');
  const events = [];
  const session = createTerminalCoreSession({
    frameworkRoot: process.cwd(),
    projectRoot: process.cwd(),
  });

  t.after(() => {
    try {
      session.stopSession({ announce: false });
    } catch {
      // ignore cleanup races in the test harness
    }
  });

  const unsubscribe = session.onEvent((event) => {
    events.push(event);
    if (event.channel === 'terminal/ready') {
      session.sendInput('echo __TERM_READY_OK__\nexit\n');
    }
  });
  t.after(() => unsubscribe());

  session.startSession('shell');

  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/output' && event.data.includes('__TERM_READY_OK__'))
  );
  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/exit')
  );

  assert.equal(session.getMeta().state, 'stopped');
});

test('terminal core updates cwd meta when shell output includes OSC 7 working-directory sequences', async (t) => {
  const { createTerminalCoreSession } = await import('../terminal-core.mjs');
  const events = [];
  const session = createTerminalCoreSession({
    frameworkRoot: process.cwd(),
    projectRoot: process.cwd(),
  });

  t.after(() => {
    try {
      session.stopSession({ announce: false });
    } catch {
      // ignore cleanup races in the test harness
    }
  });

  const unsubscribe = session.onEvent((event) => {
    events.push(event);
  });
  t.after(() => unsubscribe());

  session.startSession('shell');
  await waitFor(() => events.some((event) => event.channel === 'terminal/ready'));

  session.writeSystemOutput('\u001b]7;file://host.example/tmp/cwd-updated\u0007');

  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/meta' && event.meta?.cwd === '/tmp/cwd-updated')
  );
  assert.equal(session.getMeta().cwd, '/tmp/cwd-updated');
});

test('terminal core updates shell-integration command state from OSC 133 markers', async (t) => {
  const { createTerminalCoreSession } = await import('../terminal-core.mjs');
  const events = [];
  const session = createTerminalCoreSession({
    frameworkRoot: process.cwd(),
    projectRoot: process.cwd(),
  });

  t.after(() => {
    try {
      session.stopSession({ announce: false });
    } catch {
      // ignore cleanup races in the test harness
    }
  });

  const unsubscribe = session.onEvent((event) => {
    events.push(event);
  });
  t.after(() => unsubscribe());

  session.startSession('shell');
  await waitFor(() => events.some((event) => event.channel === 'terminal/ready'));

  session.writeSystemOutput('\u001b]133;B\u0007');
  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/meta' && event.meta?.shellIntegration?.commandState === 'running')
  );

  session.writeSystemOutput('\u001b]133;D;23\u0007');
  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/meta' && event.meta?.shellIntegration?.lastCommandExitCode === 23)
  );

  assert.equal(session.getMeta().shellIntegration?.supported, true);
  assert.equal(session.getMeta().shellIntegration?.commandState, 'failed');
  assert.equal(session.getMeta().shellIntegration?.lastCommandExitCode, 23);
});

test('terminal core reveals file paths by changing into the containing directory', async (t) => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { resolve } = await import('node:path');
  const { createTerminalCoreSession } = await import('../terminal-core.mjs');

  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-terminal-reveal-'));
  writeFileSync(resolve(projectRoot, 'brief.md'), '# brief\n');
  const events = [];
  const session = createTerminalCoreSession({
    frameworkRoot: process.cwd(),
    projectRoot,
  });

  t.after(() => {
    rmSync(projectRoot, { recursive: true, force: true });
    try {
      session.stopSession({ announce: false });
    } catch {
      // ignore cleanup races in the test harness
    }
  });

  const unsubscribe = session.onEvent((event) => {
    events.push(event);
  });
  t.after(() => unsubscribe());

  session.startSession('shell');
  await waitFor(() => events.some((event) => event.channel === 'terminal/ready'));

  session.revealPath('brief.md');

  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/output' && event.data.includes(projectRoot))
  );

  const combinedOutput = events
    .filter((event) => event.channel === 'terminal/output')
    .map((event) => event.data)
    .join('');
  assert.doesNotMatch(combinedOutput, /can't cd|no such file|not a directory/i);
});

test('terminal core only accepts shell sessions after agent launching moves out', async (t) => {
  const { createTerminalCoreSession } = await import('../terminal-core.mjs');
  const session = createTerminalCoreSession({
    frameworkRoot: process.cwd(),
    projectRoot: process.cwd(),
  });

  t.after(() => {
    try {
      session.stopSession({ announce: false });
    } catch {
      // ignore cleanup races in the test harness
    }
  });

  assert.throws(() => {
    session.startSession('claude');
  }, /Unsupported terminal mode/i);
});
