import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-native-host-'));
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function installResolvableFrameworkPackage(workspaceRoot) {
  const packageRoot = resolve(workspaceRoot, 'node_modules', 'pitch-framework');
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(
    resolve(packageRoot, 'package.json'),
    `${JSON.stringify({
      name: 'pitch-framework',
      type: 'module',
      exports: {
        './presentation-cli': './presentation-cli.mjs',
      },
    }, null, 2)}\n`
  );
  writeFileSync(
    resolve(packageRoot, 'presentation-cli.mjs'),
    `export { runPresentationCli } from ${JSON.stringify(pathToFileURL(resolve(process.cwd(), 'framework', 'runtime', 'presentation-cli.mjs')).href)};\n`
  );
}

function installIncompatibleFrameworkPackage(workspaceRoot) {
  const packageRoot = resolve(workspaceRoot, 'node_modules', 'pitch-framework');
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(
    resolve(packageRoot, 'package.json'),
    `${JSON.stringify({
      name: 'pitch-framework',
      type: 'module',
      exports: {
        './package.json': './package.json',
      },
    }, null, 2)}\n`
  );
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

function createQualityWarningSlideHtml(title) {
  return [
    '<div class="slide">',
    '  <div class="eyebrow">Quality Warning Deck</div>',
    `  <h2 class="sect-title">${title}</h2>`,
    '  <div class="g2">',
    '    <div class="icard"><p class="body-text">Point one</p></div>',
    '    <div class="icard"><p class="body-text">Point two</p></div>',
    '  </div>',
    '</div>',
    '',
  ].join('\n');
}

function readJson(absPath) {
  return JSON.parse(readFileSync(absPath, 'utf8'));
}

test('application scaffold creates the shell-less v1 layout for a 3-slide project', async (t) => {
  const [
    { createProjectScaffold },
    { getProjectAgentScaffoldPackage },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../../../../project-agent/scaffold-package.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const result = await createProjectScaffold({ projectRoot }, { slideCount: 3 });

  assert.equal(result.status, 'created');
  assert.deepEqual(result.files.filter((file) => file.endsWith('slide.html')).sort(), [
    'slides/010-intro/slide.html',
    'slides/020-slide-02/slide.html',
    'slides/030-close/slide.html',
  ]);
  assert.ok(result.files.includes('.presentation/framework-cli.mjs'));
  assert.ok(result.files.includes('.claude/settings.json'));
  assert.ok(result.files.includes('.claude/AGENTS.md'));
  assert.ok(result.files.includes('.claude/CLAUDE.md'));
  assert.ok(!result.files.includes('outline.md'));
  assert.ok(!result.files.includes('outputs/'));
  assert.equal(existsSync(resolve(projectRoot, '.claude', 'AGENTS.md')), true);
  assert.equal(existsSync(resolve(projectRoot, 'AGENTS.md')), false);

  const scaffoldPackage = getProjectAgentScaffoldPackage({ frameworkRoot: process.cwd() });
  for (const requiredPath of scaffoldPackage.requiredPaths) {
    assert.ok(existsSync(resolve(projectRoot, requiredPath)), `missing required scaffold path: ${requiredPath}`);
  }
});

test('project shim fails with repair guidance when the package is not resolvable from a real temp project outside the repo', async (t) => {
  const { createProjectScaffold } = await import('../../../application/project-scaffold-service.mjs');
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'external-project');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3 });

  const shimPath = resolve(projectRoot, '.presentation', 'framework-cli.mjs');
  const source = readFileSync(shimPath, 'utf8');
  assert.match(source, /pitch-framework\/presentation-cli/);
  assert.match(source, /import\.meta\.resolve\(PRESENTATION_CLI_SPECIFIER\)/);
  assert.match(source, /'--project', projectRoot/);
  assert.doesNotMatch(source, /execFileSync/);
  assert.doesNotMatch(source, /FALLBACK_/);
  assert.doesNotMatch(source, new RegExp(escapeRegExp(process.cwd())));

  const result = spawnSync(process.execPath, [shimPath, 'status', '--format', 'json'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Unable to resolve "pitch-framework\/presentation-cli"/);
  assert.match(result.stderr, /Repair guidance:/);
  assert.match(result.stderr, /install|link/i);
});

test('project shim fails with repair guidance when installed pitch-framework is incompatible with the presentation-cli entrypoint', async (t) => {
  const { createProjectScaffold } = await import('../../../application/project-scaffold-service.mjs');
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'external-project');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3 });
  installIncompatibleFrameworkPackage(workspaceRoot);

  const shimPath = resolve(projectRoot, '.presentation', 'framework-cli.mjs');
  const result = spawnSync(process.execPath, [shimPath, 'status', '--format', 'json'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /pitch-framework\/presentation-cli/);
  assert.match(result.stderr, /incompatible|does not expose/i);
  assert.match(result.stderr, /Repair guidance:/);
  assert.match(result.stderr, /update|upgrade|install|link/i);
});

test('project shim executes when pitch-framework is resolvable through standard package resolution', async (t) => {
  const { createProjectScaffold } = await import('../../../application/project-scaffold-service.mjs');
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'external-project');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3 });
  installResolvableFrameworkPackage(workspaceRoot);

  const shimPath = resolve(projectRoot, '.presentation', 'framework-cli.mjs');
  const result = spawnSync(process.execPath, [shimPath, 'status', '--format', 'json'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'ok');
  assert.equal(realpathSync(json.scope.projectRoot), realpathSync(projectRoot));
});

test('application scaffold rejects unsupported long-deck v1 projects before writing files', async (t) => {
  const { createProjectScaffold } = await import('../../../application/project-scaffold-service.mjs');
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'unsupported-long-deck');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  assert.throws(
    () => createProjectScaffold({ projectRoot }, { slideCount: 11 }),
    /supports 1 to 10 slides|supports 1-10 slides|long-deck/i
  );
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), false);
  assert.equal(existsSync(resolve(projectRoot, 'outline.md')), false);
});

test('runtime services operate on a real scaffolded project', async (t) => {
  const [
    { createProjectScaffold },
    { capturePresentation },
    { validatePresentation },
    { exportDeckPdf },
    { finalizePresentation },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const captureDir = resolve(projectRoot, '.artifacts', 'capture');
  const capture = await capturePresentation({ projectRoot }, captureDir);
  assert.ok(capture.slideCount >= 1);
  assert.ok(existsSync(resolve(captureDir, 'report.json')));
  const initialArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(initialArtifacts.kind, 'artifacts');
  assert.equal(initialArtifacts.finalized.exists, false);
  assert.equal(initialArtifacts.latestExport.exists, false);

  const checkDir = resolve(projectRoot, '.artifacts', 'check');
  const check = await validatePresentation({ projectRoot }, { outputDir: checkDir });
  assert.equal(check.status, 'pass');
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')));
  const renderState = readJson(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json'));
  assert.equal(renderState.status, 'pass');
  assert.deepEqual(renderState.slideIds.sort(), ['close', 'intro']);
  const artifactsAfterCheck = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.deepEqual(artifactsAfterCheck, initialArtifacts);

  const exportPath = resolve(projectRoot, 'outputs', 'service-export.pdf');
  const exported = await exportDeckPdf({ projectRoot }, exportPath);
  assert.equal(exported.outputPath, exportPath);
  assert.ok(existsSync(exportPath));
  assert.equal(readFileSync(exportPath).subarray(0, 4).toString(), '%PDF');
  const exportedArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(exportedArtifacts.latestExport.exists, true);
  assert.equal(exportedArtifacts.latestExport.format, 'pdf');
  assert.equal(exportedArtifacts.latestExport.outputDir, 'outputs');
  assert.equal(exportedArtifacts.latestExport.pdf.path, 'outputs/service-export.pdf');
  assert.equal(exportedArtifacts.finalized.exists, false);

  const finalized = await finalizePresentation({ projectRoot });
  assert.equal(finalized.status, 'pass');
  assert.ok(existsSync(resolve(projectRoot, 'outputs', 'finalized', 'deck.pdf')));
  assert.ok(existsSync(resolve(projectRoot, 'outputs', 'finalized', 'report.json')));
  assert.ok(existsSync(resolve(projectRoot, 'outputs', 'finalized', 'summary.md')));
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'last-good.json')), false);
  const finalizedArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(finalizedArtifacts.finalized.exists, true);
  assert.equal(finalizedArtifacts.finalized.outputDir, 'outputs/finalized');
  assert.equal(finalizedArtifacts.finalized.pdf.path, 'outputs/finalized/deck.pdf');
  assert.equal(finalizedArtifacts.finalized.summary.path, 'outputs/finalized/summary.md');
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
    import('../presentation-ops-service.mjs'),
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
  assert.equal(runtimeArtifacts.latestExport.exists, true);
  assert.equal(runtimeArtifacts.latestExport.format, 'png');
  assert.deepEqual(runtimeArtifacts.latestExport.slides.map((slide) => slide.id), ['intro']);
  assert.equal(runtimeArtifacts.finalized.exists, false);
});

test('validatePresentation ignores deck-quality heuristics and keeps canonical artifacts unchanged', async (t) => {
  const [
    { createProjectScaffold },
    { validatePresentation },
    { finalizePresentation },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 5, copyFramework: false });
  fillBrief(projectRoot);

  for (const slideDir of ['010-intro', '020-slide-02', '030-slide-03', '040-slide-04', '050-close']) {
    writeFileSync(
      resolve(projectRoot, 'slides', slideDir, 'slide.html'),
      createQualityWarningSlideHtml(`Repeated layout ${slideDir}`)
    );
  }

  await finalizePresentation({ projectRoot });
  const artifactsBeforeCheck = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));

  const checkDir = resolve(projectRoot, '.artifacts', 'warning-check');
  const check = await validatePresentation({ projectRoot }, { outputDir: checkDir });

  assert.equal(check.status, 'pass');
  assert.deepEqual(check.failures, []);
  const renderState = readJson(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json'));
  assert.equal(renderState.status, 'pass');
  const artifactsAfterCheck = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.deepEqual(artifactsAfterCheck, artifactsBeforeCheck);
});

test('runtime commands regenerate missing package files for legacy projects', async (t) => {
  const [
    { createProjectScaffold },
    { validatePresentation },
    { finalizePresentation },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  rmSync(resolve(projectRoot, '.presentation', 'intent.json'), { force: true });
  rmSync(resolve(projectRoot, '.presentation', 'package.generated.json'), { force: true });
  rmSync(resolve(projectRoot, '.presentation', 'runtime'), { recursive: true, force: true });

  const checkDir = resolve(projectRoot, '.artifacts', 'legacy-check');
  const check = await validatePresentation({ projectRoot }, { outputDir: checkDir });
  assert.equal(check.status, 'pass');
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'intent.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'package.generated.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')));

  const finalized = await finalizePresentation({ projectRoot });
  assert.equal(finalized.status, 'pass');
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'last-good.json')), false);
});

test('rendered contract checks fail when a copied framework canvas breaks the stage contract', async (t) => {
  const [
    { createProjectScaffold },
    { validatePresentation },
  ] = await Promise.all([
    import('../../../application/project-scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
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
    () => validatePresentation({ projectRoot }, { outputDir: checkDir }),
    /canvas|slide-ratio|4 \/ 3|framework\/canvas\/canvas\.css/i
  );
});
