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

test('export CLI writes ad hoc PDF artifacts under outputs/exports and does not finalize the package', async (t) => {
  const { createProjectScaffold } = await import('../project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const exportResult = runExportCliDetailed(projectRoot);
  assert.equal(exportResult.status, 0, exportResult.stderr);

  const artifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));

  assert.equal(artifacts.finalized.exists, false);
  assert.equal(artifacts.latestExport.exists, true);
  assert.equal(artifacts.latestExport.format, 'pdf');
  assert.match(artifacts.latestExport.outputDir, /^outputs\/exports\//);
  assert.match(artifacts.latestExport.pdf.path, /^outputs\/exports\//);
  assert.equal(existsSync(resolve(projectRoot, artifacts.latestExport.pdf.path)), true);
  assert.equal(readFileSync(resolve(projectRoot, artifacts.latestExport.pdf.path)).subarray(0, 4).toString(), '%PDF');
});

test('finalize keeps finalized outputs canonical and preserves latest export evidence as a separate lane', async (t) => {
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

  const json = parseTrailingCliJson(finalizeResult.stdout);
  assert.equal(json.status, 'pass');
  assert.equal(json.outputs.pdf, 'outputs/finalized/deck.pdf');
  assert.equal(json.outputs.outputDir, 'outputs/finalized');
  assert.equal(existsSync(resolve(projectRoot, 'outputs', 'finalized', 'deck.pdf')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'last-good.json')), false);

  const artifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  const renderState = readJson(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json'));

  assert.equal(artifacts.finalized.exists, true);
  assert.equal(artifacts.finalized.outputDir, 'outputs/finalized');
  assert.equal(artifacts.finalized.pdf.path, 'outputs/finalized/deck.pdf');
  assert.equal(artifacts.latestExport.exists, true);
  assert.equal(artifacts.latestExport.format, 'png');
  assert.equal(artifacts.latestExport.outputDir, 'outputs/exports/review-pass');
  assert.deepEqual(artifacts.latestExport.slides.map((slide) => slide.id), ['intro']);
  assert.ok(renderState.sourceFingerprint);
  assert.equal(renderState.sourceFingerprint, artifacts.sourceFingerprint);
  assert.equal(renderState.producer, 'finalize');
});

test('export refreshes latest export evidence without clearing existing finalized outputs', async (t) => {
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

  const artifacts = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  assert.equal(artifacts.finalized.exists, true);
  assert.equal(artifacts.finalized.outputDir, 'outputs/finalized');
  assert.equal(artifacts.finalized.pdf.path, 'outputs/finalized/deck.pdf');
  assert.equal(artifacts.latestExport.exists, true);
  assert.equal(artifacts.latestExport.format, 'png');
  assert.equal(artifacts.latestExport.outputDir, 'outputs/exports/post-finalize-review');
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

  assert.equal(result.status, 'pass');
  assert.equal(result.message, 'Presentation finalize completed.');
  assert.equal(result.outputs.outputDir, 'outputs/finalized');
  assert.equal(result.outputs.pdf, 'outputs/finalized/deck.pdf');
  assert.match(result.detail, /outputs\/finalized\/deck\.pdf$/);
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

  execFileSync('node', ['.presentation/framework-cli.mjs', 'finalize'], {
    cwd: projectRoot,
    encoding: 'utf8',
  });

  const artifactsBefore = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));
  runStopHook(projectRoot);
  const artifactsAfter = readJson(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'));

  assert.deepEqual(artifactsAfter, artifactsBefore);
  assert.equal(existsSync(resolve(projectRoot, artifactsAfter.fullPage.path)), true);
  assert.equal(existsSync(resolve(projectRoot, artifactsAfter.report.path)), true);
});

test('presentation stop hook returns structured failure output for deck policy errors', async (t) => {
  const { createProjectScaffold } = await import('../project-scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });

  const hookResult = runStopHookDetailed(projectRoot);

  assert.equal(hookResult.status, 2);
  assert.match(hookResult.stderr, /Deck policy violation|brief\.md|TODO/i);
  assert.doesNotMatch(hookResult.stderr, /at runPresentationStopHook|node:internal|file:\/\//i);
});
