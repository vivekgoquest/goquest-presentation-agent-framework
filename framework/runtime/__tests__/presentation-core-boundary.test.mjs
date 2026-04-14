import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { createPresentationCore } from '../presentation-core.mjs';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-presentation-core-boundary-'));
}

function removeFile(projectRoot, relativePath) {
  rmSync(resolve(projectRoot, relativePath), { force: true });
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Core Boundary Brief',
      '',
      '## Goal',
      '',
      'Verify the real core finalize/export seam keeps authored files immutable.',
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
      '- Finalize output remains deterministic.',
      '- Export output stays inside the project.',
      '',
      '## Constraints',
      '',
      '- Keep authored source files unchanged.',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );
}

function snapshotFile(projectRoot, relativePath, snapshot) {
  const absolutePath = resolve(projectRoot, relativePath);
  snapshot.set(relativePath, existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : null);
}

function snapshotSlideFiles(projectRoot, relativeDir, snapshot) {
  const absoluteDir = resolve(projectRoot, relativeDir);
  if (!existsSync(absoluteDir)) {
    return;
  }

  const entries = readdirSync(absoluteDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const childRelativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      snapshotSlideFiles(projectRoot, childRelativePath, snapshot);
      continue;
    }

    if (entry.isFile() && (entry.name === 'slide.html' || entry.name === 'slide.css')) {
      snapshotFile(projectRoot, childRelativePath, snapshot);
    }
  }
}

function snapshotAuthoredSource(projectRoot) {
  const snapshot = new Map();
  snapshotFile(projectRoot, 'brief.md', snapshot);
  snapshotFile(projectRoot, 'outline.md', snapshot);
  snapshotFile(projectRoot, 'theme.css', snapshot);
  snapshotFile(projectRoot, '.presentation/intent.json', snapshot);
  snapshotSlideFiles(projectRoot, 'slides', snapshot);
  return Object.fromEntries([...snapshot.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

test('core finalize and export flows keep authored source immutable while real system-owned outputs refresh', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);

  removeFile(projectRoot, '.presentation/intent.json');
  removeFile(projectRoot, '.presentation/package.generated.json');
  removeFile(projectRoot, '.presentation/runtime/render-state.json');
  removeFile(projectRoot, '.presentation/runtime/artifacts.json');

  const before = snapshotAuthoredSource(projectRoot);
  const core = createPresentationCore();

  const finalizeResult = await core.finalize(projectRoot);
  const exportResult = await core.exportPresentation(projectRoot, {
    target: 'pdf',
    slideIds: ['intro'],
  });

  const after = snapshotAuthoredSource(projectRoot);
  assert.deepEqual(after, before);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/intent.json')), false);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/package.generated.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/runtime/render-state.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation/runtime/artifacts.json')), true);
  assert.equal(existsSync(resolve(projectRoot, finalizeResult.outputs.pdf)), true);
  assert.match(exportResult.outputDir, /^outputs\/exports\/.+\/pdf$/);
  assert.equal(exportResult.artifacts.length, 1);
  assert.equal(existsSync(resolve(projectRoot, exportResult.artifacts[0])), true);
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
