import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = process.cwd();

function listSourceFiles(rootAbs) {
  const results = [];
  for (const entry of readdirSync(rootAbs, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) {
      continue;
    }
    const entryAbs = resolve(rootAbs, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(entryAbs));
      continue;
    }
    if (/\.(?:mjs|js|cjs)$/.test(entry.name)) {
      results.push(entryAbs);
    }
  }
  return results;
}

function getImportViolations(files, matcher, allowlist = new Set()) {
  const violations = [];
  for (const fileAbs of files) {
    const relativePath = fileAbs.slice(REPO_ROOT.length + 1).replaceAll('\\', '/');
    if (allowlist.has(relativePath)) {
      continue;
    }
    const content = readFileSync(fileAbs, 'utf8');
    if (matcher.test(content)) {
      violations.push(relativePath);
    }
  }
  return violations;
}

test('electron does not import runtime service implementations directly', () => {
  const electronFiles = listSourceFiles(resolve(REPO_ROOT, 'electron'));
  const violations = getImportViolations(
    electronFiles,
    /from\s+['"][^'"]*framework\/runtime\/services\//,
    new Set(['electron/worker/terminal-service.mjs'])
  );
  assert.deepEqual(violations, []);
});

test('electron does not import project-agent modules directly', () => {
  const electronFiles = listSourceFiles(resolve(REPO_ROOT, 'electron'));
  const violations = getImportViolations(electronFiles, /from\s+['"][^'"]*project-agent\//);
  assert.deepEqual(violations, []);
});

test('runtime does not import project-agent modules directly', () => {
  const runtimeFiles = listSourceFiles(resolve(REPO_ROOT, 'framework', 'runtime'));
  const violations = getImportViolations(runtimeFiles, /from\s+['"][^'"]*project-agent\//);
  assert.deepEqual(violations, []);
});

test('terminal core remains vendor-neutral shell transport', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'framework', 'runtime', 'terminal-core.mjs'), 'utf8');
  assert.doesNotMatch(content, /\bacceptEdits\b/);
  assert.doesNotMatch(content, /['"]claude['"]/);
  assert.doesNotMatch(content, /['"]codex['"]/);
});

test('renderer no longer consumes the generic public actions bridge', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'electron', 'renderer', 'app.js'), 'utf8');
  assert.doesNotMatch(content, /window\.electron\.actions/);
  assert.doesNotMatch(content, /window\.electron\.events/);
});

test('renderer no longer consumes the generic public watch bridge', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'electron', 'renderer', 'app.js'), 'utf8');
  assert.doesNotMatch(content, /window\.electron\.watch/);
});

test('project authoring rules describe deterministic package ownership', () => {
  const frameworkRules = readFileSync(
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'rules', 'framework.md'),
    'utf8'
  );
  const fileBoundaries = readFileSync(
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'rules', 'file-boundaries.md'),
    'utf8'
  );
  const authoringRules = readFileSync(
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'rules', 'authoring-rules.md'),
    'utf8'
  );

  assert.doesNotMatch(frameworkRules, /folder naming is the manifest/i);
  assert.match(fileBoundaries, /\.presentation\/intent\.json/);
  assert.match(fileBoundaries, /package\.generated\.json/i);
  assert.match(fileBoundaries, /runtime\/render-state\.json/i);
  assert.match(authoringRules, /generated structure is deterministic/i);
  assert.match(authoringRules, /runtime evidence is read-only/i);
});
