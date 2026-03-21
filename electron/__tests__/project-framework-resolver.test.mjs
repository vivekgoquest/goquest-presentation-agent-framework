import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-electron-resolver-'));
}

test('electron framework resolver honors override -> base -> shared precedence', async (t) => {
  const [{ createPresentationScaffold }, { resolveProjectFrameworkAssetForElectron }, { REPO_ROOT }] = await Promise.all([
    import('../../framework/runtime/services/scaffold-service.mjs'),
    import('../project-framework-resolver.mjs'),
    import('../../framework/runtime/deck-paths.js'),
  ]);

  const copiedProjectRoot = createTempProjectRoot();
  const linkedProjectRoot = createTempProjectRoot();
  t.after(() => rmSync(copiedProjectRoot, { recursive: true, force: true }));
  t.after(() => rmSync(linkedProjectRoot, { recursive: true, force: true }));

  await createPresentationScaffold(
    { projectRoot: copiedProjectRoot },
    { slideCount: 2, copyFramework: true }
  );
  await createPresentationScaffold(
    { projectRoot: linkedProjectRoot },
    { slideCount: 2, copyFramework: false }
  );

  const overrideNavAbs = resolve(copiedProjectRoot, '.presentation', 'framework', 'overrides', 'client', 'nav.js');
  writeFileSync(overrideNavAbs, 'console.log("override nav");\n');
  const overrideTemplateAbs = resolve(copiedProjectRoot, '.presentation', 'framework', 'overrides', 'templates', 'theme.css');
  writeFileSync(overrideTemplateAbs, '/* override theme */\n');

  const resolvedOverride = resolveProjectFrameworkAssetForElectron(copiedProjectRoot, 'client/nav.js');
  assert.equal(resolvedOverride, overrideNavAbs);

  const resolvedBase = resolveProjectFrameworkAssetForElectron(copiedProjectRoot, 'runtime/deck-quality.js');
  assert.equal(resolvedBase, resolve(copiedProjectRoot, '.presentation', 'framework', 'base', 'runtime', 'deck-quality.js'));
  assert.equal(existsSync(resolvedBase), true);
  const resolvedTemplateOverride = resolveProjectFrameworkAssetForElectron(copiedProjectRoot, 'templates/theme.css');
  assert.equal(resolvedTemplateOverride, overrideTemplateAbs);
  assert.equal(existsSync(resolvedTemplateOverride), true);

  const resolvedShared = resolveProjectFrameworkAssetForElectron(linkedProjectRoot, 'canvas/canvas.css');
  assert.equal(resolvedShared, resolve(REPO_ROOT, 'framework', 'canvas', 'canvas.css'));
  assert.equal(existsSync(resolvedShared), true);
  const resolvedSharedTemplate = resolveProjectFrameworkAssetForElectron(linkedProjectRoot, 'templates/theme.css');
  assert.equal(resolvedSharedTemplate, resolve(REPO_ROOT, 'framework', 'templates', 'theme.css'));
  assert.equal(existsSync(resolvedSharedTemplate), true);
});
