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

test('electron worker host creates a project and runs actions without runtime bypass channels', async (t) => {
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
      '- Product actions through the native worker host.',
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

  const slidesResponse = await host.handleRequest({
    channel: 'project:getSlides',
    payload: {},
  });
  assert.equal(slidesResponse.ok, true);
  assert.deepEqual(
    slidesResponse.data.slides.map((slide) => slide.id),
    ['intro', 'close']
  );

  const runtimeBypassResponse = await host.handleRequest({
    channel: 'runtime:check',
    payload: {},
  });
  assert.equal(runtimeBypassResponse.ok, false);
  assert.match(runtimeBypassResponse.error?.message || '', /unsupported worker request channel/i);

  const previewMetaResponse = await host.handleRequest({
    channel: 'preview:getMeta',
    payload: {},
  });
  assert.equal(previewMetaResponse.ok, true);
  assert.equal(previewMetaResponse.data.kind, 'slides');

  const previewDocumentResponse = await host.handleRequest({
    channel: 'preview:getDocument',
    payload: {},
  });
  assert.equal(previewDocumentResponse.ok, true);
  assert.match(previewDocumentResponse.data.html, /<section id=/i);

  const actionListResponse = await host.handleRequest({
    channel: 'action:list',
    payload: {},
  });
  assert.equal(actionListResponse.ok, true);
  assert(actionListResponse.data.actions.some((action) => action.id === 'export_presentation'));
  assert(actionListResponse.data.actions.some((action) => action.id === 'validate_presentation'));

  const buildCheckResponse = await host.handleRequest({
    channel: 'build:check',
    payload: {},
  });
  assert.equal(buildCheckResponse.ok, true);
  assert.equal(buildCheckResponse.data.status, 'pass');

  const reviewAvailabilityResponse = await host.handleRequest({
    channel: 'review:getAvailability',
    payload: {},
  });
  assert.equal(reviewAvailabilityResponse.ok, true);
  assert.equal(typeof reviewAvailabilityResponse.data.fixValidationIssues, 'boolean');
  assert.equal(typeof reviewAvailabilityResponse.data.reviewNarrative, 'boolean');
  assert.equal(typeof reviewAvailabilityResponse.data.reviewVisual, 'boolean');
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

test('electron worker host returns onboarding preview HTML instead of raw slide fallback for scaffolded projects', async (t) => {
  const { createElectronWorkerHost } = await import('../host.mjs');
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-electron-preview-onboarding-'));
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
      slides: 3,
      copyFramework: false,
    },
  });
  assert.equal(createResponse.ok, true);

  const previewResponse = await host.handleRequest({
    channel: 'preview:getDocument',
    payload: {},
  });

  assert.equal(previewResponse.ok, true);
  assert.match(previewResponse.data.html, /Presentation in progress/i);
  assert.doesNotMatch(previewResponse.data.html, /\[\[TODO_/i);
});

test('electron worker host returns the assembled deck HTML without preview-specific canvas overrides', async (t) => {
  const { createElectronWorkerHost } = await import('../host.mjs');
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-electron-preview-pass-through-'));
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

  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Pass Through Preview Brief',
      '',
      '## Goal',
      '',
      'Verify that Electron preview renders the assembled deck HTML without extra layout assumptions.',
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
      '- The preview iframe should render the authored deck HTML as-is.',
      '- Do not inject preview-specific canvas rules.',
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

  const previewResponse = await host.handleRequest({
    channel: 'preview:getDocument',
    payload: {},
  });

  assert.equal(previewResponse.ok, true);
  assert.equal(previewResponse.data.kind, 'slides');
  assert.match(previewResponse.data.html, /presentation:\/\/project-framework\/canvas\/canvas\.css/i);
  assert.match(previewResponse.data.html, /presentation:\/\/project-framework\/runtime\/runtime-chrome\.css/i);
  assert.match(previewResponse.data.html, /presentation:\/\/project-framework\/client\/nav\.js/i);
  assert.doesNotMatch(previewResponse.data.html, /scroll-snap-type:\s*y\s+mandatory/i);
  assert.doesNotMatch(previewResponse.data.html, /min-height:\s*100vh;\s*display:\s*flex;\s*align-items:\s*center;\s*justify-content:\s*center/i);
  assert.doesNotMatch(previewResponse.data.html, /\.dot-nav,\s*\.export-bar\s*\{\s*display:\s*none\s*!important/i);
  assert.doesNotMatch(previewResponse.data.html, /navigate-slide/i);
  assert.doesNotMatch(previewResponse.data.html, /slide-visible/i);
});
