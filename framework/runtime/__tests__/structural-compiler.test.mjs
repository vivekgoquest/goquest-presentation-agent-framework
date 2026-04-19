import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-structural-compiler-'));
}

test('computeStructuralManifest derives normalized slides from valid slide directories only', async (t) => {
  const [{ createPresentationScaffold }, { computeStructuralManifest }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../structural-compiler.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  renameSync(resolve(projectRoot, 'slides', '020-close'), resolve(projectRoot, 'slides', '020-problem'));
  mkdirSync(resolve(projectRoot, 'slides', 'notes-and-scratchpad'), { recursive: true });
  writeFileSync(resolve(projectRoot, 'slides', 'notes-and-scratchpad', 'slide.html'), '<section>Ignore me</section>');
  writeFileSync(resolve(projectRoot, 'brief.md'), '# Brief\n\nFilled in');

  const manifest = computeStructuralManifest(projectRoot);

  assert.deepEqual(manifest.slides.map((slide) => slide.id), ['intro', 'problem']);
  assert.deepEqual(manifest.slides.map((slide) => slide.orderValue), [10, 20]);
  assert.equal(manifest.source.brief.path, 'brief.md');
  assert.equal(manifest.source.outline.required, false);
  assert.equal('outputs' in manifest, false);
});

test('recordStructuralManifest writes package.generated.json only when content changes', async (t) => {
  const [{ createPresentationScaffold }, { recordStructuralManifest }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../structural-compiler.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const manifestPath = resolve(projectRoot, '.presentation', 'package.generated.json');

  const first = recordStructuralManifest(projectRoot);
  const before = statSync(manifestPath).mtimeMs;

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
  const second = recordStructuralManifest(projectRoot);
  const after = statSync(manifestPath).mtimeMs;

  assert.deepEqual(second, first);
  assert.equal(after, before);
  assert.deepEqual(JSON.parse(readFileSync(manifestPath, 'utf8')), second);
});

test('validatePresentationIntent rejects slide ids not present in the structural manifest', async () => {
  const { validatePresentationIntent } = await import('../presentation-intent.js');

  const issues = validatePresentationIntent(
    {
      slideIntent: {
        missing: {},
      },
    },
    {
      slides: [{ id: 'intro' }],
    },
  );

  assert.deepEqual(issues, ['Presentation intent references unknown slide id "missing".']);
});
