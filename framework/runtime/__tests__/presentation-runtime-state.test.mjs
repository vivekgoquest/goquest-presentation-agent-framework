import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-runtime-state-'));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('ensurePresentationRuntimeStateFiles creates render-state and artifacts only', async (t) => {
  const [{ createProjectScaffold }, { ensurePresentationRuntimeStateFiles }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  rmSync(resolve(projectRoot, '.presentation', 'runtime'), { recursive: true, force: true });

  const state = ensurePresentationRuntimeStateFiles(projectRoot);

  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json')));
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'last-good.json')), false);
  assert.ok(state.renderState);
  assert.ok(state.artifacts);
  assert.equal('lastGood' in state, false);
});

test('writeRenderState persists runtime validation truth and evidence metadata', async (t) => {
  const [{ createProjectScaffold }, { writeRenderState }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const renderStatePath = resolve(projectRoot, '.presentation', 'runtime', 'render-state.json');

  writeRenderState(projectRoot, {
    sourceFingerprint: 'sha256:test',
    producer: 'validate',
    status: 'pass',
    slideIds: ['intro', 'close'],
  });

  assert.ok(existsSync(renderStatePath));
  const json = readJson(renderStatePath);
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.kind, 'render-state');
  assert.equal(json.sourceFingerprint, 'sha256:test');
  assert.equal(json.producer, 'validate');
  assert.equal(json.status, 'pass');
  assert.deepEqual(json.slideIds, ['intro', 'close']);
});

test('writeArtifacts persists finalized and latest export evidence', async (t) => {
  const [{ createProjectScaffold }, { writeArtifacts }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const artifactsPath = resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json');

  writeArtifacts(projectRoot, {
    sourceFingerprint: 'sha256:test',
    finalized: {
      exists: true,
      outputDir: 'outputs/finalized',
      pdf: 'outputs/finalized/deck.pdf',
      slides: ['outputs/finalized/slides/slide-intro.png'],
    },
    latestExport: {
      exists: true,
      format: 'png',
      outputDir: 'outputs/exports/review',
      slides: [{ id: 'intro', path: 'outputs/exports/review/slide-intro.png' }],
    },
  });

  assert.ok(existsSync(artifactsPath));
  const json = readJson(artifactsPath);
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.kind, 'artifacts');
  assert.equal(json.sourceFingerprint, 'sha256:test');
  assert.equal(json.finalized.exists, true);
  assert.equal(json.finalized.pdf.path, 'outputs/finalized/deck.pdf');
  assert.deepEqual(json.finalized.slides.map((slide) => slide.path), ['outputs/finalized/slides/slide-intro.png']);
  assert.equal(json.latestExport.exists, true);
  assert.equal(json.latestExport.format, 'png');
  assert.deepEqual(json.latestExport.slides.map((slide) => slide.path), ['outputs/exports/review/slide-intro.png']);
});
