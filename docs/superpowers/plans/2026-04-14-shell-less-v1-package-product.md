# Shell-less V1 Package Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the rebuilt presentation core into the documented shell-less v1 product: installed core + CLI, project-local shim, Claude-first scaffold, shell-less preview, and root-level PDF delivery.

**Architecture:** Keep the protected `presentation-core` seam as the only semantic authority, then rework the outer layers around it: project metadata, scaffold/init, local shim, CLI routing, delivery paths, and Claude adapter scaffolding. Remove the old copied-framework, `outline.md`, `outputs/`, `check`/`capture`, and Electron-first assumptions from the initialized-project product while preserving targeted compatibility only where it reduces migration risk.

**Tech Stack:** Node.js ESM, package `bin` + `exports`, Playwright-backed preview/export runtime, existing `presentation-core` facade, project-agent scaffold package, Node test runner.

---

## File Structure / Responsibility Map

### Core path + metadata contract
- Modify: `framework/runtime/deck-paths.js`
  - Own the minimal v1 `project.json` shape.
  - Stop emitting `historyPolicy`, copied-framework state, and `outputs/*` path contracts for new projects.
  - Add root-level default PDF path helpers.
- Modify: `framework/runtime/project-tree.js`
  - Reclassify root PDF as deliverable and remove `outputs/` assumptions.

### Project-local shim + scaffold
- Modify: `framework/runtime/project-cli-shim.mjs`
  - Make `.presentation/framework-cli.mjs` inject `--project <root>` and delegate to the installed package via normal package resolution.
- Modify: `framework/runtime/services/scaffold-service.mjs`
  - Scaffold the shell-less v1 project shape: 3 starter slides, no `outline.md`, no `outputs/`, no copied framework snapshot.
- Modify: `framework/application/project-scaffold-service.mjs`
  - Keep git initialization, but route all created file accounting through the new scaffold shape.
- Modify: `framework/application/new-project.mjs`
  - Keep this as a repo-maintainer wrapper while aligning output/help text with `presentation init`.
- Modify: `project-agent/scaffold-package.mjs`
  - Write the full protected Claude packet under `/.claude/`, including `/.claude/AGENTS.md`.
- Modify: `package.json`
  - Add package `bin`/`exports` so the installed system exposes `presentation` and the local shim can resolve it without absolute paths.

### CLI + core seam
- Modify: `framework/runtime/presentation-core.mjs`
  - Add explicit init + preview methods and simplify export/finalize semantics.
- Modify: `framework/runtime/presentation-cli.mjs`
  - Support `init`, `preview open`, `preview serve`, `export`, and `finalize` alias semantics.
- Create: `framework/runtime/preview-server.mjs`
  - Hold long-running shell-less preview serving/open behavior instead of overloading one-shot helpers.

### Delivery + runtime evidence
- Modify: `framework/runtime/services/presentation-ops-service.mjs`
  - Write only the root PDF for v1 exports.
- Modify: `framework/runtime/presentation-runtime-state.js`
  - Simplify artifact records to root-PDF semantics while keeping read compatibility where practical.
- Modify: `framework/runtime/export-pdf.mjs`
  - Make legacy wrapper call the v1 export contract.
- Modify: `framework/runtime/finalize-deck.mjs`
  - Make legacy wrapper a thin alias over export.
- Modify: `framework/runtime/check-deck.mjs`
  - Keep legacy compatibility wrapper mapped onto `audit` + `status`.

### Application + status consumers
- Modify: `framework/runtime/status-service.js`
  - Replace `outline.md`, `outputs/finalized`, and `presentation finalize` focus hints with the v1 language.
- Modify: `framework/runtime/project-state.js`
  - Recompute workflow derivation against root-PDF delivery.
- Modify: `framework/application/project-query-service.mjs`
  - Remove `historyPolicy` dependence from the exposed project view.
- Modify: `framework/application/action-service.mjs`
  - Update file cards / prompts that still mention `outline.md` or old delivery paths.
- Modify: `framework/application/project-hook-service.mjs`
  - Remove `historyPolicy` branching now that git remains agent-internal only.

### Claude-first scaffold docs
- Modify: `project-agent/project-agents-md.md`
- Modify: `project-agent/project-claude-md.md`
- Modify: `project-agent/project-dot-claude/rules/authoring-rules.md`
- Modify: `project-agent/project-dot-claude/rules/file-boundaries.md`
- Modify: `project-agent/project-dot-claude/rules/framework.md`
- Modify: `project-agent/project-dot-claude/skills/new-deck/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/fix-validation-issues/SKILL.md`

### Verification coverage
- Modify: `framework/runtime/__tests__/deck-paths-project-only.test.mjs`
- Modify: `framework/runtime/__tests__/presentation-package.test.mjs`
- Modify: `framework/runtime/__tests__/presentation-runtime-state.test.mjs`
- Modify: `framework/runtime/__tests__/presentation-core.test.mjs`
- Modify: `framework/runtime/__tests__/presentation-cli.test.mjs`
- Create: `framework/runtime/__tests__/preview-server.test.mjs`
- Modify: `framework/runtime/services/__tests__/runtime-services.test.mjs`
- Modify: `framework/application/__tests__/project-query-service.test.mjs`
- Modify: `framework/application/__tests__/action-service.test.mjs`
- Modify: `framework/application/__tests__/action-workflow-service.test.mjs`
- Modify: `framework/application/__tests__/project-hook-service.test.mjs`
- Modify: `framework/application/__tests__/presentation-package-integration.test.mjs`
- Create: `project-agent/__tests__/scaffold-package.test.mjs`

---

### Task 1: Replace the project metadata + path contract with the shell-less v1 model

**Files:**
- Modify: `framework/runtime/deck-paths.js`
- Modify: `framework/runtime/project-tree.js`
- Test: `framework/runtime/__tests__/deck-paths-project-only.test.mjs`
- Test: `framework/runtime/__tests__/presentation-package.test.mjs`

- [ ] **Step 1: Write the failing deck-path contract test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createProjectScaffold } from '../../application/project-scaffold-service.mjs';
import { getProjectPaths, readProjectMetadata, getSuggestedPdfName } from '../deck-paths.js';

test('shell-less v1 project metadata and paths prefer root-pdf delivery', () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-shellless-paths-'));
  createProjectScaffold({ projectRoot }, { slideCount: 3 });

  const paths = getProjectPaths(projectRoot);
  const metadata = readProjectMetadata(projectRoot);

  assert.equal(paths.rootPdfRel, `${metadata.projectSlug}.pdf`);
  assert.equal(getSuggestedPdfName({ projectRootAbs: projectRoot }), `${metadata.projectSlug}.pdf`);
  assert.equal(metadata.projectSchemaVersion, 1);
  assert.equal(metadata.createdWithCoreVersion, metadata.frameworkVersion);
  assert.ok(!('historyPolicy' in metadata));
  assert.ok(!('frameworkSource' in metadata));
  assert.ok(!('frameworkMode' in metadata));
});
```

- [ ] **Step 2: Run the targeted tests to confirm failure**

Run: `node --test framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/presentation-package.test.mjs`
Expected: FAIL because current metadata still emits `historyPolicy` / `frameworkSource` and current path helpers still prefer `outputs/*` delivery.

- [ ] **Step 3: Implement the minimal metadata + path rewrite**

```js
function buildDefaultProjectMetadata(projectRootAbs) {
  const projectSlug = slugifyProjectName(basename(projectRootAbs));
  return {
    projectMode: 'project-folder',
    projectName: slugToTitle(projectSlug),
    projectSlug,
    projectSchemaVersion: 1,
    createdWithCoreVersion: FRAMEWORK_VERSION,
    frameworkVersion: FRAMEWORK_VERSION,
    canvasPolicy: 'protected',
  };
}

export function getProjectPaths(projectRootInput) {
  // ...existing normalized project root setup...
  return {
    // existing source + .presentation paths
    rootPdfRel: `${metadata.projectSlug}.pdf`,
    rootPdfAbs: resolve(ref.projectRootAbs, `${metadata.projectSlug}.pdf`),
    claudeDirRel: '.claude',
    claudeDirAbs: resolve(ref.projectRootAbs, '.claude'),
  };
}
```

- [ ] **Step 4: Reclassify the project tree**

```js
const ROOT_SPECIAL_FILES = new Set(['brief.md', 'theme.css']);

function classifyProjectPath(relativePath, paths) {
  if (relativePath === paths.rootPdfRel) return 'deliverable';
  if (relativePath.startsWith('.presentation/')) return 'system';
  if (relativePath.startsWith('.claude/')) return 'adapter';
  if (ROOT_SPECIAL_FILES.has(relativePath) || relativePath.startsWith('slides/')) return 'source';
  return 'other';
}
```

- [ ] **Step 5: Run the targeted tests again**

Run: `node --test framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/presentation-package.test.mjs`
Expected: PASS with root-PDF path helpers and minimal metadata for freshly scaffolded projects.

- [ ] **Step 6: Commit**

```bash
git add framework/runtime/deck-paths.js framework/runtime/project-tree.js \
  framework/runtime/__tests__/deck-paths-project-only.test.mjs \
  framework/runtime/__tests__/presentation-package.test.mjs
git commit -m "refactor: align project metadata and paths with shell-less v1"
```

---

### Task 2: Rewrite scaffold + local shim around installed-package resolution

**Files:**
- Modify: `framework/runtime/project-cli-shim.mjs`
- Modify: `framework/runtime/services/scaffold-service.mjs`
- Modify: `framework/application/project-scaffold-service.mjs`
- Modify: `framework/application/new-project.mjs`
- Modify: `project-agent/scaffold-package.mjs`
- Modify: `package.json`
- Test: `framework/runtime/services/__tests__/runtime-services.test.mjs`
- Test: `project-agent/__tests__/scaffold-package.test.mjs`

- [ ] **Step 1: Write the failing scaffold layout test**

```js
test('shell-less v1 scaffold creates 3 starter slides, shim, and claude packet', async () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-shellless-scaffold-'));
  const result = createProjectScaffold({ projectRoot }, { slideCount: 3 });

  assert.deepEqual(result.files.filter((file) => file.endsWith('slide.html')).sort(), [
    'slides/010-intro/slide.html',
    'slides/020-slide-02/slide.html',
    'slides/030-close/slide.html',
  ]);
  assert.ok(result.files.includes('.presentation/framework-cli.mjs'));
  assert.ok(result.files.includes('.claude/settings.json'));
  assert.ok(result.files.includes('.claude/AGENTS.md'));
  assert.ok(result.files.includes('.claude/CLAUDE.md'));
  assert.ok(!result.files.includes('outline.md'));
  assert.ok(!result.files.includes('outputs/'));
});
```

- [ ] **Step 2: Write the failing shim resolution test**

```js
test('project shim injects project root and delegates through package resolution', async () => {
  const source = renderProjectFrameworkCliSource();
  assert.match(source, /from 'pitch-framework\/presentation-cli'/);
  assert.match(source, /'--project', projectRoot/);
  assert.doesNotMatch(source, /frameworkSource/);
  assert.doesNotMatch(source, /execFileSync/);
});
```

- [ ] **Step 3: Run the scaffold-focused tests to confirm failure**

Run: `node --test framework/runtime/services/__tests__/runtime-services.test.mjs project-agent/__tests__/scaffold-package.test.mjs`
Expected: FAIL because scaffold still creates `outputs/`, may create `outline.md`, and the shim still resolves through `frameworkSource` absolute paths.

- [ ] **Step 4: Add package `bin` + `exports` for installed resolution**

```json
{
  "name": "pitch-framework",
  "type": "module",
  "bin": {
    "presentation": "./framework/runtime/presentation-cli.mjs"
  },
  "exports": {
    ".": "./framework/runtime/presentation-core.mjs",
    "./presentation-cli": "./framework/runtime/presentation-cli.mjs"
  }
}
```

- [ ] **Step 5: Rewrite the project-local shim template**

```js
export function renderProjectFrameworkCliSource() {
  return `#!/usr/bin/env node
import { runPresentationCli } from 'pitch-framework/presentation-cli';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const shimDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(shimDir, '..');
const result = await runPresentationCli([
  ...process.argv.slice(2),
  '--project',
  projectRoot,
]);
process.stdout.write(result.stdout);
process.exit(result.exitCode);
`;
}
```

- [ ] **Step 6: Rewrite scaffold defaults to the v1 project shape**

```js
function createSlidePlan(slideCount) {
  if (slideCount === 1) {
    return [{ dirName: '010-intro', templatePath: 'slides/010-hero/slide.html', slideLabel: '01' }];
  }
  if (slideCount === 2) {
    return [
      { dirName: '010-intro', templatePath: 'slides/010-hero/slide.html', slideLabel: '01' },
      { dirName: '020-close', templatePath: 'slides/030-close/slide.html', slideLabel: '02' },
    ];
  }
  if (slideCount === 3) {
    return [
      { dirName: '010-intro', templatePath: 'slides/010-hero/slide.html', slideLabel: '01' },
      { dirName: '020-slide-02', templatePath: 'slides/generic/slide.html', slideLabel: '02' },
      { dirName: '030-close', templatePath: 'slides/030-close/slide.html', slideLabel: '03' },
    ];
  }

  const slides = [];
  for (let index = 0; index < slideCount; index += 1) {
    const prefix = String((index + 1) * 10).padStart(3, '0');
    const slideLabel = String(index + 1).padStart(2, '0');
    if (index === 0) slides.push({ dirName: `${prefix}-intro`, templatePath: 'slides/010-hero/slide.html', slideLabel });
    else if (index === slideCount - 1) slides.push({ dirName: `${prefix}-close`, templatePath: 'slides/030-close/slide.html', slideLabel });
    else slides.push({ dirName: `${prefix}-slide-${slideLabel}`, templatePath: 'slides/generic/slide.html', slideLabel });
  }
  return slides;
}
```

```js
// remove outputs dir creation
// remove outline template writes
// remove copy-framework snapshot branches
```

- [ ] **Step 7: Move the Claude packet fully under `/.claude/`**

```js
const entries = [
  {
    sourceAbs: resolve(projectAgentRoot, 'project-agents-md.md'),
    targetRel: '.claude/AGENTS.md',
  },
  {
    sourceAbs: resolve(projectAgentRoot, 'project-claude-md.md'),
    targetRel: '.claude/CLAUDE.md',
  },
  {
    sourceAbs: resolve(claudeRoot, 'settings.json'),
    targetRel: '.claude/settings.json',
  },
  ...listDirectoryEntries(resolve(claudeRoot, 'hooks'), '.claude/hooks'),
  ...listDirectoryEntries(resolve(claudeRoot, 'rules'), '.claude/rules'),
  ...listDirectoryEntries(resolve(claudeRoot, 'skills'), '.claude/skills'),
];
```

- [ ] **Step 8: Keep `framework/application/new-project.mjs` as a compatibility wrapper**

```js
console.error('Usage: presentation init --project /abs/path [--slides <count>]');
console.log(JSON.stringify(createProjectScaffold(parsed.target, { slideCount: parsed.slideCount }), null, 2));
```

- [ ] **Step 9: Run the scaffold tests again**

Run: `node --test framework/runtime/services/__tests__/runtime-services.test.mjs project-agent/__tests__/scaffold-package.test.mjs`
Expected: PASS with `.presentation/framework-cli.mjs`, `/.claude/*`, no `outputs/`, and no `frameworkSource`-based shim behavior.

- [ ] **Step 10: Commit**

```bash
git add framework/runtime/project-cli-shim.mjs framework/runtime/services/scaffold-service.mjs \
  framework/application/project-scaffold-service.mjs framework/application/new-project.mjs \
  project-agent/scaffold-package.mjs package.json project-agent/__tests__/scaffold-package.test.mjs \
  framework/runtime/services/__tests__/runtime-services.test.mjs
git commit -m "feat: scaffold shell-less v1 projects with installed-package shim"
```

---

### Task 3: Extend the CLI/core seam to the real v1 surface (`init`, `preview open`, `preview serve`, `export`, `finalize` alias)

**Files:**
- Modify: `framework/runtime/presentation-core.mjs`
- Modify: `framework/runtime/presentation-cli.mjs`
- Create: `framework/runtime/preview-server.mjs`
- Test: `framework/runtime/__tests__/presentation-cli.test.mjs`
- Test: `framework/runtime/__tests__/presentation-core.test.mjs`
- Test: `framework/runtime/__tests__/preview-server.test.mjs`

- [ ] **Step 1: Write the failing CLI-family test**

```js
test('presentation CLI parses init and preview command families', () => {
  const initParsed = parsePresentationCliArgs(['init', '--project', '/tmp/example']);
  assert.equal(initParsed.family, 'init');

  const previewParsed = parsePresentationCliArgs(['preview', 'serve', '--project', '/tmp/example']);
  assert.equal(previewParsed.family, 'preview');
  assert.deepEqual(previewParsed.positionals, ['serve']);
});

test('finalize is only an alias over export in v1', async () => {
  const core = {
    exportPresentation: async () => ({ status: 'pass', artifacts: [{ path: 'deck.pdf' }], scope: { kind: 'export' } }),
  };
  const result = await runPresentationCli(['finalize', '--project', '/tmp/example', '--format', 'json'], { core });
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'pass');
  assert.equal(json.summary, 'Requested export artifacts were produced.');
});
```

- [ ] **Step 2: Run the CLI/core tests to confirm failure**

Run: `node --test framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/presentation-core.test.mjs`
Expected: FAIL because `init` and `preview` are not supported and `finalize` still has its own separate semantics.

- [ ] **Step 3: Add core methods for project init + preview**

```js
export function createPresentationCore(services = {}) {
  return {
    async initProject(projectRoot, options = {}) {
      return services.createProjectScaffold({ projectRoot }, { slideCount: options.slideCount ?? 3 });
    },
    async previewPresentation(projectRoot, options = {}) {
      return services.previewPresentation(projectRoot, options);
    },
    async exportPresentation(projectRoot, options = {}) {
      return runInsideCoreMutationBoundary(() =>
        enforceCoreAuthoredContentImmutability(projectRoot, 'export', () =>
          services.exportPresentation(projectRoot, options)
        )
      );
    },
  };
}
```

- [ ] **Step 4: Create a dedicated preview server helper**

```js
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { withRuntimeServer } from './runtime-app.js';

const execFileAsync = promisify(execFile);

export async function previewPresentation(projectRoot, { mode = 'serve' } = {}) {
  return withRuntimeServer({ projectRoot }, async ({ previewUrl }) => {
    if (mode === 'open') {
      const opener = process.platform === 'darwin'
        ? ['open', [previewUrl]]
        : process.platform === 'win32'
          ? ['cmd', ['/c', 'start', '', previewUrl]]
          : ['xdg-open', [previewUrl]];
      await execFileAsync(opener[0], opener[1]);
    }

    return {
      status: 'pass',
      previewUrl,
      summary: mode === 'open' ? 'Preview opened in the default browser.' : 'Preview server started.',
    };
  });
}
```

- [ ] **Step 5: Wire the new CLI families and alias semantics**

```js
switch (parsed.family) {
  case 'init':
    return runInitCommand(parsed, command, core);
  case 'preview':
    return runPreviewCommand(parsed, command, core);
  case 'finalize':
    return runExportCommand({ ...parsed, positionals: ['pdf'] }, command, core);
  case 'export':
    return runExportCommand(parsed, command, core);
}
```

- [ ] **Step 6: Run the CLI/core tests again**

Run: `node --test framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/preview-server.test.mjs`
Expected: PASS with `init`, `preview serve`, `preview open`, and `finalize` alias behavior.

- [ ] **Step 7: Commit**

```bash
git add framework/runtime/presentation-core.mjs framework/runtime/presentation-cli.mjs \
  framework/runtime/preview-server.mjs framework/runtime/__tests__/presentation-cli.test.mjs \
  framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/preview-server.test.mjs
git commit -m "feat: add shell-less v1 init and preview cli families"
```

---

### Task 4: Collapse delivery to root-level PDF output and simplify runtime evidence

**Files:**
- Modify: `framework/runtime/services/presentation-ops-service.mjs`
- Modify: `framework/runtime/presentation-runtime-state.js`
- Modify: `framework/runtime/export-pdf.mjs`
- Modify: `framework/runtime/finalize-deck.mjs`
- Modify: `framework/runtime/check-deck.mjs`
- Modify: `framework/runtime/presentation-core.mjs`
- Test: `framework/runtime/services/__tests__/runtime-services.test.mjs`
- Test: `framework/runtime/__tests__/presentation-runtime-state.test.mjs`
- Test: `framework/runtime/__tests__/presentation-core.test.mjs`
- Test: `framework/application/__tests__/presentation-package-integration.test.mjs`

- [ ] **Step 1: Write the failing export/evidence tests**

```js
test('export writes the default root pdf and updates simplified artifact evidence', async () => {
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-root-export-'));
  await createProjectScaffold({ projectRoot }, { slideCount: 2 });

  const result = await runPresentationCli(['export', '--project', projectRoot, '--format', 'json']);
  const json = JSON.parse(result.stdout);
  const artifacts = JSON.parse(readFileSync(resolve(projectRoot, '.presentation/runtime/artifacts.json'), 'utf8'));

  assert.equal(json.outputs.artifacts[0].path, `${basename(projectRoot)}.pdf`);
  assert.equal(artifacts.finalized.exists, true);
  assert.equal(artifacts.finalized.pdf.path, `${basename(projectRoot)}.pdf`);
  assert.equal(artifacts.latestExport.pdf.path, `${basename(projectRoot)}.pdf`);
  assert.ok(!('outputDir' in artifacts.finalized) || artifacts.finalized.outputDir === '');
  assert.equal(existsSync(resolve(projectRoot, `${basename(projectRoot)}.pdf`)), true);
});
```

- [ ] **Step 2: Run the delivery-focused tests to confirm failure**

Run: `node --test framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs framework/application/__tests__/presentation-package-integration.test.mjs`
Expected: FAIL because current export/finalize still write `outputs/finalized` / `outputs/exports` artifacts and legacy screenshot/report structures.

- [ ] **Step 3: Simplify artifact state writers while preserving read compatibility**

```js
export function createInitialArtifacts() {
  return {
    schemaVersion: 1,
    kind: 'artifacts',
    sourceFingerprint: '',
    generatedAt: null,
    finalized: { exists: false, pdf: null },
    latestExport: { exists: false, format: 'pdf', pdf: null, artifacts: [] },
  };
}

function normalizeArtifacts(payload = {}) {
  return {
    ...createInitialArtifacts(),
    ...payload,
    finalized: {
      exists: Boolean(payload.finalized?.exists),
      pdf: normalizePathRecord(payload.finalized?.pdf),
    },
    latestExport: {
      exists: Boolean(payload.latestExport?.exists),
      format: 'pdf',
      pdf: normalizePathRecord(payload.latestExport?.pdf),
      artifacts: normalizeArtifactList(payload.latestExport?.artifacts || []),
    },
  };
}
```

- [ ] **Step 4: Rewrite export/finalize delivery around the root PDF**

```js
const pdfRel = paths.rootPdfRel;
const pdfAbs = paths.rootPdfAbs;
await generatePDF({ projectRoot, outputFile: pdfAbs });

writeArtifacts(projectRoot, {
  sourceFingerprint,
  generatedAt: new Date().toISOString(),
  finalized: { exists: true, pdf: { path: pdfRel } },
  latestExport: {
    exists: true,
    format: 'pdf',
    pdf: { path: pdfRel },
    artifacts: [{ path: pdfRel }],
  },
});
```

- [ ] **Step 5: Make the legacy wrappers follow the v1 CLI contract**

```js
// finalize-deck.mjs
const result = await runPresentationCli(['finalize', '--project', parsed.target.projectRootAbs, '--format', 'json']);

// export-pdf.mjs
const result = await runPresentationCli(['export', '--project', parsed.target.projectRootAbs, '--format', 'json']);
```

- [ ] **Step 6: Run the delivery tests again**

Run: `node --test framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs framework/runtime/__tests__/presentation-core.test.mjs framework/application/__tests__/presentation-package-integration.test.mjs`
Expected: PASS with a root-level PDF and simplified runtime evidence.

- [ ] **Step 7: Commit**

```bash
git add framework/runtime/services/presentation-ops-service.mjs framework/runtime/presentation-runtime-state.js \
  framework/runtime/export-pdf.mjs framework/runtime/finalize-deck.mjs framework/runtime/check-deck.mjs \
  framework/runtime/presentation-core.mjs framework/runtime/services/__tests__/runtime-services.test.mjs \
  framework/runtime/__tests__/presentation-runtime-state.test.mjs framework/runtime/__tests__/presentation-core.test.mjs \
  framework/application/__tests__/presentation-package-integration.test.mjs
git commit -m "refactor: collapse shell-less v1 delivery to root pdf"
```

---

### Task 5: Update status + application consumers to the new workflow language

**Files:**
- Modify: `framework/runtime/status-service.js`
- Modify: `framework/runtime/project-state.js`
- Modify: `framework/application/project-query-service.mjs`
- Modify: `framework/application/action-service.mjs`
- Modify: `framework/application/project-hook-service.mjs`
- Test: `framework/application/__tests__/project-query-service.test.mjs`
- Test: `framework/application/__tests__/action-service.test.mjs`
- Test: `framework/application/__tests__/action-workflow-service.test.mjs`
- Test: `framework/application/__tests__/project-hook-service.test.mjs`

- [ ] **Step 1: Write the failing status-language tests**

```js
test('ready-for-delivery status points at export and root pdf', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'not_finalized',
    evidence: 'current',
  });

  assert.equal(status.workflow, 'ready_for_finalize');
  assert.deepEqual(status.nextFocus, ['presentation export']);
});
```

```js
test('project query meta no longer exposes historyPolicy', () => {
  const service = createProjectQueryService();
  service.openProject({ projectRoot });
  const meta = service.getMeta();
  assert.ok(!('historyPolicy' in meta));
});
```

- [ ] **Step 2: Run the application-facing tests to confirm failure**

Run: `node --test framework/application/__tests__/project-query-service.test.mjs framework/application/__tests__/action-service.test.mjs framework/application/__tests__/action-workflow-service.test.mjs framework/application/__tests__/project-hook-service.test.mjs`
Expected: FAIL because current status/project-query/action prompts still mention `outline.md`, `outputs/finalized`, or `historyPolicy`.

- [ ] **Step 3: Rewrite status derivation**

```js
function buildNextFocus(workflow, facets, rootPdfRel = '<project>.pdf') {
  switch (workflow) {
    case 'onboarding':
      return ['brief.md', 'slides/'];
    case 'blocked':
      return ['presentation audit all'];
    case 'ready_for_finalize':
      return ['presentation export'];
    case 'finalized':
      return [rootPdfRel];
    default:
      return facets.evidence === 'current' ? ['slides/'] : ['presentation audit all'];
  }
}
```

- [ ] **Step 4: Remove `historyPolicy` branching and old prompts**

```js
// project-hook-service.mjs
export function shouldRunProjectHooks() {
  return true;
}

// project-query-service.mjs
return {
  projectRoot,
  project: {
    projectMode: metadata.projectMode,
    projectName: metadata.projectName,
    projectSlug: metadata.projectSlug,
    projectSchemaVersion: metadata.projectSchemaVersion,
    createdWithCoreVersion: metadata.createdWithCoreVersion,
  },
};
```

- [ ] **Step 5: Run the application-facing tests again**

Run: `node --test framework/application/__tests__/project-query-service.test.mjs framework/application/__tests__/action-service.test.mjs framework/application/__tests__/action-workflow-service.test.mjs framework/application/__tests__/project-hook-service.test.mjs`
Expected: PASS with status/help text centered on `inspect`, `status`, `audit`, `preview`, and `export`.

- [ ] **Step 6: Commit**

```bash
git add framework/runtime/status-service.js framework/runtime/project-state.js \
  framework/application/project-query-service.mjs framework/application/action-service.mjs \
  framework/application/project-hook-service.mjs framework/application/__tests__/project-query-service.test.mjs \
  framework/application/__tests__/action-service.test.mjs framework/application/__tests__/action-workflow-service.test.mjs \
  framework/application/__tests__/project-hook-service.test.mjs
git commit -m "refactor: align status and application surfaces with shell-less v1 workflow"
```

---

### Task 6: Rewrite the Claude-first scaffold packet to match the new package model

**Files:**
- Modify: `project-agent/project-agents-md.md`
- Modify: `project-agent/project-claude-md.md`
- Modify: `project-agent/project-dot-claude/rules/authoring-rules.md`
- Modify: `project-agent/project-dot-claude/rules/file-boundaries.md`
- Modify: `project-agent/project-dot-claude/rules/framework.md`
- Modify: `project-agent/project-dot-claude/skills/new-deck/SKILL.md`
- Modify: `project-agent/project-dot-claude/skills/fix-validation-issues/SKILL.md`
- Test: `project-agent/__tests__/scaffold-package.test.mjs`

- [ ] **Step 1: Write the failing scaffold-doc assertions**

```js
test('claude scaffold docs point at .claude/AGENTS.md and shell-less v1 commands', () => {
  const scaffold = getProjectAgentScaffoldPackage();
  const rels = scaffold.entries.map((entry) => entry.targetRel);
  assert.ok(rels.includes('.claude/AGENTS.md'));
  assert.ok(!rels.includes('AGENTS.md'));
});
```

- [ ] **Step 2: Run the project-agent tests to confirm failure**

Run: `node --test project-agent/__tests__/scaffold-package.test.mjs project-agent/__tests__/agent-launcher.test.mjs`
Expected: FAIL because scaffold docs still assume root `AGENTS.md`, `outline.md`, `check`, `capture`, `finalize`, and `outputs/`.

- [ ] **Step 3: Rewrite the project contract doc under `.claude/AGENTS.md`**

```md
## Read Order
1. `.presentation/project.json`
2. `.presentation/package.generated.json`
3. `.presentation/intent.json`
4. `.presentation/runtime/render-state.json` if it exists
5. `.presentation/runtime/artifacts.json` if it exists
6. `brief.md`
7. `theme.css`
8. relevant `slides/<NNN-slide-id>/slide.html`

## Commands
- `node .presentation/framework-cli.mjs inspect`
- `node .presentation/framework-cli.mjs status`
- `node .presentation/framework-cli.mjs audit all`
- `node .presentation/framework-cli.mjs preview serve`
- `node .presentation/framework-cli.mjs export`
```

- [ ] **Step 4: Rewrite Claude-specific rules/skills to the new workflow**

```md
## Verification Workflow
After meaningful deck changes, prefer:
1. `node .presentation/framework-cli.mjs preview serve`
2. `node .presentation/framework-cli.mjs audit all`
3. `node .presentation/framework-cli.mjs export`
```

```md
- do not author `.claude/*`
- do not rely on `outline.md` in v1
- treat the root PDF as the only user-facing export artifact in v1
```

- [ ] **Step 5: Run the project-agent tests again**

Run: `node --test project-agent/__tests__/scaffold-package.test.mjs project-agent/__tests__/agent-launcher.test.mjs`
Expected: PASS with `.claude/AGENTS.md` as the scaffolded project contract and the new v1 command language.

- [ ] **Step 6: Commit**

```bash
git add project-agent/project-agents-md.md project-agent/project-claude-md.md \
  project-agent/project-dot-claude/rules/authoring-rules.md \
  project-agent/project-dot-claude/rules/file-boundaries.md \
  project-agent/project-dot-claude/rules/framework.md \
  project-agent/project-dot-claude/skills/new-deck/SKILL.md \
  project-agent/project-dot-claude/skills/fix-validation-issues/SKILL.md \
  project-agent/__tests__/scaffold-package.test.mjs
git commit -m "docs: align claude scaffold packet with shell-less v1"
```

---

### Task 7: Run the end-to-end shell-less v1 verification matrix

**Files:**
- Modify: `README.md`
- Modify: `START-HERE.md`
- Modify: `docs/repo-trace-project-creation.md`
- Modify: `docs/prd-human-agent.md`
- Verification only: no required code files beyond fixes discovered in the matrix

- [ ] **Step 1: Run the runtime + application test matrix**

Run:
```bash
node --test \
  framework/runtime/__tests__/deck-paths-project-only.test.mjs \
  framework/runtime/__tests__/presentation-package.test.mjs \
  framework/runtime/__tests__/presentation-runtime-state.test.mjs \
  framework/runtime/__tests__/presentation-core.test.mjs \
  framework/runtime/__tests__/presentation-cli.test.mjs \
  framework/runtime/__tests__/preview-server.test.mjs \
  framework/runtime/services/__tests__/runtime-services.test.mjs \
  framework/application/__tests__/project-query-service.test.mjs \
  framework/application/__tests__/action-service.test.mjs \
  framework/application/__tests__/action-workflow-service.test.mjs \
  framework/application/__tests__/project-hook-service.test.mjs \
  framework/application/__tests__/presentation-package-integration.test.mjs \
  project-agent/__tests__/scaffold-package.test.mjs \
  project-agent/__tests__/agent-launcher.test.mjs
```
Expected: PASS for the core/runtime/application/project-agent shell-less v1 surfaces.

- [ ] **Step 2: Run a real scaffold + shim smoke test**

Run:
```bash
TMP_PROJECT="$(mktemp -d /tmp/pf-shellless-v1-XXXXXX)"
node framework/runtime/presentation-cli.mjs init --project "$TMP_PROJECT" --format json
node "$TMP_PROJECT/.presentation/framework-cli.mjs" inspect --format json
node "$TMP_PROJECT/.presentation/framework-cli.mjs" status --format json
node "$TMP_PROJECT/.presentation/framework-cli.mjs" audit all --format json
```
Expected: each command exits 0 and references only root source, `.presentation/`, and `/.claude/` paths.

- [ ] **Step 3: Run a real preview + export smoke test**

Run:
```bash
TMP_PROJECT="$(mktemp -d /tmp/pf-shellless-v1-preview-XXXXXX)"
node framework/runtime/presentation-cli.mjs init --project "$TMP_PROJECT" --format json
node "$TMP_PROJECT/.presentation/framework-cli.mjs" preview serve > /tmp/pf-preview.log 2>&1 &
PREVIEW_PID=$!
sleep 3
kill "$PREVIEW_PID"
node "$TMP_PROJECT/.presentation/framework-cli.mjs" export --format json
ls "$TMP_PROJECT"/*.pdf
```
Expected: preview serve prints a local preview URL; export creates exactly one root-level PDF.

- [ ] **Step 4: Update the repo-facing docs if the smoke output exposed stale instructions**

```md
- use `presentation init --project /abs/path`
- use `.presentation/framework-cli.mjs` inside initialized projects
- use `preview open|serve`
- use `export`; `finalize` remains a compatibility alias
- do not refer to `outputs/` or `outline.md` as v1 defaults
```

- [ ] **Step 5: Commit**

```bash
git add README.md START-HERE.md docs/repo-trace-project-creation.md docs/prd-human-agent.md
git commit -m "docs: update repo runbooks for shell-less v1 workflow"
```

---

## Testing Strategy

- Prefer narrow test-first updates per task before touching implementation.
- Keep runtime/core changes verified independently from application-layer consumer updates.
- Treat `preview serve` as a long-running behavior with its own test file and smoke test, not as a side effect of the export path.
- Preserve old wrappers (`new-project.mjs`, `check-deck.mjs`, `export-pdf.mjs`, `finalize-deck.mjs`) only as compatibility shells over the new core/CLI semantics.
- Continue treating repo-wide Electron/operator smoke failures as known baseline noise unless a change in this plan touches those areas directly.

## Potential Risks / Gotchas

- **Package resolution from the local shim:** if `package.json` `exports` or `bin` are wrong, the project-local shim will fail immediately. Keep one targeted shim-resolution test.
- **Root `AGENTS.md` vs `/.claude/AGENTS.md`:** this is the sharpest scaffold-policy change in the plan. Update scaffold-package tests first so every later doc change has one authority.
- **Delivery simplification:** many tests currently assert `outputs/finalized/*` and screenshot/report artifacts. Rewrite these in one focused task rather than piecemeal to avoid mixed contracts.
- **Compatibility wrappers:** repo-maintainer scripts such as `npm run new`, `npm run export`, and `npm run finalize` should keep working while forwarding to the new CLI language.
- **Historical docs:** the large architecture doc intentionally contains historical sections. Only update repo-facing instructions that are supposed to describe the current product, not archival notes.

## Rollback Plan

- Revert task-by-task if a specific layer proves too disruptive:
  1. metadata/path contract
  2. scaffold/shim
  3. CLI/init/preview
  4. delivery/runtime evidence
  5. application consumers
  6. Claude scaffold docs
- If the shim/package-resolution change is the only unstable piece, keep the rest of the shell-less v1 filesystem and delivery model while temporarily restoring the old shim implementation behind the same file path.
- If delivery simplification blocks too many downstream tests, keep the new CLI/init/scaffold work and temporarily preserve compatibility reads for `outputs/*` until the remaining consumers are migrated.
