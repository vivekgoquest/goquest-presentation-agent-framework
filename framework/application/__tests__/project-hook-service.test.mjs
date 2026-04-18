import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-project-hook-service-'));
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Hook Workflow Brief',
      '',
      '## Goal',
      '',
      'Validate application-owned hook workflows.',
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
      '- Deterministic package state.',
      '- Runtime evidence integrity.',
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

function gitRevCount(projectRoot) {
  return Number.parseInt(
    execFileSync('git', ['rev-list', '--count', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim(),
    10
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

test('project hook service skips workflows when project metadata or slides are missing', async (t) => {
  const { runProjectStopHookWorkflow } = await import('../project-hook-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const stopResult = await runProjectStopHookWorkflow(projectRoot);

  assert.deepEqual(stopResult, { status: 'skip', messages: [] });
});

test('project stop hook workflow checkpoints a clean project', async (t) => {
  const [{ createProjectScaffold }, { runProjectStopHookWorkflow }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../project-hook-service.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const commitsBefore = gitRevCount(projectRoot);
  const result = await runProjectStopHookWorkflow(projectRoot);
  const commitsAfter = gitRevCount(projectRoot);

  assert.equal(result.status, 'pass');
  assert.deepEqual(result.messages, []);
  assert.equal(result.checkpoint.committed, true);
  assert.ok(result.checkpoint.commit);
  assert.equal(commitsAfter, commitsBefore + 1);
});

test('project stop hook workflow ignores legacy manual historyPolicy and still checkpoints', async (t) => {
  const [{ createProjectScaffold }, { runProjectStopHookWorkflow }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../project-hook-service.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const metadataPath = resolve(projectRoot, '.presentation', 'project.json');
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  writeFileSync(metadataPath, `${JSON.stringify({ ...metadata, historyPolicy: 'manual' }, null, 2)}\n`);

  const commitsBefore = gitRevCount(projectRoot);
  const result = await runProjectStopHookWorkflow(projectRoot);
  const commitsAfter = gitRevCount(projectRoot);

  assert.equal(result.status, 'pass');
  assert.deepEqual(result.messages, []);
  assert.equal(result.checkpoint.committed, true);
  assert.ok(result.checkpoint.commit);
  assert.equal(commitsAfter, commitsBefore + 1);
});

test('project stop hook workflow fails invalid intent before checkpointing', async (t) => {
  const [{ createProjectScaffold }, { runProjectStopHookWorkflow }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../project-hook-service.mjs'),
  ]);
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
  const result = await runProjectStopHookWorkflow(projectRoot);
  const commitsAfter = gitRevCount(projectRoot);

  assert.equal(result.status, 'fail');
  assert.match(result.messages.join('\n'), /ghost|slideIntent|intent/i);
  assert.equal(commitsAfter, commitsBefore);
});

test('project stop hook workflow normalizes runtime policy exceptions', async (t) => {
  const [{ createProjectScaffold }, { runProjectStopHookWorkflow }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../project-hook-service.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });

  const result = await runProjectStopHookWorkflow(projectRoot);

  assert.equal(result.status, 'fail');
  assert.match(result.messages.join('\n'), /Deck policy violation|brief\.md|TODO/i);
});

test('project stop hook workflow ignores deck-quality heuristics and still passes cleanly', async (t) => {
  const [{ createProjectScaffold }, { runProjectStopHookWorkflow }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../project-hook-service.mjs'),
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

  const result = await runProjectStopHookWorkflow(projectRoot);

  assert.equal(result.status, 'pass');
  assert.deepEqual(result.messages, []);
});
