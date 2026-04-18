import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

test('application does not import electron worker modules directly', () => {
  const applicationFiles = listSourceFiles(resolve(REPO_ROOT, 'framework', 'application'));
  const violations = getImportViolations(applicationFiles, /from\s+['"][^'"]*electron\/worker\//);
  assert.deepEqual(violations, []);
});

test('runtime does not import project-agent modules directly', () => {
  const runtimeFiles = listSourceFiles(resolve(REPO_ROOT, 'framework', 'runtime'));
  const violations = getImportViolations(runtimeFiles, /from\s+['"][^'"]*project-agent\//);
  assert.deepEqual(violations, []);
});

test('runtime does not import application modules directly', () => {
  const runtimeFiles = listSourceFiles(resolve(REPO_ROOT, 'framework', 'runtime'));
  const violations = getImportViolations(runtimeFiles, /from\s+['"][^'"]*framework\/application\//);
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
  ];

  for (const hookFile of hookFiles) {
    const content = readFileSync(hookFile, 'utf8');
    assert.doesNotMatch(content, /checkpointGit|git\s*\[/);
    assert.doesNotMatch(content, /diff\s+--cached|rev-parse|git add|git commit/i);
  }
});

test('deleted legacy hook and broad-review skill files stay removed', () => {
  const removedPaths = [
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'hooks', 'check-slide-quality.mjs'),
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'skills', 'fix-warnings', 'SKILL.md'),
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'skills', 'operator-console-judge', 'SKILL.md'),
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'skills', 'operator-console-user-test', 'SKILL.md'),
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'skills', 'review-deck', 'SKILL.md'),
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'skills', 'revise-deck', 'SKILL.md'),
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'skills', 'review-deck-swarm', 'SKILL.md'),
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'skills', 'verify-deck', 'SKILL.md'),
    resolve(REPO_ROOT, 'project-agent', 'project-dot-claude', 'skills', 'autonomous-user-test', 'SKILL.md'),
  ];

  for (const removedPath of removedPaths) {
    assert.equal(existsSync(removedPath), false, `${removedPath} should have been deleted`);
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

test('renderer uses only the canonical actions bridge for action availability, invocation, and lifecycle', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'electron', 'renderer', 'app.js'), 'utf8');
  assert.match(content, /window\.electron\.actions\.invoke/);
  assert.match(content, /window\.electron\.actions\.list/);
  assert.match(content, /window\.electron\.actions\.onEvent/);
  assert.match(content, /runProductAction\('export_presentation_artifacts'/);
  assert.doesNotMatch(content, /window\.electron\.events/);
  assert.doesNotMatch(content, /window\.electron\.(build|export|review)\./);
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

test('electron preload exposes no legacy build/export/review action namespaces', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'electron', 'preload.cjs'), 'utf8');
  assert.doesNotMatch(content, /\bbuild:\s*\{/);
  assert.doesNotMatch(content, /\bexport:\s*\{/);
  assert.doesNotMatch(content, /\breview:\s*\{/);
  assert.doesNotMatch(content, /build:check|build:finalize|build:captureScreenshots/);
  assert.doesNotMatch(content, /export:start/);
  assert.doesNotMatch(content, /review:run|review:revise|review:fixWarnings|review:getAvailability/);
});

test('deleted legacy electron action bridge stays removed', () => {
  const removedPath = resolve(REPO_ROOT, 'framework', 'application', 'electron-action-bridge.cjs');
  assert.equal(existsSync(removedPath), false, `${removedPath} should have been deleted`);
});

test('merged action and runtime leaf modules stay removed', () => {
  const removedPaths = [
    resolve(REPO_ROOT, 'framework', 'application', 'action-catalog.mjs'),
    resolve(REPO_ROOT, 'framework', 'application', 'action-events.mjs'),
    resolve(REPO_ROOT, 'framework', 'application', 'action-workflow-service.mjs'),
    resolve(REPO_ROOT, 'framework', 'application', 'project-history-service.mjs'),
    resolve(REPO_ROOT, 'framework', 'runtime', 'services', 'capture-service.mjs'),
    resolve(REPO_ROOT, 'framework', 'runtime', 'services', 'check-service.mjs'),
    resolve(REPO_ROOT, 'framework', 'runtime', 'services', 'export-service.mjs'),
    resolve(REPO_ROOT, 'framework', 'runtime', 'services', 'finalize-service.mjs'),
    resolve(REPO_ROOT, 'framework', 'runtime', 'new-deck.mjs'),
    resolve(REPO_ROOT, 'electron', 'worker', 'ipc-contract.mjs'),
  ];

  for (const removedPath of removedPaths) {
    assert.equal(existsSync(removedPath), false, `${removedPath} should have been deleted`);
  }
});

test('deleted deck-quality runtime helper stays removed', () => {
  const removedPaths = [
    resolve(REPO_ROOT, 'framework', 'runtime', 'deck-quality.js'),
    resolve(REPO_ROOT, 'framework', 'runtime', 'project-quality-check.mjs'),
  ];

  for (const removedPath of removedPaths) {
    assert.equal(existsSync(removedPath), false, `${removedPath} should have been deleted`);
  }
});

test('package scripts expose one desktop launch path and four deterministic runtime cli commands only', () => {
  const packageJson = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts.start, 'electron electron/main.mjs');
  assert.equal('desktop:start' in packageJson.scripts, false);
  assert.equal('debug:preview' in packageJson.scripts, false);
  assert.equal(packageJson.scripts.check, 'node framework/runtime/check-deck.mjs');
  assert.equal(packageJson.scripts.capture, 'node framework/runtime/deck-capture.mjs');
  assert.equal(packageJson.scripts.export, 'node framework/runtime/export-pdf.mjs');
  assert.equal(packageJson.scripts.finalize, 'node framework/runtime/finalize-deck.mjs');
});

test('project-local framework cli delegates through the presentation cli with injected project scope', () => {
  const content = readFileSync(resolve(REPO_ROOT, 'framework', 'runtime', 'project-cli-shim.mjs'), 'utf8');
  assert.match(content, /PRESENTATION_CLI_SPECIFIER = 'pitch-framework\/presentation-cli'/);
  assert.match(content, /import\.meta\.resolve\(PRESENTATION_CLI_SPECIFIER\)/);
  assert.match(content, /Repair guidance:/);
  assert.match(content, /await import\(moduleUrl\)/);
  assert.match(content, /\.\.\.process\.argv\.slice\(2\),\s*'--project', projectRoot/);
  assert.doesNotMatch(content, /resolve\(frameworkRoot, 'framework', 'runtime', 'presentation-cli\.mjs'\)/);
  assert.doesNotMatch(content, /FALLBACK_/);
  assert.doesNotMatch(content, /check: 'framework\/runtime\/check-deck\.mjs'/);
  assert.doesNotMatch(content, /<check\|capture\|export\|finalize>/);
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
