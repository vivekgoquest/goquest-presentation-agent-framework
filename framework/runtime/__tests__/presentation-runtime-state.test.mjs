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

test('writeRenderState persists runtime validation truth', async (t) => {
  const [{ createProjectScaffold }, { writeRenderState }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const renderStatePath = resolve(projectRoot, '.presentation', 'runtime', 'render-state.json');

  writeRenderState(projectRoot, {
    status: 'pass',
    slideIds: ['intro', 'close'],
  });

  assert.ok(existsSync(renderStatePath));
  const json = readJson(renderStatePath);
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.status, 'pass');
  assert.deepEqual(json.slideIds, ['intro', 'close']);
});

test('writeArtifacts persists output inventory', async (t) => {
  const [{ createProjectScaffold }, { writeArtifacts }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const artifactsPath = resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json');

  writeArtifacts(projectRoot, {
    pdf: 'outputs/deck.pdf',
    slides: ['outputs/slides/slide-intro.png'],
  });

  assert.ok(existsSync(artifactsPath));
  const json = readJson(artifactsPath);
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.pdf.path, 'outputs/deck.pdf');
  assert.deepEqual(json.slides.map((slide) => slide.path), ['outputs/slides/slide-intro.png']);
});
