import test from 'node:test';
import assert from 'node:assert/strict';

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

  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/output' && event.data.includes('__TERM_EVENT_OK__'))
  );
  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/exit')
  );

  assert(events.some((event) => event.channel === 'terminal/ready'));
  assert.equal(session.getMeta().state, 'stopped');
});
