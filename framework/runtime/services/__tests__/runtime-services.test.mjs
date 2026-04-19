import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { getProjectClaudeScaffoldPackage } from '../../../shared/project-claude-scaffold-package.mjs';

const runtimeClaudeScaffoldPackage = getProjectClaudeScaffoldPackage({ frameworkRoot: process.cwd() });
const runtimeClaudeScaffoldSmokePaths = [
  '.claude/settings.json',
  '.claude/hooks/run-presentation-stop-workflow.mjs',
  '.claude/rules/framework.md',
  '.claude/skills/new-deck/SKILL.md',
];

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-native-host-'));
}

function assertProjectClaudeScaffold(projectRoot, createdFiles = []) {
  for (const requiredPath of runtimeClaudeScaffoldSmokePaths) {
    assert.equal(existsSync(resolve(projectRoot, requiredPath)), true, `missing required scaffold smoke path: ${requiredPath}`);
    assert.ok(createdFiles.includes(requiredPath), `missing created scaffold smoke file entry: ${requiredPath}`);
  }

  for (const requiredPath of runtimeClaudeScaffoldPackage.requiredPaths) {
    assert.equal(existsSync(resolve(projectRoot, requiredPath)), true, `missing required scaffold path: ${requiredPath}`);
  }

  for (const entry of runtimeClaudeScaffoldPackage.entries) {
    assert.ok(createdFiles.includes(entry.targetRel), `missing created scaffold file entry: ${entry.targetRel}`);
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toProjectRelativePath(projectRoot, absPath) {
  return relative(projectRoot, absPath).split('\\').join('/');
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

function seedLegacyFinalizedAliases(projectRoot) {
  const finalizedDir = resolve(projectRoot, 'outputs', 'finalized');
  mkdirSync(resolve(finalizedDir, 'slides'), { recursive: true });
  writeFileSync(resolve(finalizedDir, 'deck.pdf'), '%PDF-legacy\n');
  writeFileSync(resolve(finalizedDir, 'report.json'), '{}\n');
  writeFileSync(resolve(finalizedDir, 'summary.md'), '# Legacy summary\n');
  writeFileSync(resolve(finalizedDir, 'full-page.png'), 'legacy-full-page\n');
  writeFileSync(resolve(finalizedDir, 'slides', 'slide-intro.png'), 'legacy-slide\n');

  writeFileSync(
    resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      kind: 'artifacts',
      sourceFingerprint: 'sha256:legacy',
      generatedAt: '2026-01-01T00:00:00.000Z',
      finalized: {
        exists: true,
        pdf: { path: 'outputs/finalized/deck.pdf' },
      },
      latestExport: {
        exists: true,
        format: 'pdf',
        pdf: { path: 'outputs/finalized/deck.pdf' },
        artifacts: [{ path: 'outputs/finalized/deck.pdf' }],
      },
      outputDir: 'outputs/finalized',
      pdf: { path: 'outputs/finalized/deck.pdf' },
      report: { path: 'outputs/finalized/report.json' },
      summary: { path: 'outputs/finalized/summary.md' },
      fullPage: { path: 'outputs/finalized/full-page.png' },
      slides: [{ path: 'outputs/finalized/slides/slide-intro.png' }],
    }, null, 2)}\n`
  );
}

test('runtime scaffold service does not import project-agent code modules directly', () => {
  const source = readFileSync(resolve(import.meta.dirname, '..', 'scaffold-service.mjs'), 'utf8');
  assert.doesNotMatch(source, /from\s+['"][^'"]*project-agent\/scaffold-package\.mjs['"]/);
});

test('runtime scaffold service creates the full shell-less project scaffold', async (t) => {
  const { createPresentationScaffold } = await import('../scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const result = createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });

  assert.equal(result.status, 'created');
  assert.ok(result.files.includes('.presentation/project.json'));
  assert.ok(result.files.includes('.presentation/framework-cli.mjs'));
  assert.ok(result.files.includes('.claude/settings.json'));
  assert.ok(result.files.includes('.claude/AGENTS.md'));
  assert.ok(result.files.includes('.claude/CLAUDE.md'));
  assert.deepEqual(result.git.path, '.git');
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework-cli.mjs')), true);
  assertProjectClaudeScaffold(projectRoot, result.files);
  assert.equal(existsSync(resolve(projectRoot, '.git')), true);
});

test('runtime scaffold creates the shell-less v1 layout for a 3-slide project', async (t) => {
  const [
    { createPresentationScaffold },
    { getProjectAgentScaffoldPackage },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../../../../project-agent/scaffold-package.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const result = await createPresentationScaffold({ projectRoot }, { slideCount: 3 });

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
  const { createPresentationScaffold } = await import('../scaffold-service.mjs');
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'external-project');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 3 });

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
  const { createPresentationScaffold } = await import('../scaffold-service.mjs');
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'external-project');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 3 });
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
  const { createPresentationScaffold } = await import('../scaffold-service.mjs');
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'external-project');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 3 });
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

test('project shim keeps preview serve alive until terminated when pitch-framework is resolvable', async (t) => {
  const { createPresentationScaffold } = await import('../scaffold-service.mjs');
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'external-project');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2 });
  installResolvableFrameworkPackage(workspaceRoot);

  const shimPath = resolve(projectRoot, '.presentation', 'framework-cli.mjs');
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, [shimPath, 'preview', 'serve'], {
    cwd: projectRoot,
    encoding: 'utf8',
    timeout: 1200,
  });
  const elapsedMs = Date.now() - startedAt;

  assert.ok(elapsedMs >= 1000, `preview serve exited too quickly (${elapsedMs}ms)`);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Preview server started\./);
  assert.match(result.stdout, /previewUrl:/);
});

test('runtime scaffold rejects unsupported long-deck v1 projects before writing files', async (t) => {
  const { createPresentationScaffold } = await import('../scaffold-service.mjs');
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'unsupported-long-deck');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  assert.throws(
    () => createPresentationScaffold({ projectRoot }, { slideCount: 11 }),
    /supports 1 to 10 slides|supports 1-10 slides|long-deck/i
  );
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), false);
  assert.equal(existsSync(resolve(projectRoot, 'outline.md')), false);
});

test('runtime services operate on a real scaffolded project', async (t) => {
  const [
    { createPresentationScaffold },
    { capturePresentation },
    { validatePresentation },
    { exportDeckPdf },
    { finalizePresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const captureDir = resolve(projectRoot, '.artifacts', 'capture');
  const capture = await capturePresentation({ projectRoot }, captureDir);
  assert.ok(capture.slideCount >= 1);
  assert.ok(existsSync(resolve(captureDir, 'report.json')));
  const initialArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(initialArtifacts.kind, 'artifacts');
  assert.equal(initialArtifacts.finalized.exists, false);
  assert.equal(initialArtifacts.latestExport.exists, false);
  assert.equal(initialArtifacts.latestExport.format, 'pdf');

  const checkDir = resolve(projectRoot, '.artifacts', 'check');
  const check = await validatePresentation({ projectRoot }, { outputDir: checkDir });
  assert.equal(check.status, 'pass');
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')));
  const renderState = readJson(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json'));
  assert.equal(renderState.status, 'pass');
  assert.deepEqual(renderState.slideIds.sort(), ['close', 'intro']);
  const artifactsAfterCheck = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.deepEqual(artifactsAfterCheck, initialArtifacts);

  const projectMetadata = readJson(resolve(projectRoot, '.presentation', 'project.json'));
  const rootPdfRel = `${projectMetadata.projectSlug}.pdf`;
  const rootPdfAbs = resolve(projectRoot, rootPdfRel);
  const exported = await exportDeckPdf({ projectRoot });
  assert.equal(exported.outputPath, rootPdfAbs);
  assert.ok(existsSync(rootPdfAbs));
  assert.equal(readFileSync(rootPdfAbs).subarray(0, 4).toString(), '%PDF');
  const exportedArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(exportedArtifacts.finalized.exists, true);
  assert.equal(exportedArtifacts.finalized.pdf.path, rootPdfRel);
  assert.ok(!('outputDir' in exportedArtifacts.finalized) || exportedArtifacts.finalized.outputDir === '');
  assert.equal(exportedArtifacts.latestExport.exists, true);
  assert.equal(exportedArtifacts.latestExport.format, 'pdf');
  assert.equal(exportedArtifacts.latestExport.pdf.path, rootPdfRel);
  assert.deepEqual(exportedArtifacts.latestExport.artifacts.map((artifact) => artifact.path), [rootPdfRel]);

  const finalized = await finalizePresentation({ projectRoot });
  assert.equal(finalized.status, 'pass');
  assert.equal(finalized.outputs.pdf, rootPdfRel);
  assert.deepEqual(finalized.outputs.artifacts, [rootPdfRel]);
  assert.equal(existsSync(resolve(projectRoot, 'outputs', 'finalized', 'deck.pdf')), false);
  assert.equal(existsSync(resolve(projectRoot, 'outputs', 'finalized', 'report.json')), false);
  assert.equal(existsSync(resolve(projectRoot, 'outputs', 'finalized', 'summary.md')), false);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'last-good.json')), false);
  const finalizedArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(finalizedArtifacts.finalized.exists, true);
  assert.equal(finalizedArtifacts.finalized.pdf.path, rootPdfRel);
  assert.ok(!('outputDir' in finalizedArtifacts.finalized) || finalizedArtifacts.finalized.outputDir === '');
  assert.equal(finalizedArtifacts.latestExport.exists, true);
  assert.equal(finalizedArtifacts.latestExport.format, 'pdf');
  assert.equal(finalizedArtifacts.latestExport.pdf.path, rootPdfRel);
  assert.deepEqual(finalizedArtifacts.latestExport.artifacts.map((artifact) => artifact.path), [rootPdfRel]);
});

test('assembled deck keeps export in Electron and out of the deck html', async (t) => {
  const [
    { createPresentationScaffold },
    { renderPresentationHtml },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../../deck-assemble.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const rendered = renderPresentationHtml({ projectRoot });
  assert.doesNotMatch(rendered.html, /runtime-export-bar/);
  assert.doesNotMatch(rendered.html, /data-export-pdf/);
  assert.doesNotMatch(rendered.html, /client\/export\.js/);
  assert.match(rendered.html, /runtime\/runtime-chrome\.css/);
});

test('runtime export service can export selected slides to one pdf or individual pngs', async (t) => {
  const [
    { createPresentationScaffold },
    { exportPresentation },
    { PDFDocument },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('pdf-lib'),
  ]);

  const projectRoot = createTempProjectRoot();
  const pdfOutputDir = resolve(projectRoot, '.artifacts', 'selected-pdf');
  const pngOutputDir = resolve(projectRoot, '.artifacts', 'selected-png');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
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
  assert.equal(runtimeArtifacts.latestExport.format, 'pdf');
  assert.equal(runtimeArtifacts.latestExport.pdf.path, toProjectRelativePath(projectRoot, pdfResult.outputPath));
  assert.deepEqual(runtimeArtifacts.latestExport.artifacts.map((artifact) => artifact.path), [toProjectRelativePath(projectRoot, pdfResult.outputPath)]);
  assert.equal(runtimeArtifacts.finalized.exists, false);
});

test('runtime export service rejects slide-filtered canonical pdf requests instead of finalizing partial output', async (t) => {
  const [
    { createPresentationScaffold },
    { exportPresentation, finalizePresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  await assert.rejects(
    () => exportPresentation({ projectRoot }, { format: 'pdf', slideIds: ['close'] }),
    /Slide-filtered PDF exports require --output-dir or --output-file/i
  );
  await assert.rejects(
    () => finalizePresentation({ projectRoot }, { slideIds: ['close'] }),
    /Finalize only supports the full deck/i
  );

  const runtimeArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(runtimeArtifacts.finalized.exists, false);
  assert.equal(runtimeArtifacts.latestExport.exists, false);
  assert.equal(existsSync(resolve(projectRoot, `${projectRoot.split('/').at(-1)}.pdf`)), false);
});

test('explicit canonical pdf destinations keep finalize capture semantics instead of taking the manual export path', async (t) => {
  const [
    { createPresentationScaffold },
    { exportPresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  for (const request of [
    (projectRoot, rootPdfRel) => ({ outputFile: rootPdfRel }),
    (projectRoot) => ({ outputDir: projectRoot }),
  ]) {
    const projectRoot = createTempProjectRoot();
    t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

    await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
    fillBrief(projectRoot);

    const projectMetadata = readJson(resolve(projectRoot, '.presentation', 'project.json'));
    const rootPdfRel = `${projectMetadata.projectSlug}.pdf`;

    for (const slideDir of ['010-intro', '020-close']) {
      writeFileSync(
        resolve(projectRoot, 'slides', slideDir, 'slide.html'),
        `<div class="slide"><h2>${slideDir}</h2><script>console.error('explicit canonical finalize ${slideDir}')</script></div>`
      );
    }

    const result = await exportPresentation(
      { projectRoot },
      {
        format: 'pdf',
        slideIds: ['intro', 'close'],
        selectionMode: 'full-deck',
        ...request(projectRoot, rootPdfRel),
      }
    );
    const runtimeArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
    const renderState = readJson(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json'));

    assert.equal(result.status, 'fail');
    assert.equal(result.outputPath, resolve(projectRoot, rootPdfRel));
    assert.match(result.issues.join('\n'), /Browser console errors were detected/i);
    assert.equal(runtimeArtifacts.finalized.exists, false);
    assert.equal(runtimeArtifacts.latestExport.exists, true);
    assert.equal(runtimeArtifacts.latestExport.pdf.path, rootPdfRel);
    assert.equal(renderState.producer, 'finalize');
    assert.equal(renderState.status, 'fail');
  }
});

test('root pdf exports clear stale legacy aliases after the root-pdf rewrite', async (t) => {
  const [
    { createPresentationScaffold },
    { exportDeckPdf },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);
  seedLegacyFinalizedAliases(projectRoot);

  const exported = await exportDeckPdf({ projectRoot });
  const runtimeArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));

  assert.ok(existsSync(exported.outputPath));
  assert.equal(runtimeArtifacts.pdf.path, toProjectRelativePath(projectRoot, exported.outputPath));
  assert.equal(runtimeArtifacts.report, null);
  assert.equal(runtimeArtifacts.summary, null);
  assert.equal(runtimeArtifacts.fullPage, null);
  assert.deepEqual(runtimeArtifacts.slides, []);
});

test('soft-failed canonical pdf export does not resurrect deleted legacy finalized aliases', async (t) => {
  const [
    { createPresentationScaffold },
    { exportPresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);
  seedLegacyFinalizedAliases(projectRoot);

  for (const slideDir of ['010-intro', '020-close']) {
    writeFileSync(
      resolve(projectRoot, 'slides', slideDir, 'slide.html'),
      `<div class="slide"><h2>${slideDir}</h2><script>console.error('soft-fail ${slideDir}')</script></div>`
    );
  }

  const result = await exportPresentation(
    { projectRoot },
    { format: 'pdf', slideIds: ['intro', 'close'], selectionMode: 'full-deck' }
  );
  const runtimeArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  const rootPdfRel = toProjectRelativePath(projectRoot, result.outputPath);

  assert.equal(result.status, 'fail');
  assert.equal(existsSync(resolve(projectRoot, rootPdfRel)), true);
  assert.deepEqual(result.outputPaths.map((outputPath) => toProjectRelativePath(projectRoot, outputPath)), [rootPdfRel]);
  assert.match(result.issues.join('\n'), /Browser console errors were detected/i);
  assert.equal(existsSync(resolve(projectRoot, 'outputs', 'finalized', 'deck.pdf')), false);
  assert.equal(runtimeArtifacts.finalized.exists, false);
  assert.equal(runtimeArtifacts.finalized.pdf, null);
  assert.equal(runtimeArtifacts.latestExport.exists, true);
  assert.equal(runtimeArtifacts.latestExport.pdf.path, rootPdfRel);
  assert.deepEqual(runtimeArtifacts.latestExport.artifacts.map((artifact) => artifact.path), [rootPdfRel]);
  assert.equal(runtimeArtifacts.outputDir, '');
  assert.equal(runtimeArtifacts.pdf.path, rootPdfRel);
  assert.equal(runtimeArtifacts.report, null);
  assert.equal(runtimeArtifacts.summary, null);
  assert.equal(runtimeArtifacts.fullPage, null);
  assert.deepEqual(runtimeArtifacts.slides, []);
});

test('soft-failed full-deck canonical refresh clears prior finalized evidence while keeping the new root pdf as latest export', async (t) => {
  const [
    { createPresentationScaffold },
    { exportPresentation, finalizePresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const initialFinalize = await finalizePresentation({ projectRoot });
  assert.equal(initialFinalize.status, 'pass');

  for (const slideDir of ['010-intro', '020-close']) {
    writeFileSync(
      resolve(projectRoot, 'slides', slideDir, 'slide.html'),
      `<div class="slide"><h2>${slideDir}</h2><script>console.error('soft-fail refresh ${slideDir}')</script></div>`
    );
  }

  const result = await exportPresentation(
    { projectRoot },
    { format: 'pdf', slideIds: ['intro', 'close'], selectionMode: 'full-deck' }
  );
  const runtimeArtifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  const rootPdfRel = toProjectRelativePath(projectRoot, result.outputPath);

  assert.equal(result.status, 'fail');
  assert.equal(existsSync(resolve(projectRoot, rootPdfRel)), true);
  assert.deepEqual(result.outputPaths.map((outputPath) => toProjectRelativePath(projectRoot, outputPath)), [rootPdfRel]);
  assert.match(result.issues.join('\n'), /Browser console errors were detected/i);
  assert.equal(runtimeArtifacts.finalized.exists, false);
  assert.equal(runtimeArtifacts.finalized.pdf, null);
  assert.equal(runtimeArtifacts.latestExport.exists, true);
  assert.equal(runtimeArtifacts.latestExport.format, 'pdf');
  assert.equal(runtimeArtifacts.latestExport.pdf.path, rootPdfRel);
  assert.deepEqual(runtimeArtifacts.latestExport.artifacts.map((artifact) => artifact.path), [rootPdfRel]);
  assert.equal(runtimeArtifacts.outputDir, '');
  assert.equal(runtimeArtifacts.pdf.path, rootPdfRel);
});

test('non-canonical pdf exports preserve the prior finalized fingerprint while recording the new latest export', async (t) => {
  const [
    { createPresentationScaffold },
    { exportPresentation, finalizePresentation },
    { computeSourceFingerprint },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../../source-fingerprint.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  const slideHtmlPath = resolve(projectRoot, 'slides', '010-intro', 'slide.html');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const initialFinalize = await finalizePresentation({ projectRoot });
  assert.equal(initialFinalize.status, 'pass');

  const artifactsBeforeExport = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  const originalSlideHtml = readFileSync(slideHtmlPath, 'utf8');
  writeFileSync(slideHtmlPath, `${originalSlideHtml}\n<!-- stale after finalize -->\n`);

  const currentSourceFingerprint = computeSourceFingerprint(projectRoot);
  const exported = await exportPresentation(
    { projectRoot },
    {
      format: 'pdf',
      slideIds: ['intro', 'close'],
      selectionMode: 'full-deck',
      outputDir: resolve(projectRoot, 'outputs', 'exports', 'manual'),
      outputFile: 'review-copy.pdf',
    }
  );
  const artifactsAfterExport = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));

  assert.equal(exported.status, 'pass');
  assert.equal(artifactsAfterExport.finalized.exists, true);
  assert.equal(artifactsAfterExport.finalized.pdf.path, artifactsBeforeExport.finalized.pdf.path);
  assert.equal(artifactsAfterExport.sourceFingerprint, artifactsBeforeExport.sourceFingerprint);
  assert.notEqual(artifactsAfterExport.sourceFingerprint, currentSourceFingerprint);
  assert.equal(artifactsAfterExport.latestExport.exists, true);
  assert.equal(artifactsAfterExport.latestExport.pdf.path, 'outputs/exports/manual/review-copy.pdf');
  assert.deepEqual(
    artifactsAfterExport.latestExport.artifacts.map((artifact) => artifact.path),
    ['outputs/exports/manual/review-copy.pdf']
  );
});

test('failed finalize before pdf refresh preserves the prior finalized fingerprint instead of restamping stale finalize evidence', async (t) => {
  const [
    { createPresentationScaffold },
    { finalizePresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: true });
  fillBrief(projectRoot);

  const initialFinalize = await finalizePresentation({ projectRoot });
  assert.equal(initialFinalize.status, 'pass');

  const artifactsBeforeFailure = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  const copiedCanvasCss = resolve(projectRoot, '.presentation', 'framework', 'base', 'canvas', 'canvas.css');
  const originalCanvasCss = readFileSync(copiedCanvasCss, 'utf8');
  writeFileSync(
    copiedCanvasCss,
    originalCanvasCss.replace('--slide-ratio: 16 / 9;', '--slide-ratio: 4 / 3;')
  );

  const failedFinalize = await finalizePresentation({ projectRoot });
  assert.equal(failedFinalize.status, 'fail');

  const artifactsAfterFailure = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  const renderStateAfterFailure = readJson(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json'));

  assert.equal(artifactsAfterFailure.finalized.exists, true);
  assert.equal(artifactsAfterFailure.finalized.pdf.path, artifactsBeforeFailure.finalized.pdf.path);
  assert.equal(artifactsAfterFailure.sourceFingerprint, artifactsBeforeFailure.sourceFingerprint);
  assert.notEqual(renderStateAfterFailure.sourceFingerprint, artifactsAfterFailure.sourceFingerprint);
  assert.equal(renderStateAfterFailure.status, 'fail');
});

test('validatePresentation ignores deck-quality heuristics and keeps canonical artifacts unchanged', async (t) => {
  const [
    { createPresentationScaffold },
    { validatePresentation },
    { finalizePresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 5, copyFramework: false });
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
    { createPresentationScaffold },
    { validatePresentation },
    { finalizePresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
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
    { createPresentationScaffold },
    { validatePresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../presentation-ops-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: true });
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
