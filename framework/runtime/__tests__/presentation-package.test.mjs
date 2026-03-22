import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-package-'));
}

test('getProjectPaths exposes canonical presentation package files', async (t) => {
  const [{ createProjectScaffold }, { getProjectPaths }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../deck-paths.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const paths = getProjectPaths(projectRoot);

  assert.equal(paths.intentRel, '.presentation/intent.json');
  assert.equal(paths.packageManifestRel, '.presentation/package.generated.json');
  assert.equal(paths.runtimeDirRel, '.presentation/runtime');
  assert.equal(paths.renderStateRel, '.presentation/runtime/render-state.json');
  assert.equal(paths.artifactsRel, '.presentation/runtime/artifacts.json');
  assert.equal(paths.lastGoodRel, '.presentation/runtime/last-good.json');
});
