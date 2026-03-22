import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-electron-resolver-'));
}

test('electron framework resolver honors override -> base -> shared precedence', async (t) => {
  const [{ createProjectScaffold }, { resolveProjectFrameworkAsset }, { REPO_ROOT }] = await Promise.all([
    import('../../framework/application/project-scaffold-service.mjs'),
    import('../../framework/application/project-framework-resolver.mjs'),
    import('../../framework/runtime/deck-paths.js'),
  ]);

  const copiedProjectRoot = createTempProjectRoot();
  const linkedProjectRoot = createTempProjectRoot();
  t.after(() => rmSync(copiedProjectRoot, { recursive: true, force: true }));
  t.after(() => rmSync(linkedProjectRoot, { recursive: true, force: true }));

  await createProjectScaffold(
    { projectRoot: copiedProjectRoot },
    { slideCount: 2, copyFramework: true }
  );
  await createProjectScaffold(
    { projectRoot: linkedProjectRoot },
    { slideCount: 2, copyFramework: false }
  );

  const overrideNavAbs = resolve(copiedProjectRoot, '.presentation', 'framework', 'overrides', 'client', 'nav.js');
  writeFileSync(overrideNavAbs, 'console.log("override nav");\n');
  const overrideTemplateAbs = resolve(copiedProjectRoot, '.presentation', 'framework', 'overrides', 'templates', 'theme.css');
  writeFileSync(overrideTemplateAbs, '/* override theme */\n');

  const resolvedOverride = resolveProjectFrameworkAsset(copiedProjectRoot, 'client/nav.js');
  assert.equal(resolvedOverride, overrideNavAbs);

  const resolvedBase = resolveProjectFrameworkAsset(copiedProjectRoot, 'runtime/deck-quality.js');
  assert.equal(resolvedBase, resolve(copiedProjectRoot, '.presentation', 'framework', 'base', 'runtime', 'deck-quality.js'));
  assert.equal(existsSync(resolvedBase), true);
  const resolvedTemplateOverride = resolveProjectFrameworkAsset(copiedProjectRoot, 'templates/theme.css');
  assert.equal(resolvedTemplateOverride, overrideTemplateAbs);
  assert.equal(existsSync(resolvedTemplateOverride), true);

  const resolvedShared = resolveProjectFrameworkAsset(linkedProjectRoot, 'canvas/canvas.css');
  assert.equal(resolvedShared, resolve(REPO_ROOT, 'framework', 'canvas', 'canvas.css'));
  assert.equal(existsSync(resolvedShared), true);
  const resolvedSharedTemplate = resolveProjectFrameworkAsset(linkedProjectRoot, 'templates/theme.css');
  assert.equal(resolvedSharedTemplate, resolve(REPO_ROOT, 'framework', 'templates', 'theme.css'));
  assert.equal(existsSync(resolvedSharedTemplate), true);
});
