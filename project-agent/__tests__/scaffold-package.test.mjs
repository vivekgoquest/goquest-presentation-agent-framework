import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-scaffold-package-'));
}

test('scaffold package moves the Claude packet fully under .claude', async () => {
  const { getProjectAgentScaffoldPackage } = await import('../scaffold-package.mjs');

  const scaffoldPackage = getProjectAgentScaffoldPackage({ frameworkRoot: process.cwd() });
  const targetRels = scaffoldPackage.entries.map((entry) => entry.targetRel);

  assert.ok(targetRels.includes('.claude/AGENTS.md'));
  assert.ok(targetRels.includes('.claude/settings.json'));
  assert.ok(targetRels.includes('.claude/CLAUDE.md'));
  assert.equal(targetRels.includes('AGENTS.md'), false);
  assert.ok(scaffoldPackage.requiredPaths.includes('.claude/AGENTS.md'));
});

test('scaffold package writes AGENTS and CLAUDE files beneath .claude only', async (t) => {
  const { writeProjectAgentScaffoldPackage } = await import('../scaffold-package.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const result = writeProjectAgentScaffoldPackage(projectRoot, { frameworkRoot: process.cwd() });

  assert.ok(result.createdPaths.includes('.claude/AGENTS.md'));
  assert.ok(result.createdPaths.includes('.claude/CLAUDE.md'));
  assert.equal(existsSync(resolve(projectRoot, '.claude', 'AGENTS.md')), true);
  assert.equal(existsSync(resolve(projectRoot, '.claude', 'CLAUDE.md')), true);
  assert.equal(existsSync(resolve(projectRoot, 'AGENTS.md')), false);
  assert.match(readFileSync(resolve(projectRoot, '.claude', 'AGENTS.md'), 'utf8'), /\.presentation\/package\.generated\.json/);
});

test('scaffold package resolves its source files from the installed package root instead of cwd', async (t) => {
  const outsideCwd = createTempProjectRoot();
  const scaffoldPackageUrl = pathToFileURL(resolve(import.meta.dirname, '..', 'scaffold-package.mjs')).href;
  t.after(() => rmSync(outsideCwd, { recursive: true, force: true }));

  const script = [
    `import { existsSync } from 'node:fs';`,
    `import { getProjectAgentScaffoldPackage } from ${JSON.stringify(scaffoldPackageUrl)};`,
    'const scaffoldPackage = getProjectAgentScaffoldPackage();',
    'console.log(JSON.stringify({',
    "  hasAgents: scaffoldPackage.entries.some((entry) => entry.targetRel === '.claude/AGENTS.md'),",
    "  hasClaude: scaffoldPackage.entries.some((entry) => entry.targetRel === '.claude/CLAUDE.md'),",
    '  allSourcesExist: scaffoldPackage.entries.every((entry) => existsSync(entry.sourceAbs)),',
    '}));',
  ].join('\n');

  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
    cwd: outsideCwd,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.hasAgents, true);
  assert.equal(payload.hasClaude, true);
  assert.equal(payload.allSourcesExist, true);
});
