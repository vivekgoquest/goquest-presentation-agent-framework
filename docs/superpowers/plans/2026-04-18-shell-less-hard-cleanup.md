# Shell-less Hard Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the repository into a fully shell-less presentation package: runtime CLI as the only public product surface, full core-owned `init`, protected `/.claude/*` scaffold, local project shim, git setup during `init`, and no Electron, shell routers, agent launchers, or legacy wrapper command paths.

**Architecture:** Make `framework/runtime/presentation-cli.mjs` the canonical product entrypoint and move the remaining useful shell-less responsibilities under runtime-owned code. Keep `project-agent/` only as static scaffold source for the protected `/.claude/*` files that `init` copies into projects. Delete the Electron shell, the application/router layer, built-in agent-launch orchestration, and wrapper CLIs so the package teaches one operational language only: `presentation ...` and `node .presentation/framework-cli.mjs ...`.

**Tech Stack:** Node.js ESM, package `bin` + `exports`, Playwright-backed preview/export runtime, Express preview server, static scaffold assets in `project-agent/`, Node test runner.

---

## File Structure / Responsibility Map

### Canonical product surface
- Modify: `package.json`
  - Point the public `presentation` bin at `framework/runtime/presentation-cli.mjs`.
  - Remove product-facing shortcut scripts and shell-only dependencies.
  - Keep only maintainer scripts such as `setup` and `test`.
- Modify: `framework/runtime/presentation-cli.mjs`
  - Become the only public CLI implementation.
  - Own the canonical `init`, `inspect`, `status`, `audit`, `preview`, `export`, and `finalize` command families.
  - Tighten CLI contract details while touching the file: runtime-owned `init`, direct `finalize`, audit evidence correctness, and distinct invalid-arg exit code.
- Modify: `framework/runtime/presentation-core.mjs`
  - Keep semantic ownership of package operations.
  - Delegate full project creation through runtime-owned scaffold logic.

### Project creation + local shim
- Modify: `framework/runtime/services/scaffold-service.mjs`
  - Create the full shell-less project shape, including `/.claude/*` and git setup.
  - Absorb the remaining useful behavior currently living in `framework/application/project-scaffold-service.mjs`.
- Modify: `framework/runtime/project-cli-shim.mjs`
  - Keep `.presentation/framework-cli.mjs` as the only project-local entrypoint.
  - Resolve the installed package through Node package resolution and forward directly into the canonical CLI.
- Modify: `project-agent/scaffold-package.mjs`
  - Remain a static scaffold copier only.
  - Continue copying the finalized `/.claude/*` files into new projects.

### Protected project agent scaffold
- Modify: `project-agent/project-agents-md.md`
- Modify: `project-agent/project-claude-md.md`
- Modify: `project-agent/project-dot-claude/settings.json`
- Modify: `project-agent/project-dot-claude/hooks/run-presentation-stop-workflow.mjs`
- Modify: `project-agent/project-dot-claude/rules/framework.md`
- Modify: `project-agent/project-dot-claude/rules/authoring-rules.md`
- Modify: `project-agent/project-dot-claude/rules/file-boundaries.md`
- Modify: `project-agent/project-dot-claude/skills/new-deck/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/fix-validation-issues/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/review-visual-presentation/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/review-narrative-presentation/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/apply-visual-review-changes/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/apply-narrative-review-changes/SKILL.md`
  - Remove shell-era wording (`npm run ...`, application-owned workflow wording, outputs/report/summary assumptions, framework-owned launcher assumptions).
  - Keep the scaffold project-local and CLI-first.
  - Keep hooks thin and CLI-only.

### Code to delete
- Delete: `framework/application/`
  - Delete the entire shell/router/application layer once `init` and hook behavior live under runtime-owned code.
- Delete: `project-agent/agent-capabilities.mjs`
- Delete: `project-agent/agent-launcher.mjs`
- Delete: `project-agent/__tests__/agent-launcher.test.mjs`
- Delete: `electron/`
- Delete: `framework/runtime/check-deck.mjs`
- Delete: `framework/runtime/deck-capture.mjs`
- Delete: `framework/runtime/export-pdf.mjs`
- Delete: `framework/runtime/finalize-deck.mjs`
- Delete: `framework/runtime/terminal-core.mjs`
- Delete: `framework/runtime/terminal-events.mjs`
- Delete: `framework/runtime/pty-bridge.py`
- Delete: shell-only docs such as `docs/electron-operator-agent-playbook.md`, `docs/electron-operator-cli.md`, `docs/electron-operator-guide.md`

### Tests to keep and expand
- Modify: `framework/runtime/__tests__/presentation-cli.test.mjs`
- Modify: `framework/runtime/__tests__/presentation-core.test.mjs`
- Modify: `framework/runtime/__tests__/preview-server.test.mjs`
- Modify: `framework/runtime/services/__tests__/runtime-services.test.mjs`
- Modify: `framework/canvas/__tests__/canvas-contract.test.mjs`
- Modify: `project-agent/__tests__/scaffold-package.test.mjs`
- Create: `framework/runtime/__tests__/shellless-public-surface.test.mjs`
- Create: `framework/runtime/__tests__/project-hook-cli.test.mjs`
- Create: `framework/runtime/__tests__/shellless-package-integration.test.mjs`
  - Replace application/electron/agent-launcher coverage with runtime-first shell-less coverage.

### Docs to rewrite
- Modify: `README.md`
- Modify: `START-HERE.md`
- Modify: `docs/repo-architecture-overview.md`
- Modify: `docs/repo-architecture-index.md`
- Modify: `docs/repo-call-flows.md`
- Modify: `docs/repo-trace-project-creation.md`
- Modify: `docs/prd-human-agent.md`
  - Teach the shell-less package as the current product.
  - Remove Electron-first usage and wrapper-command usage.

---

### Task 1: Make the runtime CLI the only public command surface and move full `init` into runtime-owned code

**Files:**
- Modify: `package.json`
- Modify: `framework/runtime/presentation-cli.mjs`
- Modify: `framework/runtime/presentation-core.mjs`
- Modify: `framework/runtime/services/scaffold-service.mjs`
- Modify: `framework/runtime/project-cli-shim.mjs`
- Modify: `project-agent/scaffold-package.mjs`
- Test: `framework/runtime/__tests__/presentation-cli.test.mjs`
- Test: `framework/runtime/__tests__/presentation-core.test.mjs`
- Test: `framework/runtime/services/__tests__/runtime-services.test.mjs`

- [ ] **Step 1: Extend runtime CLI tests to lock the new public surface and full `init` behavior**

```js
// framework/runtime/__tests__/presentation-cli.test.mjs
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('package.json points the public presentation bin at runtime CLI', () => {
  const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(packageJson.bin.presentation, './framework/runtime/presentation-cli.mjs');
});

test('runtime CLI init creates the full shell-less project scaffold', async (t) => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'pf-runtime-init-'));
  const projectRoot = resolve(workspaceRoot, 'deck');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const result = await runPresentationCli(['init', '--project', projectRoot, '--format', 'json']);
  const json = JSON.parse(result.stdout);

  assert.equal(result.exitCode, 0);
  assert.equal(json.status, 'created');
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework-cli.mjs')), true);
  assert.equal(existsSync(resolve(projectRoot, '.claude', 'AGENTS.md')), true);
  assert.equal(existsSync(resolve(projectRoot, '.claude', 'CLAUDE.md')), true);
  assert.equal(existsSync(resolve(projectRoot, '.git')), true);
});
```

- [ ] **Step 2: Add a core-level test that `initProject()` now produces the full project, not a partial scaffold**

```js
// framework/runtime/__tests__/presentation-core.test.mjs

test('presentation core initProject delegates to full shell-less scaffold creation', async (t) => {
  const workspaceRoot = createTempProjectRoot();
  const projectRoot = resolve(workspaceRoot, 'core-init-project');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const core = createPresentationCore();
  const result = await core.initProject(projectRoot, { slideCount: 2 });

  assert.equal(result.status, 'created');
  assert.equal(result.slideCount, 2);
  assert.ok(result.files.includes('.presentation/framework-cli.mjs'));
  assert.ok(result.files.includes('.claude/AGENTS.md'));
  assert.equal(existsSync(resolve(projectRoot, '.git')), true);
});
```

- [ ] **Step 3: Run the targeted tests to confirm failure before changing implementation**

Run: `node --test framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/services/__tests__/runtime-services.test.mjs`
Expected: FAIL because the public bin still points at `framework/application/presentation-bin.mjs`, runtime `init` still produces only the partial scaffold, and git initialization still lives in `framework/application/project-scaffold-service.mjs`.

- [ ] **Step 4: Move full `init` ownership into runtime scaffold code**

```js
// framework/runtime/services/scaffold-service.mjs
import { execFileSync } from 'node:child_process';
import { writeProjectAgentScaffoldPackage } from '../../project-agent/scaffold-package.mjs';

function initializeProjectGitHistory(projectRoot, deckSlug) {
  const git = { initialized: false, committed: false, commit: '', warning: '' };
  try {
    execFileSync('git', ['init'], { cwd: projectRoot, stdio: 'ignore' });
    git.initialized = true;
    execFileSync('git', ['add', '-A'], { cwd: projectRoot, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', `Scaffold: ${deckSlug}`], { cwd: projectRoot, stdio: 'ignore' });
    git.committed = true;
    git.commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    git.warning = error instanceof Error ? error.message : String(error);
  }
  return git;
}

export function createPresentationScaffold(targetInput, options = {}) {
  const scaffoldResult = scaffoldIntoPaths(createPendingProjectPaths(targetInput.projectRootAbs || targetInput.projectRoot || targetInput), options);
  const projectRoot = targetInput.projectRootAbs || targetInput.projectRoot || targetInput;
  const agentPacket = writeProjectAgentScaffoldPackage(projectRoot, { frameworkRoot: FRAMEWORK_ROOT });
  const git = initializeProjectGitHistory(projectRoot, scaffoldResult.deck);

  return {
    ...scaffoldResult,
    git,
    files: [...scaffoldResult.files, ...agentPacket.createdPaths],
  };
}
```

- [ ] **Step 5: Point the public bin and the local shim directly at the runtime CLI**

```json
// package.json
{
  "bin": {
    "presentation": "./framework/runtime/presentation-cli.mjs"
  },
  "exports": {
    ".": "./framework/runtime/presentation-core.mjs",
    "./presentation-cli": "./framework/runtime/presentation-cli.mjs"
  }
}
```

```js
// framework/runtime/project-cli-shim.mjs
const PRESENTATION_CLI_SPECIFIER = 'pitch-framework/presentation-cli';

if (isDirectCliInvocation()) {
  const shimDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(shimDir, '..');
  const { runPresentationCli } = await loadPresentationCli();
  const result = await runPresentationCli([...process.argv.slice(2), '--project', projectRoot]);
  process.stdout.write(result.stdout);
  if (result.holdOpen) await result.holdOpen;
  process.exit(result.exitCode);
}
```

- [ ] **Step 6: Re-run the targeted tests**

Run: `node --test framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/services/__tests__/runtime-services.test.mjs`
Expected: PASS with runtime-owned full `init`, the public bin pointed at runtime CLI, and the local shim still forwarding into the installed package correctly.

- [ ] **Step 7: Commit**

```bash
git add package.json framework/runtime/presentation-cli.mjs framework/runtime/presentation-core.mjs \
  framework/runtime/services/scaffold-service.mjs framework/runtime/project-cli-shim.mjs \
  project-agent/scaffold-package.mjs framework/runtime/__tests__/presentation-cli.test.mjs \
  framework/runtime/__tests__/presentation-core.test.mjs \
  framework/runtime/services/__tests__/runtime-services.test.mjs
git commit -m "refactor: make runtime cli own full shell-less init"
```

---

### Task 2: Convert the protected `/.claude/*` scaffold to a thin CLI-only shell-less adapter

**Files:**
- Modify: `project-agent/project-agents-md.md`
- Modify: `project-agent/project-claude-md.md`
- Modify: `project-agent/project-dot-claude/settings.json`
- Modify: `project-agent/project-dot-claude/hooks/run-presentation-stop-workflow.mjs`
- Modify: `project-agent/project-dot-claude/rules/framework.md`
- Modify: `project-agent/project-dot-claude/rules/authoring-rules.md`
- Modify: `project-agent/project-dot-claude/rules/file-boundaries.md`
- Modify: `project-agent/project-dot-claude/skills/new-deck/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/fix-validation-issues/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/review-visual-presentation/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/review-narrative-presentation/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/apply-visual-review-changes/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/apply-narrative-review-changes/SKILL.md`
- Test: `project-agent/__tests__/scaffold-package.test.mjs`
- Create: `framework/runtime/__tests__/project-hook-cli.test.mjs`

- [ ] **Step 1: Add a failing hook test that proves the project hook no longer reaches into `framework/application/`**

```js
// framework/runtime/__tests__/project-hook-cli.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('project stop hook is a thin CLI-only hook', () => {
  const source = readFileSync(resolve(process.cwd(), 'project-agent/project-dot-claude/hooks/run-presentation-stop-workflow.mjs'), 'utf8');
  assert.doesNotMatch(source, /framework\/application\/project-hook-service\.mjs/);
  assert.doesNotMatch(source, /frameworkSource/);
  assert.match(source, /\.presentation\/framework-cli\.mjs/);
  assert.match(source, /audit all/);
});
```

- [ ] **Step 2: Add a failing scaffold-doc test that forbids old wrapper commands and application-owned workflow wording**

```js
// project-agent/__tests__/scaffold-package.test.mjs

test('scaffolded Claude packet teaches only the shell-less command paths', async (t) => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-shellless-packet-'));
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  writeProjectAgentScaffoldPackage(projectRoot, { frameworkRoot: process.cwd() });

  const claudeContent = readFileSync(resolve(projectRoot, '.claude', 'CLAUDE.md'), 'utf8');
  const agentsContent = readFileSync(resolve(projectRoot, '.claude', 'AGENTS.md'), 'utf8');
  const newDeckSkill = readFileSync(resolve(projectRoot, '.claude', 'skills', 'new-deck', 'SKILL.md'), 'utf8');

  assert.doesNotMatch(claudeContent, /application-prepared workflow context/i);
  assert.doesNotMatch(agentsContent, /npm run (new|check|finalize|export|capture)/);
  assert.match(agentsContent, /node \.presentation\/framework-cli\.mjs audit all/);
  assert.match(newDeckSkill, /presentation init --project/);
  assert.doesNotMatch(newDeckSkill, /npm run new/);
  assert.doesNotMatch(newDeckSkill, /npm run setup/);
});
```

- [ ] **Step 3: Run the targeted tests to confirm failure**

Run: `node --test project-agent/__tests__/scaffold-package.test.mjs framework/runtime/__tests__/project-hook-cli.test.mjs`
Expected: FAIL because the hook still resolves `framework/application/project-hook-service.mjs`, scaffold docs still mention application-owned workflows, and `new-deck` still teaches `npm run new` / `npm run setup`.

- [ ] **Step 4: Replace the stop hook with a direct call to the local shim and remove git checkpointing from the hook path**

```js
// project-agent/project-dot-claude/hooks/run-presentation-stop-workflow.mjs
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

let input = '';
for await (const chunk of process.stdin) input += chunk;

let parsed;
try {
  parsed = JSON.parse(input);
} catch {
  process.exit(0);
}

const projectRoot = parsed?.cwd || process.cwd();
const result = spawnSync(
  process.execPath,
  ['.presentation/framework-cli.mjs', 'audit', 'all', '--format', 'json'],
  { cwd: projectRoot, encoding: 'utf8' }
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
```

```json
// project-agent/project-dot-claude/settings.json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/run-presentation-stop-workflow.mjs",
            "timeout": 15,
            "statusMessage": "Running presentation audit via the local project CLI…"
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 5: Rewrite the scaffold docs and skills around `presentation ...` and `node .presentation/framework-cli.mjs ...` only**

```md
# project-agent/project-claude-md.md
# Claude Adapter

Read `AGENTS.md` in this directory first.

This `.claude/` directory is a protected Claude adapter layer for a shell-less presentation project.
It does not define package truth.
Use it to:
- read Claude-specific operating guidance
- run thin local hooks
- invoke local skills when explicitly needed

The package surface is the CLI:
- `presentation ...` when using the installed package
- `node .presentation/framework-cli.mjs ...` inside a project
```

```md
# project-agent/project-dot-claude/skills/new-deck/SKILL.md
Choose a good absolute folder path and run:
presentation init --project /abs/path-to-project

If you want a different initial size within the supported v1 range, use:
presentation init --project /abs/path-to-project --slides <count>

After init:
- read /abs/path-to-project/.claude/AGENTS.md first
- use node .presentation/framework-cli.mjs inspect
- use node .presentation/framework-cli.mjs status
- use node .presentation/framework-cli.mjs audit all
- use node .presentation/framework-cli.mjs preview open
- use node .presentation/framework-cli.mjs finalize
```

- [ ] **Step 6: Re-run the targeted tests**

Run: `node --test project-agent/__tests__/scaffold-package.test.mjs framework/runtime/__tests__/project-hook-cli.test.mjs`
Expected: PASS with CLI-only project hooks and scaffold docs that teach only the shell-less package surface.

- [ ] **Step 7: Commit**

```bash
git add project-agent/project-agents-md.md project-agent/project-claude-md.md \
  project-agent/project-dot-claude/settings.json \
  project-agent/project-dot-claude/hooks/run-presentation-stop-workflow.mjs \
  project-agent/project-dot-claude/rules/framework.md \
  project-agent/project-dot-claude/rules/authoring-rules.md \
  project-agent/project-dot-claude/rules/file-boundaries.md \
  project-agent/project-dot-claude/skills/new-deck/SKILL.md \
  project-agent/project-dot-claude/skills/fix-validation-issues/SKILL.md \
  project-agent/project-dot-claude/skills/review-visual-presentation/SKILL.md \
  project-agent/project-dot-claude/skills/review-narrative-presentation/SKILL.md \
  project-agent/project-dot-claude/skills/apply-visual-review-changes/SKILL.md \
  project-agent/project-dot-claude/skills/apply-narrative-review-changes/SKILL.md \
  project-agent/__tests__/scaffold-package.test.mjs \
  framework/runtime/__tests__/project-hook-cli.test.mjs
git commit -m "refactor: make project scaffold cli-only and shell-less"
```

---

### Task 3: Delete the shell/application layer and the framework-owned agent launcher surface

**Files:**
- Delete: `framework/application/`
- Delete: `project-agent/agent-capabilities.mjs`
- Delete: `project-agent/agent-launcher.mjs`
- Delete: `project-agent/__tests__/agent-launcher.test.mjs`
- Modify: `package.json`
- Create: `framework/runtime/__tests__/shellless-public-surface.test.mjs`
- Create: `framework/runtime/__tests__/shellless-package-integration.test.mjs`

- [ ] **Step 1: Add a failing public-surface test that asserts the shell/application and agent-launch surfaces are gone**

```js
// framework/runtime/__tests__/shellless-public-surface.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = process.cwd();

test('repo no longer ships the shell/application layer or framework-owned agent launcher', () => {
  assert.equal(existsSync(resolve(REPO_ROOT, 'framework', 'application')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'project-agent', 'agent-launcher.mjs')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'project-agent', 'agent-capabilities.mjs')), false);
});
```

- [ ] **Step 2: Add a replacement runtime-first integration test before deleting the old application tests**

```js
// framework/runtime/__tests__/shellless-package-integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

function fillBrief(projectRoot) {
  writeFileSync(resolve(projectRoot, 'brief.md'), '# Shell-less Package\n\n## Goal\n\nDemo.\n\n## Audience\n\nMaintainers.\n\n## Tone\n\nConcise.\n\n## Must Include\n\n- One slide\n\n## Constraints\n\n- none\n\n## Open Questions\n\n- none\n');
}

test('runtime CLI can init, audit, and finalize without framework/application or Electron', async (t) => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'pf-shellless-e2e-'));
  const projectRoot = resolve(workspaceRoot, 'deck');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  const initResult = spawnSync(process.execPath, ['framework/runtime/presentation-cli.mjs', 'init', '--project', projectRoot, '--format', 'json'], { cwd: process.cwd(), encoding: 'utf8' });
  assert.equal(initResult.status, 0, initResult.stderr);

  fillBrief(projectRoot);

  const auditResult = spawnSync(process.execPath, ['.presentation/framework-cli.mjs', 'audit', 'all', '--format', 'json'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(auditResult.status, 0, auditResult.stderr);

  const finalizeResult = spawnSync(process.execPath, ['.presentation/framework-cli.mjs', 'finalize', '--format', 'json'], { cwd: projectRoot, encoding: 'utf8' });
  assert.equal(finalizeResult.status, 0, finalizeResult.stderr);

  const metadata = JSON.parse(readFileSync(resolve(projectRoot, '.presentation', 'project.json'), 'utf8'));
  assert.equal(!!readFileSync(resolve(projectRoot, `${metadata.projectSlug}.pdf`)).subarray(0, 4).toString().match(/^%PDF$/), true);
});
```

- [ ] **Step 3: Run the targeted tests to confirm failure before deleting code**

Run: `node --test framework/runtime/__tests__/shellless-public-surface.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs`
Expected: FAIL because `framework/application/` still exists, the framework-owned agent launcher files still exist, and the replacement integration test still overlaps with the old shell/application structure.

- [ ] **Step 4: Delete the shell/application layer and the framework-owned agent launcher files**

```bash
git rm -r framework/application
git rm project-agent/agent-capabilities.mjs project-agent/agent-launcher.mjs project-agent/__tests__/agent-launcher.test.mjs
```

- [ ] **Step 5: Remove the deleted tests from `package.json` and replace them with the runtime-first tests**

```json
// package.json
{
  "scripts": {
    "test": "node --test framework/canvas/__tests__/canvas-contract.test.mjs framework/runtime/__tests__/deck-policy.test.mjs framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/preview-state-page.test.mjs framework/runtime/__tests__/preview-server.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/presentation-core-boundary.test.mjs framework/runtime/__tests__/presentation-package.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs framework/runtime/__tests__/project-state.test.mjs framework/runtime/__tests__/status-service.test.mjs framework/runtime/__tests__/structural-compiler.test.mjs framework/runtime/__tests__/project-hook-cli.test.mjs framework/runtime/__tests__/shellless-public-surface.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs project-agent/__tests__/scaffold-package.test.mjs"
  }
}
```

- [ ] **Step 6: Re-run the targeted tests**

Run: `node --test framework/runtime/__tests__/shellless-public-surface.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs`
Expected: PASS with no `framework/application/` layer and no framework-owned agent launcher surface left in the repository.

- [ ] **Step 7: Commit**

```bash
git add package.json framework/runtime/__tests__/shellless-public-surface.test.mjs \
  framework/runtime/__tests__/shellless-package-integration.test.mjs
git commit -m "refactor: remove shell application and agent launcher layers"
```

---

### Task 4: Delete Electron and the shell-only terminal/operator stack, then prune package dependencies

**Files:**
- Delete: `electron/`
- Delete: `framework/runtime/terminal-core.mjs`
- Delete: `framework/runtime/terminal-events.mjs`
- Delete: `framework/runtime/pty-bridge.py`
- Delete: `framework/runtime/__tests__/terminal-core.test.mjs`
- Modify: `package.json`
- Modify: `framework/runtime/runtime-app.js`
- Modify: `framework/canvas/__tests__/canvas-contract.test.mjs`
- Modify: `framework/runtime/__tests__/preview-server.test.mjs`

- [ ] **Step 1: Extend the public-surface test to fail until Electron and terminal/operator code are gone**

```js
// framework/runtime/__tests__/shellless-public-surface.test.mjs

test('repo no longer ships Electron or terminal/operator dependencies', () => {
  const packageJson = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'));

  assert.equal(existsSync(resolve(REPO_ROOT, 'electron')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'framework', 'runtime', 'terminal-core.mjs')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'framework', 'runtime', 'terminal-events.mjs')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'framework', 'runtime', 'pty-bridge.py')), false);
  assert.equal('electron' in (packageJson.devDependencies || {}), false);
  assert.equal('node-pty' in (packageJson.dependencies || {}), false);
  assert.equal('xterm' in (packageJson.dependencies || {}), false);
  assert.equal('ws' in (packageJson.dependencies || {}), false);
});
```

- [ ] **Step 2: Run the targeted tests to confirm failure**

Run: `node --test framework/runtime/__tests__/shellless-public-surface.test.mjs framework/canvas/__tests__/canvas-contract.test.mjs framework/runtime/__tests__/preview-server.test.mjs`
Expected: FAIL because Electron files still exist, terminal/operator code still exists, `package.json` still depends on Electron/xterm/node-pty/ws, and current tests still reference Electron preview-shell files.

- [ ] **Step 3: Delete the shell and terminal/operator stack and prune dependencies**

```bash
git rm -r electron
git rm framework/runtime/terminal-core.mjs framework/runtime/terminal-events.mjs framework/runtime/pty-bridge.py framework/runtime/__tests__/terminal-core.test.mjs
```

```json
// package.json
{
  "dependencies": {
    "express": "^4.21.0",
    "pdf-lib": "^1.17.1",
    "playwright": "^1.58.2"
  }
}
```

- [ ] **Step 4: Remove the last Electron-specific message and update canvas coverage to assert against runtime output instead**

```js
// framework/runtime/runtime-app.js
app.get('/', (req, res) => {
  res.status(404).type('text/plain').send('Use the presentation CLI or /preview/ for shell-less preview.');
});
```

```js
// framework/canvas/__tests__/canvas-contract.test.mjs
import { renderPresentationHtml } from '../../runtime/deck-assemble.js';

// Replace the old electron/preview-document-shell.mjs assertion block with:
const rendered = renderPresentationHtml({ projectRoot: projectRootAbs });
assert.match(rendered.html, /section[^>]+data-slide/);
assert.doesNotMatch(rendered.html, /runtime-export-bar/);
```

- [ ] **Step 5: Re-run the targeted tests**

Run: `node --test framework/runtime/__tests__/shellless-public-surface.test.mjs framework/canvas/__tests__/canvas-contract.test.mjs framework/runtime/__tests__/preview-server.test.mjs`
Expected: PASS with Electron removed, shell-only runtime terminal code removed, dependencies pruned, and runtime preview tests no longer referencing Electron files.

- [ ] **Step 6: Commit**

```bash
git add package.json framework/runtime/runtime-app.js framework/canvas/__tests__/canvas-contract.test.mjs \
  framework/runtime/__tests__/preview-server.test.mjs framework/runtime/__tests__/shellless-public-surface.test.mjs
git commit -m "refactor: remove electron and shell-only terminal stack"
```

---

### Task 5: Remove the legacy wrapper CLIs, tighten the runtime CLI contract, and leave one official command language only

**Files:**
- Delete: `framework/runtime/check-deck.mjs`
- Delete: `framework/runtime/deck-capture.mjs`
- Delete: `framework/runtime/export-pdf.mjs`
- Delete: `framework/runtime/finalize-deck.mjs`
- Modify: `framework/runtime/presentation-cli.mjs`
- Modify: `framework/runtime/presentation-core.mjs`
- Modify: `package.json`
- Test: `framework/runtime/__tests__/presentation-cli.test.mjs`
- Test: `framework/runtime/__tests__/shellless-public-surface.test.mjs`
- Test: `framework/runtime/__tests__/shellless-package-integration.test.mjs`

- [ ] **Step 1: Add failing CLI tests for the shell-less public contract**

```js
// framework/runtime/__tests__/presentation-cli.test.mjs

test('finalize is its own command and rejects export-only flags', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);

  const result = await runPresentationCli(['finalize', '--project', projectRoot, '--output-dir', 'outputs/manual', '--format', 'json']);
  const json = JSON.parse(result.stdout);

  assert.equal(result.exitCode, 4);
  assert.equal(json.status, 'invalid-args');
  assert.match(json.summary, /Finalize does not accept --output-dir, --output-file, or --slide/);
});

test('audit envelope reports evidence separately from nextFocus', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  writeFileSync(resolve(projectRoot, 'theme.css'), '@layer theme { :root { --slide-max-w: 960px; } }\n');

  const result = await runPresentationCli(['audit', 'theme', '--project', projectRoot, '--format', 'json']);
  const json = JSON.parse(result.stdout);

  assert.deepEqual(json.nextFocus, ['theme.css']);
  assert.deepEqual(json.evidence, ['theme.css']);
});
```

```js
// framework/runtime/__tests__/shellless-public-surface.test.mjs

test('repo no longer ships legacy wrapper CLIs or product npm shortcuts', () => {
  const packageJson = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'));

  assert.equal(existsSync(resolve(REPO_ROOT, 'framework', 'runtime', 'check-deck.mjs')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'framework', 'runtime', 'deck-capture.mjs')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'framework', 'runtime', 'export-pdf.mjs')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'framework', 'runtime', 'finalize-deck.mjs')), false);
  assert.equal('new' in packageJson.scripts, false);
  assert.equal('check' in packageJson.scripts, false);
  assert.equal('capture' in packageJson.scripts, false);
  assert.equal('export' in packageJson.scripts, false);
  assert.equal('finalize' in packageJson.scripts, false);
  assert.equal('start' in packageJson.scripts, false);
  assert.equal('operator' in packageJson.scripts, false);
});
```

- [ ] **Step 2: Run the targeted tests to confirm failure**

Run: `node --test framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/shellless-public-surface.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs`
Expected: FAIL because legacy wrapper files still exist, product npm shortcut scripts still exist, `finalize` still piggybacks on export parsing, and the CLI still conflates invalid args with unsupported commands.

- [ ] **Step 3: Delete the wrapper CLIs and make `presentation-cli.mjs` the full shell-less contract**

```bash
git rm framework/runtime/check-deck.mjs framework/runtime/deck-capture.mjs framework/runtime/export-pdf.mjs framework/runtime/finalize-deck.mjs
```

```js
// framework/runtime/presentation-cli.mjs
const EXIT_CODE_OK = 0;
const EXIT_CODE_VIOLATIONS = 1;
const EXIT_CODE_ERROR = 2;
const EXIT_CODE_UNSUPPORTED = 3;
const EXIT_CODE_INVALID_ARGS = 4;

class CliError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CliError';
    this.exitCode = options.exitCode ?? EXIT_CODE_INVALID_ARGS;
    this.status = options.status ?? 'invalid-args';
    this.extra = options.extra ?? {};
  }
}

async function runFinalizeCommand(parsed, command, core) {
  if (parsed.positionals.length > 0 || parsed.slideIds.length > 0 || parsed.outputDir || parsed.outputFile) {
    throw new CliError('Finalize does not accept --output-dir, --output-file, or --slide. Use presentation export for alternate export destinations.');
  }

  const result = await core.finalize(parsed.projectRoot);
  return finalizeResult({
    command,
    status: result.status,
    summary: result.status === 'pass' ? 'Presentation finalized.' : 'Presentation finalize completed with issues.',
    outputs: result.outputs,
    evidenceUpdated: result.evidenceUpdated,
    issues: result.issues,
  }, parsed.format, result.status === 'fail' ? EXIT_CODE_VIOLATIONS : EXIT_CODE_OK);
}

async function runAuditCommand(parsed, command, core) {
  const result = await core.runAudit(parsed.projectRoot, {/* existing request */});
  return finalizeResult({
    command,
    status: result.status,
    family: result.family,
    scope: { projectRoot: result.projectRoot, slideId: result.slideId },
    summary: summarizeAuditResult(result),
    issueCount: result.issueCount,
    issues: result.issues,
    nextFocus: result.nextFocus,
    evidence: result.evidence || result.nextFocus,
    freshness: { relativeToSource: 'current' },
  }, parsed.format, result.status === 'fail' ? EXIT_CODE_VIOLATIONS : EXIT_CODE_OK);
}
```

- [ ] **Step 4: Strip `package.json` down to maintainer scripts only**

```json
// package.json
{
  "scripts": {
    "setup": "node framework/runtime/setup.mjs",
    "test": "node --test framework/canvas/__tests__/canvas-contract.test.mjs framework/runtime/__tests__/deck-policy.test.mjs framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/preview-state-page.test.mjs framework/runtime/__tests__/preview-server.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/presentation-core-boundary.test.mjs framework/runtime/__tests__/presentation-package.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs framework/runtime/__tests__/project-state.test.mjs framework/runtime/__tests__/status-service.test.mjs framework/runtime/__tests__/structural-compiler.test.mjs framework/runtime/__tests__/project-hook-cli.test.mjs framework/runtime/__tests__/shellless-public-surface.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs project-agent/__tests__/scaffold-package.test.mjs"
  }
}
```

- [ ] **Step 5: Re-run the targeted tests**

Run: `node --test framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/shellless-public-surface.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs`
Expected: PASS with wrapper CLIs deleted, finalize owning its own semantics, audit evidence corrected, and product npm shortcuts gone.

- [ ] **Step 6: Commit**

```bash
git add package.json framework/runtime/presentation-cli.mjs framework/runtime/presentation-core.mjs \
  framework/runtime/__tests__/presentation-cli.test.mjs \
  framework/runtime/__tests__/shellless-public-surface.test.mjs \
  framework/runtime/__tests__/shellless-package-integration.test.mjs
git commit -m "refactor: remove legacy wrappers and tighten cli contract"
```

---

### Task 6: Rewrite the repo docs around the shell-less package product and run the full suite

**Files:**
- Modify: `README.md`
- Modify: `START-HERE.md`
- Modify: `docs/repo-architecture-overview.md`
- Modify: `docs/repo-architecture-index.md`
- Modify: `docs/repo-call-flows.md`
- Modify: `docs/repo-trace-project-creation.md`
- Modify: `docs/prd-human-agent.md`
- Delete: `docs/electron-operator-agent-playbook.md`
- Delete: `docs/electron-operator-cli.md`
- Delete: `docs/electron-operator-guide.md`
- Test: `framework/runtime/__tests__/shellless-public-surface.test.mjs`
- Test: full `npm test`

- [ ] **Step 1: Add a failing doc-surface assertion before rewriting the docs**

```js
// framework/runtime/__tests__/shellless-public-surface.test.mjs

test('top-level docs describe the shell-less package rather than the Electron app', () => {
  const readme = readFileSync(resolve(REPO_ROOT, 'README.md'), 'utf8');
  const startHere = readFileSync(resolve(REPO_ROOT, 'START-HERE.md'), 'utf8');

  assert.doesNotMatch(readme, /Electron-native|npm run start|desktop app/i);
  assert.doesNotMatch(startHere, /desktop app workflow|Click New|Click Open/i);
  assert.equal(existsSync(resolve(REPO_ROOT, 'docs', 'electron-operator-agent-playbook.md')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'docs', 'electron-operator-cli.md')), false);
  assert.equal(existsSync(resolve(REPO_ROOT, 'docs', 'electron-operator-guide.md')), false);
});
```

- [ ] **Step 2: Run the assertion to confirm failure**

Run: `node --test framework/runtime/__tests__/shellless-public-surface.test.mjs`
Expected: FAIL because the README/Start Here docs still market the Electron app and the old Electron docs still exist.

- [ ] **Step 3: Rewrite the top-level docs around the shell-less product**

```md
# README.md
# Goquest Presentation Package

Shell-less presentation package with:
- `presentation init`
- `presentation inspect`
- `presentation status`
- `presentation audit`
- `presentation preview open|serve`
- `presentation export`
- `presentation finalize`

Each initialized project contains:
- authored source at project root
- package machinery in `.presentation/`
- protected Claude adapter files in `/.claude/`
- a local shim at `.presentation/framework-cli.mjs`
```

```md
# START-HERE.md
# Start Here

1. Install the `presentation` package.
2. Run `presentation init --project /abs/path`.
3. Enter the project folder.
4. Use `node .presentation/framework-cli.mjs status` and `node .presentation/framework-cli.mjs audit all` while authoring.
5. Use `node .presentation/framework-cli.mjs preview open` to inspect the deck.
6. Use `node .presentation/framework-cli.mjs finalize` to write the canonical root PDF.
```

- [ ] **Step 4: Delete the obsolete Electron docs and rewrite the repo architecture docs to match the new shape**

```bash
git rm docs/electron-operator-agent-playbook.md docs/electron-operator-cli.md docs/electron-operator-guide.md
```

```md
# docs/repo-architecture-overview.md
## What this repository is

This repository is a shell-less presentation package product.

It provides:
- a runtime/core package
- a canonical CLI
- project scaffolding
- deterministic preview, audit, export, and finalize flows
- a protected `/.claude/*` scaffold for project-local agent guidance

It does not currently ship an Electron shell.
```

- [ ] **Step 5: Run the full test suite and one manual shell-less smoke**

Run: `npm test`
Expected: PASS with only runtime/canvas/project-agent scaffold tests remaining.

Run:
```bash
TMP_ROOT=$(mktemp -d)
node framework/runtime/presentation-cli.mjs init --project "$TMP_ROOT/demo" --format json
node "$TMP_ROOT/demo/.presentation/framework-cli.mjs" status --format json
node "$TMP_ROOT/demo/.presentation/framework-cli.mjs" preview serve --format json
```
Expected:
- init exits 0 and creates `.presentation/`, `.claude/`, and `.git`
- status exits 0 with a structured JSON envelope
- preview serve exits 0 and reports a `previewUrl`

- [ ] **Step 6: Commit**

```bash
git add README.md START-HERE.md docs/repo-architecture-overview.md docs/repo-architecture-index.md \
  docs/repo-call-flows.md docs/repo-trace-project-creation.md docs/prd-human-agent.md \
  framework/runtime/__tests__/shellless-public-surface.test.mjs
git commit -m "docs: rewrite repo around shell-less package product"
```

---

## Self-Review

### Spec coverage
- **Shell-less product only:** covered by Tasks 3, 4, 5, and 6 deleting `framework/application/`, `electron/`, terminal/operator code, wrapper CLIs, product npm shortcuts, and shell docs.
- **Canonical runtime CLI:** covered by Task 1 and Task 5.
- **Full core-owned `init`:** covered by Task 1.
- **Protected `/.claude/*` scaffold preserved:** covered by Tasks 1 and 2.
- **Thin CLI-only hooks:** covered by Task 2.
- **No framework-owned agent launch/orchestration:** covered by Task 3.
- **One official command language only:** covered by Task 5 and Task 6.
- **Git setup remains in `init`:** covered by Task 1.
- **Breaking change posture:** reflected across deletion tasks instead of compatibility wrappers.

### Placeholder scan
- No `TBD`, `TODO`, or “implement later” placeholders remain.
- Every task lists exact files and concrete test commands.
- Code-changing steps include concrete code or command blocks.

### Type/signature consistency
- Canonical public CLI path is consistently `framework/runtime/presentation-cli.mjs`.
- Project-local entrypoint is consistently `node .presentation/framework-cli.mjs ...`.
- `init` consistently means full project creation, including `/.claude/*` and git setup.
- Hooks consistently call the local shim instead of importing `framework/application/project-hook-service.mjs`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-18-shell-less-hard-cleanup.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
