import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';

function waitFor(predicate, timeoutMs = 15000, intervalMs = 50) {
  const deadline = Date.now() + timeoutMs;

  return new Promise((resolvePromise, reject) => {
    function poll() {
      if (predicate()) {
        resolvePromise();
        return;
      }

      if (Date.now() > deadline) {
        reject(new Error('Timed out waiting for Electron worker host event.'));
        return;
      }

      setTimeout(poll, intervalMs);
    }

    poll();
  });
}

test('electron worker host creates a project and runs runtime actions without server mode', async (t) => {
  const { createElectronWorkerHost } = await import('../host.mjs');
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-electron-host-'));
  const host = createElectronWorkerHost({
    frameworkRoot: process.cwd(),
  });

  t.after(async () => {
    await host.dispose();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  const createResponse = await host.handleRequest({
    channel: 'project:create',
    payload: {
      projectRoot,
      slides: 2,
      copyFramework: false,
    },
  });

  assert.equal(createResponse.ok, true);
  assert.equal(createResponse.data.meta.active, true);
  assert.equal(createResponse.data.meta.projectRoot, projectRoot);

  const briefPath = resolve(projectRoot, 'brief.md');
  void readFileSync(briefPath, 'utf8');
  writeFileSync(
    briefPath,
    [
      '# Electron Worker Host Brief',
      '',
      '## Goal',
      '',
      'Validate project lifecycle and runtime actions through the Electron worker host.',
      '',
      '## Audience',
      '',
      'Framework maintainers.',
      '',
      '## Tone',
      '',
      'Operational and concise.',
      '',
      '## Must Include',
      '',
      '- Project create and open behavior.',
      '- Runtime actions without server.mjs.',
      '',
      '## Constraints',
      '',
      '- Keep the project-folder contract intact.',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );

  const stateResponse = await host.handleRequest({
    channel: 'project:getState',
    payload: {},
  });
  assert.equal(stateResponse.ok, true);
  assert.equal(stateResponse.data.projectRoot, projectRoot);

  const filesResponse = await host.handleRequest({
    channel: 'project:getFiles',
    payload: {},
  });
  assert.equal(filesResponse.ok, true);
  assert.equal(filesResponse.data.root, projectRoot);
  assert.equal(filesResponse.data.tree.kind, 'root');

  const checkResponse = await host.handleRequest({
    channel: 'runtime:check',
    payload: {},
  });
  assert.equal(checkResponse.ok, true);
  assert.equal(checkResponse.data.status, 'pass');
});

test('electron worker host relays terminal events from the shared core', async (t) => {
  const { createElectronWorkerHost } = await import('../host.mjs');
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-electron-terminal-'));
  const host = createElectronWorkerHost({
    frameworkRoot: process.cwd(),
  });
  const events = [];

  t.after(async () => {
    await host.dispose();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  const unsubscribe = host.onEvent((event) => {
    events.push(event);
  });
  t.after(() => unsubscribe());

  const createResponse = await host.handleRequest({
    channel: 'project:create',
    payload: {
      projectRoot,
      slides: 1,
      copyFramework: false,
    },
  });
  assert.equal(createResponse.ok, true);

  const startResponse = await host.handleRequest({
    channel: 'terminal:start',
    payload: { mode: 'shell' },
  });
  assert.equal(startResponse.ok, true);
  assert.equal(startResponse.data.mode, 'shell');

  const inputResponse = await host.handleRequest({
    channel: 'terminal:input',
    payload: { data: 'echo __ELECTRON_HOST_TERM_OK__\nexit\n' },
  });
  assert.equal(inputResponse.ok, true);

  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/output' && event.data.includes('__ELECTRON_HOST_TERM_OK__'))
  );
  await waitFor(() =>
    events.some((event) => event.channel === 'terminal/exit')
  );
});
