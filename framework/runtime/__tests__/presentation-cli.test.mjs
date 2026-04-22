import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { getProjectClaudeScaffoldPackage } from '../../shared/project-claude-scaffold-package.mjs';
import { parsePresentationCliArgs, runPresentationCli } from '../presentation-cli.mjs';
import { createPresentationScaffold } from '../services/scaffold-service.mjs';

const CLI_PATH = resolve(process.cwd(), 'framework/runtime/presentation-cli.mjs');
const runtimeClaudeScaffoldPackage = getProjectClaudeScaffoldPackage({ frameworkRoot: process.cwd() });
const runtimeClaudeScaffoldSmokePaths = [
  '.claude/settings.json',
  '.claude/hooks/run-presentation-stop-workflow.mjs',
  '.claude/rules/framework.md',
  '.claude/skills/new-deck/SKILL.md',
];

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-presentation-cli-'));
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

test('presentation-cli audit keeps evidence separate from nextFocus in the envelope', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const result = await runPresentationCli(['audit', 'theme', '--project', projectRoot, '--format', 'json'], {
    core: {
      async runAudit(input, options = {}) {
        assert.equal(input, projectRoot);
        assert.equal(options.family, 'theme');
        return {
          kind: 'presentation-audit',
          family: 'theme',
          projectRoot: input,
          slideId: null,
          status: 'fail',
          issueCount: 1,
          issues: [{ code: 'theme.structural-token-override', source: 'theme.css' }],
          nextFocus: ['theme.css'],
          evidence: ['theme.css'],
        };
      },
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.payload.status, 'fail');
  assert.deepEqual(result.payload.nextFocus, ['theme.css']);
  assert.deepEqual(result.payload.evidence, ['theme.css']);
  assert.notStrictEqual(result.payload.evidence, result.payload.nextFocus);
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
  assert.ok(json.evidence.includes('.presentation/runtime/design-state.json'));
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
  assert.equal(json.data.designState.kind, 'presentation-design-state');
  assert.ok(json.freshness);
});

test('package.json exposes the runtime CLI as the public presentation bin', () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(packageJson.bin.presentation, './framework/runtime/presentation-cli.mjs');
});

test('runtime presentation cli starts with a portable node shebang', () => {
  const source = readFileSync(CLI_PATH, 'utf8');
  assert.match(source, /^#!\/usr\/bin\/env node\r?\n/);
});

test('runtime presentation cli supports direct shebang execution from an external cwd', {
  skip: process.platform === 'win32',
}, (t) => {
  const outsideCwd = createTempProjectRoot();
  const projectRoot = resolve(outsideCwd, 'generated-project');
  t.after(() => rmSync(outsideCwd, { recursive: true, force: true }));

  const result = spawnSync(
    CLI_PATH,
    ['init', '--project', projectRoot, '--slides', '2', '--format', 'json'],
    {
      cwd: outsideCwd,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'created');
  assert.equal(json.slideCount, 2);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), true);
  assertProjectClaudeScaffold(projectRoot, json.files);
});

test('runtime presentation cli direct-entry guard works through a symlinked bin path', {
  skip: process.platform === 'win32',
}, (t) => {
  const outsideCwd = createTempProjectRoot();
  const projectRoot = resolve(outsideCwd, 'generated-project');
  const symlinkPath = resolve(outsideCwd, 'presentation');
  t.after(() => rmSync(outsideCwd, { recursive: true, force: true }));

  symlinkSync(CLI_PATH, symlinkPath);

  const result = spawnSync(
    process.execPath,
    [symlinkPath, 'init', '--project', projectRoot, '--slides', '2', '--format', 'json'],
    {
      cwd: outsideCwd,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'created');
  assert.equal(json.slideCount, 2);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), true);
  assertProjectClaudeScaffold(projectRoot, json.files);
});

test('presentation-cli init creates the full shell-less project scaffold', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const result = await runPresentationCli(['init', '--project', projectRoot, '--format', 'json']);

  assert.equal(result.exitCode, 0);
  assert.equal(result.payload.status, 'created');
  assert.equal(result.payload.projectRoot, projectRoot);
  assert.ok(result.payload.files.includes('.presentation/project.json'));
  assert.ok(result.payload.files.includes('.presentation/framework-cli.mjs'));
  assert.ok(result.payload.files.includes('.claude/settings.json'));
  assert.ok(result.payload.files.includes('.claude/AGENTS.md'));
  assert.ok(result.payload.files.includes('.claude/CLAUDE.md'));
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework-cli.mjs')), true);
  assertProjectClaudeScaffold(projectRoot, result.payload.files);
  assert.equal(existsSync(resolve(projectRoot, '.git')), true);
});

test('presentation-cli parser accepts init and preview command families', () => {
  const initParsed = parsePresentationCliArgs(['init', '--project', '/tmp/example', '--slides', '4']);
  assert.equal(initParsed.family, 'init');
  assert.equal(initParsed.projectRoot, '/tmp/example');
  assert.equal(initParsed.slideCount, 4);

  const previewParsed = parsePresentationCliArgs(['preview', 'serve', '--project', '/tmp/example']);
  assert.equal(previewParsed.family, 'preview');
  assert.deepEqual(previewParsed.positionals, ['serve']);
});

test('presentation-cli inspect text renders structured summaries instead of object placeholders', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const result = runCli(['inspect', 'package', '--project', projectRoot, '--format', 'text']);

  assert.equal(result.exitCode, 0);
  assert.doesNotMatch(result.stdout, /\[object Object\]/);
  assert.match(result.stdout, /"slidesTotal": 1/);
});

test('presentation-cli export rejects out-of-project output directories before exporting', async (t) => {
  const projectRoot = createTempProjectRoot();
  const outsideRoot = createTempProjectRoot();
  const outputDir = resolve(outsideRoot, 'exports');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  t.after(() => rmSync(outsideRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const result = runCli(['export', 'pdf', '--project', projectRoot, '--output-dir', outputDir, '--format', 'json']);

  assert.equal(result.exitCode, 3);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'unsupported');
  assert.match(json.summary, /must stay within the project root/i);
  assert.equal(existsSync(outputDir), false);
});

test('presentation-cli export maps invalid slide selections to a structured cli failure', async (t) => {
  const projectRoot = createTempProjectRoot();
  const outputDir = resolve(projectRoot, 'outputs', 'exports', 'manual');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const result = runCli([
    'export',
    'pdf',
    '--project',
    projectRoot,
    '--slide',
    'missing-slide',
    '--output-dir',
    outputDir,
    '--format',
    'json',
  ]);

  assert.equal(result.exitCode, 3);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'invalid-request');
  assert.match(json.summary, /Unknown slide selections: missing-slide/);
  assert.equal(existsSync(outputDir), false);
});

test('presentation-cli finalize rejects export-only flags with invalid-args', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  let exportCalls = 0;
  let finalizeCalls = 0;
  const result = await runPresentationCli([
    'finalize',
    '--project',
    projectRoot,
    '--output-dir',
    'outputs/manual',
    '--format',
    'json',
  ], {
    core: {
      async exportPresentation() {
        exportCalls += 1;
        return {
          status: 'pass',
          outputDir: 'outputs/manual',
          artifacts: ['outputs/manual/deck.pdf'],
          evidenceUpdated: ['.presentation/runtime/artifacts.json'],
          issues: [],
          scope: {
            kind: 'export',
            format: 'pdf',
            projectRoot,
          },
        };
      },
      async finalize() {
        finalizeCalls += 1;
        return {
          status: 'pass',
          outputs: {
            outputDir: '',
            pdf: `${projectRoot}.pdf`,
            artifacts: [`${projectRoot}.pdf`],
          },
          evidenceUpdated: ['.presentation/runtime/artifacts.json'],
          issues: [],
        };
      },
    },
  });

  assert.equal(result.exitCode, 4);
  assert.equal(result.payload.status, 'invalid-args');
  assert.match(result.payload.summary, /Finalize does not accept --output-dir, --output-file, or --slide/i);
  assert.equal(exportCalls, 0);
  assert.equal(finalizeCalls, 0);
});
