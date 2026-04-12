import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';

const CLI_PATH = resolve(process.cwd(), 'framework/runtime/presentation-cli.mjs');

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-presentation-cli-'));
}

function runCli(args) {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    encoding: 'utf8',
  });

  return {
    exitCode: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
}

function fillBrief(projectRoot, title = 'CLI Contract Brief') {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      `# ${title}`,
      '',
      '## Goal',
      '',
      'Exercise the presentation CLI contract.',
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
      '- Structured JSON envelopes.',
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

test('presentation-cli audit returns exit code 1 on hard violations', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot, 'CLI Audit Contract');
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

  const result = runCli(['audit', 'theme', '--project', projectRoot, '--format', 'json']);

  assert.equal(result.exitCode, 1);
  const json = JSON.parse(result.stdout);
  assert.equal(json.command, `presentation audit theme --project ${projectRoot} --format json`);
  assert.equal(json.status, 'fail');
  assert.equal(json.family, 'theme');
  assert.equal(json.issues[0].code, 'theme.structural-token-override');
});

test('presentation-cli status returns workflow and facets', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const result = runCli(['status', '--project', projectRoot, '--format', 'json']);

  assert.equal(result.exitCode, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.command, `presentation status --project ${projectRoot} --format json`);
  assert.equal(json.status, 'ok');
  assert.ok(json.workflow);
  assert.ok(json.facets);
});

test('presentation-cli inspect package returns a structured package envelope', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });

  const result = runCli(['inspect', 'package', '--project', projectRoot, '--format', 'json']);

  assert.equal(result.exitCode, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'ok');
  assert.deepEqual(json.scope, { kind: 'package', projectRoot });
  assert.equal(json.data.manifest.counts.slidesTotal, 2);
  assert.ok(json.freshness);
});

test('presentation-cli finalize status is exposed through the finalize family', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const result = runCli(['finalize', 'status', '--project', projectRoot, '--format', 'json']);

  assert.equal(result.exitCode, 0);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'ok');
  assert.ok(json.workflow);
  assert.ok(json.facets);
  assert.deepEqual(json.scope, { kind: 'finalize', projectRoot });
});
