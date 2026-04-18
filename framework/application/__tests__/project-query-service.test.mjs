import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(resolve(tmpdir(), 'pf-project-query-'));
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Project Query Brief',
      '',
      '## Goal',
      '',
      'Validate application-layer project queries for Electron.',
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
      '- Application-owned project lifecycle queries.',
      '',
      '## Constraints',
      '',
      '- none',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );
}

test('project query service creates, opens, and previews a project through application-owned queries', async (t) => {
  const [{ createProjectQueryService }, { createProjectScaffold }, { writeRenderState }, { computeSourceFingerprint }] = await Promise.all([
    import('../project-query-service.mjs'),
    import('../project-scaffold-service.mjs'),
    import('../../runtime/presentation-runtime-state.js'),
    import('../../runtime/source-fingerprint.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const service = createProjectQueryService();
  const openResult = service.openProject({ projectRoot });
  assert.equal(openResult.meta.projectRoot, projectRoot);
  assert.equal(openResult.meta.active, true);
  assert.equal(openResult.meta.packageModel, 'deterministic');

  writeRenderState(projectRoot, {
    status: 'pass',
    slideIds: ['intro', 'close'],
    sourceFingerprint: computeSourceFingerprint(projectRoot),
    lastCheckedAt: '2026-03-22T00:00:00.000Z',
  });

  const state = service.getState();
  assert.equal(state.packageStateAvailable, true);
  assert.equal(state.runtimeEvidenceAvailable, true);
  assert.equal(state.status, 'ready_to_finalize');
  assert.equal(state.lastRenderStatus, 'pass');
  assert.equal(state.lastCheckedAt, '2026-03-22T00:00:00.000Z');
  assert.deepEqual(state.nextFocus, ['presentation export']);
  assert.match(state.nextStep, /presentation export/i);

  const previewMeta = service.getPreviewMeta();
  assert.equal(previewMeta.kind, 'slides');
  assert.deepEqual(previewMeta.viewport, { width: 1280, height: 720 });

  const preview = service.getPreviewDocument();
  assert.equal(preview.kind, 'slides');
  assert.deepEqual(preview.viewport, { width: 1280, height: 720 });
  assert.match(preview.html, /presentation:\/\/project-framework\/canvas\/canvas\.css/i);
  assert.match(preview.html, /<section id=/i);

  const slides = service.getSlides();
  assert.deepEqual(
    slides.map((slide) => slide.id),
    ['intro', 'close']
  );
  assert.deepEqual(
    slides.map((slide) => slide.dirName),
    ['010-intro', '020-close']
  );
});

test('project query service reads package state and preview through the protected core facade', async (t) => {
  const [{ createProjectQueryService }, { createProjectScaffold }] = await Promise.all([
    import('../project-query-service.mjs'),
    import('../project-scaffold-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const coreCalls = [];
  const service = createProjectQueryService({
    core: {
      inspectPackage(projectRootInput, options = {}) {
        coreCalls.push(['inspectPackage', projectRootInput, options]);
        return {
          kind: 'presentation-package',
          projectRoot: projectRootInput,
          title: 'Core-backed Query Deck',
          slug: 'core-backed-query-deck',
          manifest: {
            counts: { slidesTotal: 2 },
            slides: [
              {
                id: 'intro',
                dir: 'slides/010-intro',
                orderLabel: '010',
                orderValue: 10,
              },
              {
                id: 'close',
                dir: 'slides/020-close',
                orderLabel: '020',
                orderValue: 20,
              },
            ],
          },
          renderState: {
            status: 'pass',
            lastCheckedAt: '2026-04-14T00:00:00.000Z',
          },
          artifacts: {
            finalized: {
              exists: false,
              pdf: null,
              report: null,
              summary: null,
            },
          },
          status: {
            workflow: 'ready_for_finalize',
            summary: 'Ready to export.',
            blockers: [],
            facets: {
              delivery: 'not_finalized',
              evidence: 'current',
            },
            nextBoundary: 'finalize',
            nextFocus: ['presentation export'],
          },
        };
      },
      getStatus(projectRootInput) {
        coreCalls.push(['getStatus', projectRootInput]);
        return {
          kind: 'presentation-status',
          projectRoot: projectRootInput,
          workflow: 'ready_for_finalize',
          summary: 'Ready to export.',
          blockers: [],
          facets: {
            delivery: 'not_finalized',
            evidence: 'current',
          },
          nextBoundary: 'finalize',
          nextFocus: ['presentation export'],
          evidence: [
            '.presentation/runtime/render-state.json',
            '.presentation/runtime/artifacts.json',
          ],
          freshness: {
            relativeToSource: 'current',
          },
        };
      },
      getPreview(projectRootInput) {
        coreCalls.push(['getPreview', projectRootInput]);
        return {
          kind: 'slides',
          projectRoot: projectRootInput,
          title: 'Core-backed Query Deck',
          slideIds: ['intro', 'close'],
          html: '<!doctype html><html><body><section id="intro"></section></body></html>',
          viewport: { width: 1280, height: 720 },
        };
      },
    },
  });

  service.openProject({ projectRoot });
  coreCalls.length = 0;

  const state = service.getState();
  const slides = service.getSlides();
  const preview = service.getPreviewDocument();

  assert.equal(state.status, 'ready_to_finalize');
  assert.equal(state.lastRenderStatus, 'pass');
  assert.equal(state.lastCheckedAt, '2026-04-14T00:00:00.000Z');
  assert.deepEqual(slides.map((slide) => slide.id), ['intro', 'close']);
  assert.equal(preview.kind, 'slides');
  assert.deepEqual(preview.viewport, { width: 1280, height: 720 });
  assert.ok(coreCalls.some((entry) => entry[0] === 'getStatus' && entry[1] === projectRoot));
  assert.ok(coreCalls.some((entry) => entry[0] === 'inspectPackage' && entry[1] === projectRoot));
  assert.ok(coreCalls.some((entry) => entry[0] === 'getPreview' && entry[1] === projectRoot));
});

test('project query service rejects missing project paths', async () => {
  const { createProjectQueryService } = await import('../project-query-service.mjs');
  const service = createProjectQueryService();

  assert.throws(
    () => service.createProject({ projectRoot: '' }),
    /Choose a target folder/
  );
  assert.throws(
    () => service.openProject({ projectRoot: '' }),
    /Choose a presentation project folder/
  );
});

test('project query preview fails closed when a copied framework canvas drifts from the sacred contract', async (t) => {
  const [{ createProjectQueryService }, { createProjectScaffold }] = await Promise.all([
    import('../project-query-service.mjs'),
    import('../project-scaffold-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: true });
  fillBrief(projectRoot);

  const copiedCanvasCss = resolve(projectRoot, '.presentation', 'framework', 'base', 'canvas', 'canvas.css');
  const originalCanvasCss = readFileSync(copiedCanvasCss, 'utf8');
  writeFileSync(
    copiedCanvasCss,
    originalCanvasCss.replace('--slide-ratio: 16 / 9;', '--slide-ratio: 4 / 3;')
  );

  const service = createProjectQueryService();
  const openResult = service.openProject({ projectRoot });

  assert.equal(openResult.meta.frameworkMode, 'copied');
  assert.equal('historyPolicy' in openResult.meta, false);

  const preview = service.getPreviewDocument();
  assert.notEqual(preview.kind, 'slides');
  assert.match(preview.html, /policy|canvas|contract/i);
});
