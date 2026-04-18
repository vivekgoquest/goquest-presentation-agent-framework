import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-package-hook-'));
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Package Hook Brief',
      '',
      '## Goal',
      '',
      'Keep the presentation package synchronized after every clean stop.',
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
      '- Deterministic package generation.',
      '- Runtime evidence updates.',
      '',
      '## Constraints',
      '',
      '- none',
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

function gitRevCount(projectRoot) {
  return Number.parseInt(
    execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim(),
    10
  );
}

function runStopHook(projectRoot) {
  return execFileSync('node', ['.claude/hooks/run-presentation-stop-workflow.mjs'], {
    cwd: projectRoot,
    input: JSON.stringify({ cwd: projectRoot }),
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function runStopHookDetailed(projectRoot) {
  return spawnSync('node', ['.claude/hooks/run-presentation-stop-workflow.mjs'], {
    cwd: projectRoot,
    input: JSON.stringify({ cwd: projectRoot }),
    encoding: 'utf8',
  });
}

function runFinalizeCliDetailed(projectRoot) {
  return spawnSync('node', ['framework/runtime/finalize-deck.mjs', '--project', projectRoot], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function runExportCliDetailed(projectRoot, ...extraArgs) {
  return spawnSync('node', ['framework/runtime/export-pdf.mjs', '--project', projectRoot, ...extraArgs], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function runCheckCliDetailed(projectRoot, ...extraArgs) {
  return spawnSync('node', ['framework/runtime/check-deck.mjs', '--project', projectRoot, ...extraArgs], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

function parseTrailingCliJson(stdout) {
  const match = String(stdout || '').match(/(\{[\s\S]*"status"[\s\S]*\})\s*$/);
  if (!match) {
    throw new Error(`Could not find JSON output in:\n${stdout}`);
  }
  return JSON.parse(match[1]);
}

function getProjectPdfRel(projectRoot) {
  const metadata = readJson(resolve(projectRoot, '.presentation', 'project.json'));
  return `${metadata.projectSlug}.pdf`;
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

function installResolvableFrameworkPackage(workspaceRoot) {
  const packageRoot = resolve(workspaceRoot, 'node_modules', 'pitch-framework');
  mkdirSync(resolve(packageRoot, 'framework', 'runtime'), { recursive: true });
  mkdirSync(resolve(packageRoot, 'framework', 'application'), { recursive: true });
  writeFileSync(
    resolve(packageRoot, 'package.json'),
    `${JSON.stringify({
      name: 'pitch-framework',
      type: 'module',
      exports: {
        './presentation-cli': './framework/runtime/presentation-cli.mjs',
      },
    }, null, 2)}\n`
  );
  writeFileSync(
    resolve(packageRoot, 'framework', 'runtime', 'presentation-cli.mjs'),
    `export { runPresentationCli } from ${JSON.stringify(pathToFileURL(resolve(process.cwd(), 'framework', 'runtime', 'presentation-cli.mjs')).href)};\n`
  );
  writeFileSync(
    resolve(packageRoot, 'framework', 'application', 'project-hook-service.mjs'),
    `export * from ${JSON.stringify(pathToFileURL(resolve(process.cwd(), 'framework', 'application', 'project-hook-service.mjs')).href)};\n`
  );
}

test('export CLI writes the canonical root pdf and simplified runtime evidence', async (t) => {
  const { createProjectScaffold } = await import('../project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);
  seedLegacyFinalizedAliases(projectRoot);

  const rootPdfRel = getProjectPdfRel(projectRoot);
  const exportResult = runExportCliDetailed(projectRoot);
  assert.equal(exportResult.status, 0, exportResult.stderr);

  const json = parseTrailingCliJson(exportResult.stdout);
  const artifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));

  assert.deepEqual(json.outputs.artifacts, [rootPdfRel]);
  assert.equal(artifacts.finalized.exists, true);
  assert.equal(artifacts.finalized.pdf.path, rootPdfRel);
  assert.ok(!('outputDir' in artifacts.finalized) || artifacts.finalized.outputDir === '');
  assert.equal(artifacts.latestExport.exists, true);
  assert.equal(artifacts.latestExport.format, 'pdf');
  assert.equal(artifacts.latestExport.pdf.path, rootPdfRel);
  assert.deepEqual(artifacts.latestExport.artifacts.map((artifact) => artifact.path), [rootPdfRel]);
  assert.equal(artifacts.report, null);
  assert.equal(artifacts.summary, null);
  assert.equal(artifacts.fullPage, null);
  assert.deepEqual(artifacts.slides, []);
  assert.equal(existsSync(resolve(projectRoot, rootPdfRel)), true);
  assert.equal(readFileSync(resolve(projectRoot, rootPdfRel)).subarray(0, 4).toString(), '%PDF');
});

test('presentation CLI rejects slide-filtered canonical pdf exports instead of finalizing a partial pdf', async (t) => {
  const { createProjectScaffold } = await import('../project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const result = spawnSync(
    'node',
    [
      'framework/runtime/presentation-cli.mjs',
      'export',
      'pdf',
      '--project',
      projectRoot,
      '--slide',
      'close',
      '--format',
      'json',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 3, result.stderr);
  const json = parseTrailingCliJson(result.stdout);
  const artifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));

  assert.equal(json.status, 'invalid-request');
  assert.match(json.summary, /Slide-filtered PDF exports require --output-dir or --output-file/i);
  assert.equal(existsSync(resolve(projectRoot, getProjectPdfRel(projectRoot))), false);
  assert.equal(artifacts.finalized.exists, false);
  assert.equal(artifacts.latestExport.exists, false);
});

test('finalize writes the canonical root pdf and resets runtime evidence to the v1 delivery shape', async (t) => {
  const [
    { createProjectScaffold },
    { exportPresentation },
  ] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../../runtime/services/presentation-ops-service.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  await exportPresentation(
    { projectRoot },
    {
      format: 'png',
      slideIds: ['intro'],
      outputDir: resolve(projectRoot, 'outputs', 'exports', 'review-pass'),
    }
  );

  const finalizeResult = runFinalizeCliDetailed(projectRoot);
  assert.equal(finalizeResult.status, 0, finalizeResult.stderr);

  const rootPdfRel = getProjectPdfRel(projectRoot);
  const json = parseTrailingCliJson(finalizeResult.stdout);
  assert.equal(json.status, 'pass');
  assert.deepEqual(json.outputs.artifacts, [rootPdfRel]);
  assert.equal(existsSync(resolve(projectRoot, rootPdfRel)), true);
  assert.equal(existsSync(resolve(projectRoot, 'outputs', 'finalized', 'deck.pdf')), false);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'last-good.json')), false);

  const artifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  const renderState = readJson(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json'));

  assert.equal(artifacts.finalized.exists, true);
  assert.equal(artifacts.finalized.pdf.path, rootPdfRel);
  assert.equal(artifacts.latestExport.exists, true);
  assert.equal(artifacts.latestExport.format, 'pdf');
  assert.equal(artifacts.latestExport.pdf.path, rootPdfRel);
  assert.deepEqual(artifacts.latestExport.artifacts.map((artifact) => artifact.path), [rootPdfRel]);
  assert.ok(renderState.sourceFingerprint);
  assert.equal(renderState.sourceFingerprint, artifacts.sourceFingerprint);
  assert.equal(renderState.producer, 'finalize');
});

test('png exports leave the root-pdf runtime evidence untouched after finalize', async (t) => {
  const [
    { createProjectScaffold },
    { exportPresentation },
  ] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../../runtime/services/presentation-ops-service.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const finalizeResult = runFinalizeCliDetailed(projectRoot);
  assert.equal(finalizeResult.status, 0, finalizeResult.stderr);

  await exportPresentation(
    { projectRoot },
    {
      format: 'png',
      slideIds: ['intro'],
      outputDir: resolve(projectRoot, 'outputs', 'exports', 'post-finalize-review'),
    }
  );

  const rootPdfRel = getProjectPdfRel(projectRoot);
  const artifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(artifacts.finalized.exists, true);
  assert.equal(artifacts.finalized.pdf.path, rootPdfRel);
  assert.equal(artifacts.latestExport.exists, true);
  assert.equal(artifacts.latestExport.format, 'pdf');
  assert.equal(artifacts.latestExport.pdf.path, rootPdfRel);
  assert.deepEqual(artifacts.latestExport.artifacts.map((artifact) => artifact.path), [rootPdfRel]);
});

test('presentation action adapter finalizes through the protected core facade', async () => {
  const { createPresentationActionAdapter } = await import('../presentation-action-adapter.mjs');

  const coreCalls = [];
  const adapter = createPresentationActionAdapter({
    core: {
      async finalize(projectRoot, options = {}) {
        coreCalls.push(['finalize', projectRoot, options]);
        return {
          kind: 'presentation-finalize',
          projectRoot,
          status: 'pass',
          outputs: {
            outputDir: '',
            pdf: 'presentation-core-seam.pdf',
            artifacts: ['presentation-core-seam.pdf'],
          },
          issues: [],
        };
      },
    },
  });

  const result = await adapter.invoke('export_presentation', {
    target: {
      kind: 'project',
      projectRootAbs: '/tmp/presentation-core-seam',
    },
  });

  assert.equal(result.status, 'pass');
  assert.equal(result.message, 'Presentation finalize completed.');
  assert.equal(result.outputs.outputDir, '');
  assert.equal(result.outputs.pdf, 'presentation-core-seam.pdf');
  assert.match(result.detail, /presentation-core-seam\.pdf$/);
  assert.deepEqual(coreCalls, [[
    'finalize',
    '/tmp/presentation-core-seam',
    { target: 'run' },
  ]]);
});

test('presentation action adapter validates through the protected core facade', async () => {
  const { createPresentationActionAdapter } = await import('../presentation-action-adapter.mjs');

  const coreCalls = [];
  const adapter = createPresentationActionAdapter({
    core: {
      async validatePresentation(projectRoot, options = {}) {
        coreCalls.push(['validatePresentation', projectRoot, options]);
        return {
          kind: 'presentation-validation',
          projectRoot,
          status: 'fail',
          outputDir: '/tmp/presentation-core-seam-check',
          slideCount: 2,
          consoleErrors: 0,
          overflowSlides: [],
          failures: ['Inline style violation'],
          evidenceUpdated: ['.presentation/runtime/render-state.json'],
        };
      },
    },
  });

  const result = await adapter.invoke('validate_presentation', {
    target: {
      kind: 'project',
      projectRootAbs: '/tmp/presentation-core-seam',
    },
    args: {
      options: {
        strict: true,
      },
    },
    outputPaths: {
      outputDirAbs: '/tmp/presentation-core-seam-check',
    },
  });

  assert.equal(result.status, 'fail');
  assert.equal(result.message, 'Presentation validation found issues.');
  assert.equal(result.detail, 'Inline style violation');
  assert.deepEqual(coreCalls, [[
    'validatePresentation',
    '/tmp/presentation-core-seam',
    {
      strict: true,
      outputDir: '/tmp/presentation-core-seam-check',
    },
  ]]);
});

test('presentation action adapter captures screenshots through the protected core facade', async () => {
  const { createPresentationActionAdapter } = await import('../presentation-action-adapter.mjs');

  const coreCalls = [];
  const adapter = createPresentationActionAdapter({
    core: {
      async capturePresentation(projectRoot, options = {}) {
        coreCalls.push(['capturePresentation', projectRoot, options]);
        return {
          kind: 'presentation-capture',
          projectRoot,
          status: 'fail',
          outputDir: '/tmp/presentation-core-seam-capture',
          slideCount: 1,
          consoleErrors: ['Console exploded'],
          overflowSlides: ['intro'],
          issues: [],
          slides: [],
        };
      },
    },
  });

  const result = await adapter.invoke('capture_screenshots', {
    target: {
      kind: 'project',
      projectRootAbs: '/tmp/presentation-core-seam',
    },
    args: {
      options: {
        captureFullPage: false,
      },
    },
    outputPaths: {
      outputDirAbs: '/tmp/presentation-core-seam-capture',
    },
  });

  assert.equal(result.status, 'fail');
  assert.equal(result.message, 'Screenshot capture found issues.');
  assert.deepEqual(coreCalls, [[
    'capturePresentation',
    '/tmp/presentation-core-seam',
    {
      outputDir: '/tmp/presentation-core-seam-capture',
      captureFullPage: false,
    },
  ]]);
});

test('legacy finalize action delegates to the new finalize semantics', async (t) => {
  const [{ createProjectScaffold }, { createPresentationActionAdapter }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../presentation-action-adapter.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const adapter = createPresentationActionAdapter();
  const result = await adapter.invoke('export_presentation', {
    target: {
      kind: 'project',
      projectRootAbs: projectRoot,
    },
  });

  const rootPdfRel = getProjectPdfRel(projectRoot);
  assert.equal(result.status, 'pass');
  assert.equal(result.message, 'Presentation finalize completed.');
  assert.equal(result.outputs.outputDir, '');
  assert.equal(result.outputs.pdf, rootPdfRel);
  assert.match(result.detail, new RegExp(`${rootPdfRel.replace('.', '\\.')}$`));
});

test('legacy check entrypoint delegates to audit-compatible behavior', async (t) => {
  const { createProjectScaffold } = await import('../project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);
  writeFileSync(
    resolve(projectRoot, 'theme.css'),
    [
      '@layer theme {',
      '  :root {',
      '    --slide-max-w: 960px;',
      '  }',
      '}',
      '',
    ].join('\n')
  );

  const result = runCheckCliDetailed(projectRoot);

  assert.equal(result.status, 1);
  const json = parseTrailingCliJson(result.stdout);
  assert.equal(json.command, `presentation audit all --project ${projectRoot} --format json`);
  assert.equal(json.status, 'fail');
  assert.equal(json.family, 'all');
  assert.ok(json.issues.length > 0);
});

test('presentation stop hook regenerates package state and checkpoints a clean project', async (t) => {
  const { createProjectScaffold } = await import('../project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);
  installResolvableFrameworkPackage(projectRoot);

  const settings = JSON.parse(readFileSync(resolve(projectRoot, '.claude', 'settings.json'), 'utf8'));
  assert.match(settings.hooks.Stop[0].hooks[0].command, /run-presentation-stop-workflow/);

  const proofDir = resolve(projectRoot, 'slides', '030-proof');
  mkdirSync(proofDir, { recursive: true });
  const introHtml = readFileSync(resolve(projectRoot, 'slides', '010-intro', 'slide.html'), 'utf8');
  writeFileSync(resolve(proofDir, 'slide.html'), introHtml.replace(/Intro/gi, 'Proof'));
  unlinkSync(resolve(projectRoot, '.presentation', 'package.generated.json'));

  const commitsBefore = gitRevCount(projectRoot);
  runStopHook(projectRoot);

  const manifest = readJson(resolve(projectRoot, '.presentation', 'package.generated.json'));
  assert.deepEqual(manifest.slides.map((slide) => slide.id), ['intro', 'close', 'proof']);

  const renderState = readJson(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json'));
  assert.equal(renderState.status, 'pass');
  assert.deepEqual(renderState.slideIds, ['intro', 'close', 'proof']);

  const commitsAfter = gitRevCount(projectRoot);
  assert.equal(commitsAfter, commitsBefore + 1);
});

test('presentation stop hook blocks invalid intent references and skips git checkpointing', async (t) => {
  const { createProjectScaffold } = await import('../project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);
  installResolvableFrameworkPackage(projectRoot);

  writeFileSync(
    resolve(projectRoot, '.presentation', 'intent.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      presentationTitle: 'Broken Intent',
      audience: '',
      objective: '',
      tone: '',
      targetSlideCount: 2,
      narrativeNotes: '',
      slideIntent: {
        ghost: {
          purpose: 'This slide does not exist',
          status: 'draft',
        },
      },
    }, null, 2)}\n`
  );

  const commitsBefore = gitRevCount(projectRoot);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')), true);

  assert.throws(
    () => runStopHook(projectRoot),
    /ghost|slideIntent|intent/i
  );

  const commitsAfter = gitRevCount(projectRoot);
  assert.equal(commitsAfter, commitsBefore);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')), true);
});

test('presentation stop hook preserves canonical artifacts after a clean run', async (t) => {
  const { createProjectScaffold } = await import('../project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);
  installResolvableFrameworkPackage(projectRoot);

  execFileSync('node', ['.presentation/framework-cli.mjs', 'finalize'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  const artifactsBefore = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  runStopHook(projectRoot);
  const artifactsAfter = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));

  assert.deepEqual(artifactsAfter, artifactsBefore);
  assert.equal(existsSync(resolve(projectRoot, artifactsAfter.finalized.pdf.path)), true);
});

test('presentation stop hook returns structured failure output for deck policy errors', async (t) => {
  const { createProjectScaffold } = await import('../project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  installResolvableFrameworkPackage(projectRoot);

  const hookResult = runStopHookDetailed(projectRoot);

  assert.equal(hookResult.status, 2);
  assert.match(hookResult.stderr, /Deck policy violation|brief\.md|TODO/i);
  assert.doesNotMatch(hookResult.stderr, /at runPresentationStopHook|node:internal|file:\/\//i);
});
