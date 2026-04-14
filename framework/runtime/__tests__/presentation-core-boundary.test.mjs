import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { createPresentationCore } from '../presentation-core.mjs';
import { ensurePresentationPackageFiles } from '../presentation-package.js';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-presentation-core-boundary-'));
}

function removeFile(projectRoot, relativePath) {
  rmSync(resolve(projectRoot, relativePath), { force: true });
}

function snapshotFiles(projectRoot, relativePaths) {
  return Object.fromEntries(
    relativePaths.map((relativePath) => {
      const absolutePath = resolve(projectRoot, relativePath);
      return [
        relativePath,
        existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : null,
      ];
    }),
  );
}

test('core finalize and export flows do not create or rewrite authored content while refreshing system-owned files', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  removeFile(projectRoot, '.presentation/intent.json');
  removeFile(projectRoot, '.presentation/package.generated.json');
  removeFile(projectRoot, '.presentation/runtime/render-state.json');
  removeFile(projectRoot, '.presentation/runtime/artifacts.json');

  const authoredFiles = [
    'brief.md',
    'theme.css',
    'slides/010-intro/slide.html',
    '.presentation/intent.json',
  ];
  const before = snapshotFiles(projectRoot, authoredFiles);

  const core = createPresentationCore({
    async finalizePresentation(target) {
      ensurePresentationPackageFiles(target.projectRoot);
      return {
        status: 'pass',
        outputs: {
          outputDir: 'outputs/finalized',
          pdf: 'outputs/finalized/deck.pdf',
        },
        issues: [],
      };
    },
    async exportPresentation(target, request) {
      ensurePresentationPackageFiles(target.projectRoot);
      const outputDir = resolve(target.projectRoot, request.outputDir);
      return {
        format: request.format,
        outputDir,
        outputPaths: [resolve(outputDir, request.outputFile || 'deck.pdf')],
      };
    },
  });

  await core.finalize(projectRoot);
  await core.exportPresentation(projectRoot, {
    target: 'pdf',
    slideIds: ['intro'],
    outputDir: 'outputs/exports/test-run/pdf',
    outputFile: 'deck.pdf',
  });

  const after = snapshotFiles(projectRoot, authoredFiles);
  assert.deepEqual(after, before);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/package.generated.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/runtime/render-state.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/runtime/artifacts.json')), true);
});

test('core inspectPackage may refresh generated structure and runtime evidence without creating authored intent', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  removeFile(projectRoot, '.presentation/intent.json');
  removeFile(projectRoot, '.presentation/package.generated.json');
  removeFile(projectRoot, '.presentation/runtime/render-state.json');
  removeFile(projectRoot, '.presentation/runtime/artifacts.json');

  const core = createPresentationCore();
  const result = await core.inspectPackage(projectRoot);

  assert.equal(result.kind, 'presentation-package');
  assert.equal(existsSync(resolve(projectRoot, '.presentation/intent.json')), false);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/package.generated.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/runtime/render-state.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/runtime/artifacts.json')), true);
});
