import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
