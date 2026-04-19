import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-deck-paths-'));
}

test('parsePresentationTargetCliArgs accepts project targets only', async () => {
  const { parsePresentationTargetCliArgs } = await import('../deck-paths.js');

  const parsed = parsePresentationTargetCliArgs(['--project', '/tmp/pf-target']);
  assert.equal(parsed.target.kind, 'project');
  assert.equal(parsed.target.projectRootAbs, '/tmp/pf-target');

  assert.throws(
    () => parsePresentationTargetCliArgs(['--deck', 'legacy']),
    /Legacy workspace target "--deck" was removed/
  );
  assert.throws(
    () => parsePresentationTargetCliArgs(['--example', 'legacy']),
    /Legacy workspace target "--example" was removed/
  );
});

test('shell-less v1 project metadata and paths prefer root pdf delivery', async (t) => {
  const [{ createPresentationScaffold }, { getProjectPaths, getSuggestedPdfName, readProjectMetadata }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../deck-paths.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });

  const paths = getProjectPaths(projectRoot);
  const metadata = readProjectMetadata(projectRoot);
  const onDiskMetadata = JSON.parse(readFileSync(paths.metadataAbs, 'utf8'));

  assert.deepEqual(Object.keys(onDiskMetadata).sort(), [
    'canvasPolicy',
    'createdWithCoreVersion',
    'frameworkVersion',
    'projectMode',
    'projectName',
    'projectSchemaVersion',
    'projectSlug',
  ].sort());
  assert.equal(metadata.projectSchemaVersion, 1);
  assert.equal(metadata.createdWithCoreVersion, metadata.frameworkVersion);
  assert.equal(paths.renderStateRel, '.presentation/runtime/render-state.json');
  assert.equal(paths.artifactsRel, '.presentation/runtime/artifacts.json');
  assert.equal(paths.rootPdfRel, `${metadata.projectSlug}.pdf`);
  assert.equal(paths.rootPdfAbs, resolve(projectRoot, `${metadata.projectSlug}.pdf`));
  assert.equal(paths.claudeDirRel, '.claude');
  assert.equal(paths.claudeDirAbs, resolve(projectRoot, '.claude'));
  assert.equal(getSuggestedPdfName({ projectRootAbs: projectRoot }), `${metadata.projectSlug}.pdf`);
  assert.equal('historyPolicy' in metadata, false);
  assert.equal('frameworkMode' in metadata, false);
  assert.equal('frameworkSource' in metadata, false);
  assert.equal('lastGoodRel' in paths, false);
  assert.equal('lastGoodAbs' in paths, false);
});

test('readProjectMetadata points users at presentation init when project metadata is missing', async (t) => {
  const { readProjectMetadata } = await import('../deck-paths.js');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  assert.throws(
    () => readProjectMetadata(projectRoot),
    /Create the project with presentation init --project \/abs\/path first\./
  );
});

test('compatibility metadata restores legacy defaults and preserves copied mode inference', async (t) => {
  const [{ createPresentationScaffold }, { FRAMEWORK_ROOT, getProjectPaths, readProjectCompatibilityMetadata, readProjectMetadata }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../deck-paths.js'),
  ]);

  const linkedProjectRoot = createTempProjectRoot();
  const copiedProjectRoot = createTempProjectRoot();
  t.after(() => rmSync(linkedProjectRoot, { recursive: true, force: true }));
  t.after(() => rmSync(copiedProjectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot: linkedProjectRoot }, { slideCount: 2, copyFramework: false });
  createPresentationScaffold({ projectRoot: copiedProjectRoot }, { slideCount: 2, copyFramework: true });

  const linkedRaw = readProjectMetadata(linkedProjectRoot);
  const linkedCompat = readProjectCompatibilityMetadata(linkedProjectRoot);
  const copiedRaw = readProjectMetadata(copiedProjectRoot);
  const copiedCompat = readProjectCompatibilityMetadata(copiedProjectRoot);
  const copiedPaths = getProjectPaths(copiedProjectRoot);

  assert.equal('frameworkMode' in linkedRaw, false);
  assert.equal('historyPolicy' in linkedRaw, false);
  assert.equal(linkedCompat.frameworkMode, 'linked');
  assert.equal(linkedCompat.frameworkSource, FRAMEWORK_ROOT);
  assert.equal(linkedCompat.historyPolicy, 'checkpointed');

  assert.equal('frameworkMode' in copiedRaw, false);
  assert.equal(copiedCompat.frameworkMode, 'copied');
  assert.equal(copiedCompat.frameworkSource, FRAMEWORK_ROOT);
  assert.equal(copiedCompat.historyPolicy, 'checkpointed');
  assert.equal(copiedPaths.frameworkMode, 'copied');
});
