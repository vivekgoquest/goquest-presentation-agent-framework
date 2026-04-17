import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-package-'));
}

test('getProjectPaths exposes shell-less v1 package, adapter, and root pdf helpers', async (t) => {
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
  assert.equal(paths.rootPdfRel, `${paths.slug}.pdf`);
  assert.equal(paths.claudeDirRel, '.claude');
  assert.equal(paths.claudeDirAbs, resolve(projectRoot, '.claude'));
  assert.equal('lastGoodRel' in paths, false);
  assert.equal('lastGoodAbs' in paths, false);
});

function flattenTree(node) {
  return [
    node,
    ...((node.children || []).flatMap((child) => flattenTree(child))),
  ];
}

test('project tree classifies shell-less v1 source, system, adapter, and deliverable files', async (t) => {
  const [{ createProjectScaffold }, { getProjectPaths }, { buildProjectTreeNode }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../deck-paths.js'),
    import('../project-tree.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const paths = getProjectPaths(projectRoot);
  writeFileSync(paths.rootPdfAbs, 'fake pdf');

  const nodes = new Map(flattenTree(buildProjectTreeNode(projectRoot, projectRoot)).map((node) => [node.relativePath, node]));

  assert.equal(nodes.get('.presentation').classification, 'system');
  assert.equal(nodes.get('.presentation/project.json').classification, 'system');
  assert.equal(nodes.get('.claude').classification, 'adapter');
  assert.equal(nodes.get('.claude/CLAUDE.md').classification, 'adapter');
  assert.equal(nodes.get('brief.md').classification, 'source');
  assert.equal(nodes.get('theme.css').classification, 'source');
  assert.equal(nodes.get('slides').classification, 'source');
  assert.equal(nodes.get('slides/010-intro').classification, 'source');
  assert.equal(nodes.get(paths.rootPdfRel).classification, 'deliverable');
});

test('generatePresentationPackageManifest derives presentation structure from source files', async (t) => {
  const [{ createProjectScaffold }, { generatePresentationPackageManifest }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../presentation-package.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  writeFileSync(resolve(projectRoot, 'brief.md'), '# Brief\n\nFilled in');

  const manifest = generatePresentationPackageManifest(projectRoot);
  assert.deepEqual(manifest.slides.map((slide) => slide.id), ['intro', 'close']);
  assert.equal(manifest.source.brief.path, 'brief.md');
  assert.equal(manifest.source.theme.path, 'theme.css');
  assert.equal('outputs' in manifest, false);
});

test('scaffold writes initial intent and generated package files', async (t) => {
  const { createProjectScaffold } = await import('../../application/project-scaffold-service.mjs');

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });

  const intentPath = resolve(projectRoot, '.presentation', 'intent.json');
  const manifestPath = resolve(projectRoot, '.presentation', 'package.generated.json');
  assert.ok(existsSync(intentPath));
  assert.ok(existsSync(manifestPath));

  const intent = JSON.parse(readFileSync(intentPath, 'utf8'));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(intent.schemaVersion, 1);
  assert.equal(manifest.schemaVersion, 1);
});

test('renderPresentationHtml regenerates missing package files for legacy projects', async (t) => {
  const [{ createProjectScaffold }, { renderPresentationHtml }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../deck-assemble.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  writeFileSync(resolve(projectRoot, 'brief.md'), '# Brief\n\nFilled in');
  rmSync(resolve(projectRoot, '.presentation', 'intent.json'), { force: true });
  rmSync(resolve(projectRoot, '.presentation', 'package.generated.json'), { force: true });

  const preview = renderPresentationHtml({ projectRoot });
  assert.equal(preview.slideIds.length, 2);
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'intent.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'package.generated.json')));
});

test('presentation-package legacy helpers delegate structural manifest compute and record behavior', async (t) => {
  const [{ createProjectScaffold }, packageHelpers, structuralCompiler] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../presentation-package.js'),
    import('../structural-compiler.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });

  const generated = packageHelpers.generatePresentationPackageManifest(projectRoot);
  const computed = structuralCompiler.computeStructuralManifest(projectRoot);
  assert.deepEqual(generated, computed);

  const written = packageHelpers.writePresentationPackageManifest(projectRoot);
  const recorded = structuralCompiler.recordStructuralManifest(projectRoot);
  assert.deepEqual(written, recorded);
});

test('ensurePresentationPackageFiles does not rewrite an unchanged package manifest', async (t) => {
  const [{ createProjectScaffold }, { ensurePresentationPackageFiles }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../presentation-package.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });

  const manifestPath = resolve(projectRoot, '.presentation', 'package.generated.json');
  const before = statSync(manifestPath).mtimeMs;

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));
  ensurePresentationPackageFiles(projectRoot);

  const after = statSync(manifestPath).mtimeMs;
  assert.equal(after, before);
});
