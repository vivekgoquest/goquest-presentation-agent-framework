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

test('project-local hook wrappers do not import runtime modules directly', () => {
  const hookFiles = listSourceFiles(resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'hooks'));
  const violations = getImportViolations(hookFiles, /from\s+['"][^'"]*framework\/runtime\//);
  assert.deepEqual(violations, []);
});

test('project-local hook wrappers do not own git checkpoint execution', () => {
  const hookFiles = [
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'hooks', 'run-presentation-stop-workflow.mjs'),
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'hooks', 'check-slide-quality.mjs'),
  ];

  for (const hookFile of hookFiles) {
    const content = readFileSync(hookFile, 'utf8');
    assert.doesNotMatch(content, /checkpointGit|git\s*\[/);
    assert.doesNotMatch(content, /diff\s+--cached|rev-parse|git add|git commit/i);
  }
});

test('agent launcher does not hardcode agentic workflow semantics', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'project-agent', 'agent-launcher.mjs'), 'utf8');
  assert.doesNotMatch(content, /Current quality warnings:/);
  assert.doesNotMatch(content, /package\.generated\.json/);
  assert.doesNotMatch(content, /render-state\.json/);
  assert.doesNotMatch(content, /artifacts\.json/);
  assert.doesNotMatch(content, /last-good\.json/);
});

test('terminal core remains vendor-neutral shell transport', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'framework', 'runtime', 'terminal-core.mjs'), 'utf8');
  assert.doesNotMatch(content, /\bacceptEdits\b/);
  assert.doesNotMatch(content, /['"]claude['"]/);
  assert.doesNotMatch(content, /['"]codex['"]/);
});

test('renderer uses only the generic action invoke bridge and does not take over action lifecycle orchestration', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'electron', 'renderer', 'app.js'), 'utf8');
  assert.match(content, /window\.electron\.actions\.invoke/);
  assert.doesNotMatch(content, /window\.electron\.actions\.list/);
  assert.doesNotMatch(content, /window\.electron\.actions\.onEvent/);
  assert.doesNotMatch(content, /window\.electron\.events/);
});

test('renderer no longer consumes the generic public watch bridge', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'electron', 'renderer', 'app.js'), 'utf8');
  assert.doesNotMatch(content, /window\.electron\.watch/);
});

test('electron worker host does not hardcode product action ids or action availability synthesis', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'electron', 'worker', 'host.mjs'), 'utf8');
  assert.doesNotMatch(content, /review_presentation|revise_presentation|fix_warnings/);
  assert.doesNotMatch(content, /build_presentation|check_presentation|capture_screenshots|export_presentation/);
  assert.doesNotMatch(content, /buildReviewAvailability/);
});

test('electron preload does not own action-id to operation maps', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'electron', 'preload.cjs'), 'utf8');
  assert.doesNotMatch(content, /BUILD_OPERATION_BY_ACTION_ID/);
  assert.doesNotMatch(content, /REVIEW_OPERATION_BY_ACTION_ID/);
  assert.doesNotMatch(content, /build_presentation|check_presentation|capture_screenshots/);
  assert.doesNotMatch(content, /review_presentation|revise_presentation|fix_warnings/);
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
