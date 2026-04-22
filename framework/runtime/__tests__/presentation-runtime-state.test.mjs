import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-runtime-state-'));
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

test('ensurePresentationRuntimeStateFiles creates render-state, design-state evidence, and artifacts', async (t) => {
  const [{ createPresentationScaffold }, {
    ensurePresentationRuntimeStateFiles,
    readDesignState,
  }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  rmSync(resolve(projectRoot, '.presentation', 'runtime'), { recursive: true, force: true });

  const state = ensurePresentationRuntimeStateFiles(projectRoot);
  const designStatePath = resolve(projectRoot, '.presentation', 'runtime', 'design-state.json');

  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json')));
  assert.ok(existsSync(designStatePath));
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'last-good.json')), false);
  assert.ok(state.renderState);
  assert.ok(state.artifacts);
  assert.equal(state.designState.kind, 'presentation-design-state');
  assert.equal(readDesignState(projectRoot).kind, 'presentation-design-state');
  assert.equal('lastGood' in state, false);
});

test('ensurePresentationRuntimeStateFiles creates design-state evidence alongside render-state and artifacts', async (t) => {
  const [{ createPresentationScaffold }, {
    ensurePresentationRuntimeStateFiles,
    readDesignState,
  }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  rmSync(resolve(projectRoot, '.presentation', 'runtime'), { recursive: true, force: true });

  const state = ensurePresentationRuntimeStateFiles(projectRoot);
  const designStatePath = resolve(projectRoot, '.presentation', 'runtime', 'design-state.json');

  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json')));
  assert.ok(existsSync(designStatePath));
  assert.equal(state.designState.kind, 'presentation-design-state');
  assert.equal(readDesignState(projectRoot).kind, 'presentation-design-state');
});

test('writeRenderState persists runtime validation truth and evidence metadata', async (t) => {
  const [{ createPresentationScaffold }, { writeRenderState }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
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

test('writeDesignState persists generated design-state evidence', async (t) => {
  const [{ createPresentationScaffold }, { writeDesignState }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  const designStatePath = resolve(projectRoot, '.presentation', 'runtime', 'design-state.json');

  writeDesignState(projectRoot, {
    sourceFingerprint: 'sha256:test',
    canvas: { status: 'fixed' },
    theme: { status: 'working', source: 'theme.css' },
  });

  const json = readJson(designStatePath);
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.kind, 'presentation-design-state');
  assert.equal(json.sourceFingerprint, 'sha256:test');
  assert.equal(json.canvas.status, 'fixed');
  assert.deepEqual(json.canvas.structuralTokens, []);
  assert.deepEqual(json.theme.observedTokens, []);
  assert.equal(json.driftRules.untrackedLayerBypassIsNotAllowed, true);
  assert.equal(json.theme.status, 'working');
});

test('writeArtifacts persists simplified root-pdf artifact evidence', async (t) => {
  const [{ createPresentationScaffold }, { writeArtifacts }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const artifactsPath = resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json');

  const rootPdfRel = `${basename(projectRoot)}.pdf`;

  writeArtifacts(projectRoot, {
    sourceFingerprint: 'sha256:test',
    finalized: {
      exists: true,
      pdf: rootPdfRel,
    },
    latestExport: {
      exists: true,
      pdf: rootPdfRel,
      artifacts: [rootPdfRel],
    },
  });

  assert.ok(existsSync(artifactsPath));
  const json = readJson(artifactsPath);
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.kind, 'artifacts');
  assert.equal(json.sourceFingerprint, 'sha256:test');
  assert.deepEqual(json.finalized, {
    exists: true,
    pdf: { path: rootPdfRel },
  });
  assert.deepEqual(json.latestExport, {
    exists: true,
    format: 'pdf',
    pdf: { path: rootPdfRel },
    artifacts: [{ path: rootPdfRel }],
  });
  assert.equal(json.pdf.path, rootPdfRel);
  assert.equal(json.outputDir, '');
});
