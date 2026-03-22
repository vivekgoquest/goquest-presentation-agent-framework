import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-native-host-'));
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Native Host Brief',
      '',
      '## Goal',
      '',
      'Validate extracted runtime services against a real scaffolded project.',
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
      '- Service extraction for Electron migration.',
      '',
      '## Constraints',
      '',
      '- Keep the existing deck contract intact.',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );
}

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, 'utf8'));
}

test('application scaffold creates a linked project scaffold with the required agent package contract', async (t) => {
  const [
    { createProjectScaffold },
    { getProjectAgentScaffoldPackage },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../../../../project-agent/scaffold-package.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const result = await createProjectScaffold(
    { projectRoot },
    { slideCount: 3, copyFramework: false }
  );

  assert.equal(result.status, 'created');
  assert.equal(result.frameworkMode, 'linked');
  assert.ok(existsSync(resolve(projectRoot, 'theme.css')));
  assert.equal(existsSync(resolve(projectRoot, 'revisions.md')), false);
  assert.ok(existsSync(resolve(projectRoot, 'slides', '010-intro', 'slide.html')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'project.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'framework-cli.mjs')));

  const scaffoldPackage = getProjectAgentScaffoldPackage({ frameworkRoot: process.cwd() });
  for (const requiredPath of scaffoldPackage.requiredPaths) {
    assert.ok(existsSync(resolve(projectRoot, requiredPath)), `missing required scaffold path: ${requiredPath}`);
  }

  const metadata = JSON.parse(readFileSync(resolve(projectRoot, '.presentation', 'project.json'), 'utf8'));
  assert.equal(metadata.frameworkMode, 'linked');
});

test('copied framework scaffold omits prompts and specs snapshots', async (t) => {
  const { createProjectScaffold } = await import('../../../application/project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const result = await createProjectScaffold(
    { projectRoot },
    { slideCount: 3, copyFramework: true }
  );

  assert.equal(result.status, 'created');
  assert.equal(result.frameworkMode, 'copied');
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework', 'base', 'templates')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework', 'overrides', 'templates')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework', 'base', 'prompts')), false);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework', 'base', 'specs')), false);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework', 'overrides', 'prompts')), false);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework', 'overrides', 'specs')), false);
});

test('runtime services operate on a real scaffolded project', async (t) => {
  const [
    { createProjectScaffold },
    { capturePresentation },
    { runDeckCheck },
    { exportDeckPdf },
    { finalizePresentation },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../capture-service.mjs'),
    import('../check-service.mjs'),
    import('../export-service.mjs'),
    import('../finalize-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const captureDir = resolve(projectRoot, '.artifacts', 'capture');
  const capture = await capturePresentation({ projectRoot }, captureDir);
  assert.ok(capture.slideCount >= 1);
  assert.ok(existsSync(resolve(captureDir, 'report.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json')));
  const captureArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.ok(Array.isArray(captureArtifacts.slides));
  assert.ok(captureArtifacts.slides.length >= 1);

  const checkDir = resolve(projectRoot, '.artifacts', 'check');
  const check = await runDeckCheck({ projectRoot }, { outputDir: checkDir });
  assert.equal(check.status, 'pass');
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')));
  const renderState = readJson(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json'));
  assert.equal(renderState.status, 'pass');
  assert.deepEqual(renderState.slideIds.sort(), ['close', 'intro']);

  const exportPath = resolve(projectRoot, 'outputs', 'service-export.pdf');
  const exported = await exportDeckPdf({ projectRoot }, exportPath);
  assert.equal(exported.outputPath, exportPath);
  assert.ok(existsSync(exportPath));
  assert.equal(readFileSync(exportPath).subarray(0, 4).toString(), '%PDF');
  const exportedArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(exportedArtifacts.pdf.path, 'outputs/service-export.pdf');

  const finalized = await finalizePresentation({ projectRoot });
  assert.equal(finalized.status, 'pass');
  assert.ok(existsSync(resolve(projectRoot, 'outputs', 'deck.pdf')));
  assert.ok(existsSync(resolve(projectRoot, 'outputs', 'report.json')));
  assert.ok(existsSync(resolve(projectRoot, 'outputs', 'summary.md')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'last-good.json')));
  const lastGood = readJson(resolve(projectRoot, '.presentation', 'runtime', 'last-good.json'));
  assert.equal(lastGood.status, 'pass');
  assert.equal(lastGood.artifacts.pdf, 'outputs/deck.pdf');
});

test('assembled deck keeps export in Electron and out of the deck html', async (t) => {
  const [
    { createProjectScaffold },
    { renderPresentationHtml },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../../deck-assemble.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const rendered = renderPresentationHtml({ projectRoot });
  assert.doesNotMatch(rendered.html, /runtime-export-bar/);
  assert.doesNotMatch(rendered.html, /data-export-pdf/);
  assert.doesNotMatch(rendered.html, /client\/export\.js/);
  assert.match(rendered.html, /runtime\/runtime-chrome\.css/);
});

test('runtime export service can export selected slides to one pdf or individual pngs', async (t) => {
  const [
    { createProjectScaffold },
    { exportPresentation },
    { PDFDocument },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../export-service.mjs'),
    import('pdf-lib'),
  ]);

  const projectRoot = createTempProjectRoot();
  const pdfOutputDir = resolve(projectRoot, '.artifacts', 'selected-pdf');
  const pngOutputDir = resolve(projectRoot, '.artifacts', 'selected-png');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const pdfResult = await exportPresentation(
    { projectRoot },
    { format: 'pdf', slideIds: ['close'], outputDir: pdfOutputDir }
  );
  assert.equal(pdfResult.format, 'pdf');
  assert.equal(pdfResult.slideIds.length, 1);
  assert.ok(existsSync(pdfResult.outputPath));
  const pdfDoc = await PDFDocument.load(readFileSync(pdfResult.outputPath));
  assert.equal(pdfDoc.getPageCount(), 1);

  const pngResult = await exportPresentation(
    { projectRoot },
    { format: 'png', slideIds: ['intro'], outputDir: pngOutputDir }
  );
  assert.equal(pngResult.format, 'png');
  assert.deepEqual(pngResult.slideIds, ['intro']);
  assert.equal(pngResult.outputPaths.length, 1);
  assert.ok(existsSync(pngResult.outputPaths[0]));
  assert.equal(existsSync(resolve(pngOutputDir, 'report.json')), false);
  const runtimeArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.deepEqual(runtimeArtifacts.slides.map((slide) => slide.id), ['intro']);
});

test('rendered contract checks fail when a copied framework canvas breaks the stage contract', async (t) => {
  const [
    { createProjectScaffold },
    { runDeckCheck },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../check-service.mjs'),
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

  const checkDir = resolve(projectRoot, '.artifacts', 'check-bad-canvas');
  await assert.rejects(
    () => runDeckCheck({ projectRoot }, { outputDir: checkDir }),
    /canvas|slide-ratio|4 \/ 3|framework\/canvas\/canvas\.css/i
  );
});
