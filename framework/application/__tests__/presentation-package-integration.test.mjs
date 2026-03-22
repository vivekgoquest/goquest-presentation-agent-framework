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
