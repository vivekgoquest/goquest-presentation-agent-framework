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

test('scaffolded guidance orients agents through the design state ledger', async (t) => {
  const { writeProjectAgentScaffoldPackage } = await import('../scaffold-package.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  writeProjectAgentScaffoldPackage(projectRoot, { frameworkRoot: process.cwd() });

  const agentsContent = readFileSync(resolve(projectRoot, '.claude', 'AGENTS.md'), 'utf8');
  assert.match(agentsContent, /\.presentation\/runtime\/design-state\.json/);
  assert.match(agentsContent, /generated evidence/i);

  const frameworkContent = readFileSync(resolve(projectRoot, '.claude', 'rules', 'framework.md'), 'utf8');
  assert.match(frameworkContent, /single context surface/);
  assert.match(frameworkContent, /not source of truth/);
});

test('scaffold package keeps the Claude packet shell-less and CLI-first', async (t) => {
  const { getProjectAgentScaffoldPackage, writeProjectAgentScaffoldPackage } = await import('../scaffold-package.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const scaffoldPackage = getProjectAgentScaffoldPackage({ frameworkRoot: process.cwd() });
  writeProjectAgentScaffoldPackage(projectRoot, { frameworkRoot: process.cwd() });

  const markdownPacketFiles = scaffoldPackage.entries
    .map((entry) => entry.targetRel)
    .filter((targetRel) => targetRel.startsWith('.claude/') && /\.md$/i.test(targetRel));

  for (const packetFile of markdownPacketFiles) {
    const content = readFileSync(resolve(projectRoot, packetFile), 'utf8');
    assert.doesNotMatch(content, /application-prepared workflow context/i);
    assert.doesNotMatch(content, /\bElectron\b/i);
    assert.doesNotMatch(content, /desktop app workflow/i);
    assert.doesNotMatch(content, /last-good\.json/i);
    assert.doesNotMatch(content, /\bnpm run (?:new|check|finalize|export|capture|setup)\b/i);
    assert.doesNotMatch(content, /node \.presentation\/framework-cli\.mjs check\b/);
    assert.doesNotMatch(content, /node \.presentation\/framework-cli\.mjs capture\b/);
    assert.doesNotMatch(content, /node \.presentation\/framework-cli\.mjs export \/tmp\//);
    assert.doesNotMatch(content, /node \.presentation\/framework-cli\.mjs export pdf --output-file outputs\/manual-export\/deck\.pdf/);
  }

  const agentsContent = readFileSync(resolve(projectRoot, '.claude', 'AGENTS.md'), 'utf8');
  assert.match(agentsContent, /node \.presentation\/framework-cli\.mjs audit all/);
  assert.match(agentsContent, /node \.presentation\/framework-cli\.mjs export screenshots --output-dir/);
  assert.match(agentsContent, /node \.presentation\/framework-cli\.mjs export pdf --output-dir outputs\/manual-export --output-file deck\.pdf/);
  assert.doesNotMatch(agentsContent, /application-owned hook workflows|framework application layer/i);

  const authoringContent = readFileSync(resolve(projectRoot, '.claude', 'rules', 'authoring-rules.md'), 'utf8');
  assert.match(authoringContent, /node \.presentation\/framework-cli\.mjs export pdf --output-dir outputs\/manual-export --output-file deck\.pdf/);

  const newDeckContent = readFileSync(resolve(projectRoot, '.claude', 'skills', 'new-deck', 'SKILL.md'), 'utf8');
  assert.match(newDeckContent, /\bpresentation init --project\b/);
  assert.doesNotMatch(newDeckContent, /node \.presentation\/framework-cli\.mjs init\b/);
  assert.doesNotMatch(newDeckContent, /\bnpm run new\b/i);
  assert.doesNotMatch(newDeckContent, /\bnpm run setup\b/i);

  const settings = JSON.parse(readFileSync(resolve(projectRoot, '.claude', 'settings.json'), 'utf8'));
  const statusMessage = settings.hooks.Stop[0].hooks[0].statusMessage;
  assert.match(statusMessage, /audit|CLI|project-local/i);
  assert.doesNotMatch(statusMessage, /checkpoint/i);
});

test('scaffolded Claude packet points agents to the in-packet AGENTS contract instead of a missing root file', async (t) => {
  const { writeProjectAgentScaffoldPackage } = await import('../scaffold-package.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  writeProjectAgentScaffoldPackage(projectRoot, { frameworkRoot: process.cwd() });

  const packetFiles = [
    '.claude/CLAUDE.md',
    '.claude/rules/authoring-rules.md',
    '.claude/rules/file-boundaries.md',
    '.claude/rules/framework.md',
    '.claude/skills/apply-narrative-review-changes/SKILL.md',
    '.claude/skills/apply-visual-review-changes/SKILL.md',
    '.claude/skills/fix-validation-issues/SKILL.md',
    '.claude/skills/new-deck/SKILL.md',
    '.claude/skills/review-narrative-presentation/SKILL.md',
    '.claude/skills/review-visual-presentation/SKILL.md',
  ];

  for (const packetFile of packetFiles) {
    const content = readFileSync(resolve(projectRoot, packetFile), 'utf8');
    assert.doesNotMatch(content, /\.\.\/AGENTS\.md/);
    assert.doesNotMatch(content, /\/abs\/path-to-project\/AGENTS\.md/);
    assert.doesNotMatch(content, /project-root `AGENTS\.md`/);
    assert.doesNotMatch(content, /Read AGENTS\.md first, then CLAUDE\.md/);
  }

  const claudeContent = readFileSync(resolve(projectRoot, '.claude', 'CLAUDE.md'), 'utf8');
  assert.match(claudeContent, /AGENTS\.md in this directory|\.claude\/AGENTS\.md/);
  const newDeckContent = readFileSync(resolve(projectRoot, '.claude', 'skills', 'new-deck', 'SKILL.md'), 'utf8');
  assert.match(newDeckContent, /\.claude\/AGENTS\.md/);
});

test('scaffolded new-deck guidance keeps v1 long-deck behavior aligned with init limits', async (t) => {
  const { writeProjectAgentScaffoldPackage } = await import('../scaffold-package.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  writeProjectAgentScaffoldPackage(projectRoot, { frameworkRoot: process.cwd() });

  const newDeckContent = readFileSync(resolve(projectRoot, '.claude', 'skills', 'new-deck', 'SKILL.md'), 'utf8');
  assert.match(newDeckContent, /supports 1(?:-| to )10 slides/i);
  assert.doesNotMatch(newDeckContent, /If the deck needs more than 10 slides, run:/);
  assert.match(newDeckContent, /If the project later grows beyond 10 slides/i);
  assert.match(newDeckContent, /outline\.md/);
});

test('scaffolded new-deck handoff only asks for current shell-less delivery artifacts', async (t) => {
  const { writeProjectAgentScaffoldPackage } = await import('../scaffold-package.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  writeProjectAgentScaffoldPackage(projectRoot, { frameworkRoot: process.cwd() });

  const newDeckContent = readFileSync(resolve(projectRoot, '.claude', 'skills', 'new-deck', 'SKILL.md'), 'utf8');
  assert.match(newDeckContent, /inspect the preview and the root PDF yourself/i);
  assert.match(newDeckContent, /the project folder path/i);
  assert.match(newDeckContent, /whether the project is linked or copied mode/i);
  assert.match(newDeckContent, /the root PDF path/i);
  assert.match(newDeckContent, /any additional manual export paths you intentionally created, if any/i);
  assert.match(newDeckContent, /any open questions that still affect the deck/i);
  assert.doesNotMatch(newDeckContent, /the screenshot path/i);
  assert.doesNotMatch(newDeckContent, /the summary path/i);
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
