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
  const [{ createProjectQueryService }, { createProjectScaffold }] = await Promise.all([
    import('../project-query-service.mjs'),
    import('../project-scaffold-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const service = createProjectQueryService();
  const openResult = service.openProject({ projectRoot });
  assert.equal(openResult.meta.projectRoot, projectRoot);
  assert.equal(openResult.meta.active, true);

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
  service.openProject({ projectRoot });

  const preview = service.getPreviewDocument();
  assert.notEqual(preview.kind, 'slides');
  assert.match(preview.html, /policy|canvas|contract/i);
});
