# Presentation Core Rehaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehaul the presentation package core so the filesystem, runtime state, CLI, and action surface follow the new MECE package model: authored source, authored intent, generated structure, runtime evidence, delivery outputs, adapter scaffolding, and git as agent-internal history.

**Architecture:** Keep the current project-root authored source model, but refactor the core around four explicit layers: constitution/paths, structural compiler, audit/evidence, and delivery orchestration. Preserve compatibility temporarily by wrapping old `check`/`capture`/action names around the new internal operations while removing package-level checkpoint semantics, flattening less meaning into `project-state.js`, and splitting canonical finalized outputs from ad hoc exports. After that first rehaul cut, harden the result into a small protected headless kernel so future shell work can change UI freely without redefining package semantics, agent authorship boundaries, or core orchestration.

**Tech Stack:** Node.js, `node:test`, existing `framework/runtime` modules, existing `framework/application` adapters, Playwright-based runtime capture, JSON package/evidence files, git-backed agent workflow

---

## File Structure

### New files

- `framework/runtime/presentation-cli.mjs`
  - top-level CLI router for `inspect`, `status`, `audit`, `finalize`, `export`, and `explain`
- `framework/runtime/structural-compiler.js`
  - compute/record structural manifest from authored source
- `framework/runtime/audit-service.js`
  - normalized audit entrypoints and issue/result envelopes
- `framework/runtime/status-service.js`
  - derived workflow status, delivery facet, and evidence freshness summaries
- `framework/runtime/__tests__/structural-compiler.test.mjs`
  - structural compiler compute/record tests
- `framework/runtime/__tests__/audit-service.test.mjs`
  - first-wave audit-family tests and issue schema tests
- `framework/runtime/__tests__/status-service.test.mjs`
  - workflow/freshness/delivery derivation tests
- `framework/runtime/__tests__/presentation-cli.test.mjs`
  - command family, exit code, and JSON envelope tests

### Modified files

- `framework/runtime/deck-paths.js`
  - remove `last-good`/checkpoint assumptions, add finalized/export output path split, keep package constitution paths
- `framework/runtime/presentation-runtime-state.js`
  - remove `last-good` helpers, adopt `render-state.json` + `artifacts.json` only, add source fingerprint fields
- `framework/runtime/presentation-package.js`
  - reduce to package ensure/bootstrap helpers or delegate to `structural-compiler.js`
- `framework/runtime/project-state.js`
  - stop owning coarse semantic logic directly; delegate to `status-service.js`
- `framework/runtime/services/presentation-ops-service.mjs`
  - split validation, export, finalize, and evidence-writing paths around the new services
- `framework/runtime/check-deck.mjs`
  - compatibility wrapper to new audit/status path
- `framework/runtime/deck-capture.mjs`
  - compatibility wrapper or narrowed runtime helper
- `framework/runtime/export-pdf.mjs`
  - compatibility wrapper to new export path
- `framework/runtime/finalize-deck.mjs`
  - compatibility wrapper to new finalize path
- `framework/application/presentation-action-adapter.mjs`
  - remap old action ids to new finalize/export/audit semantics
- `framework/application/__tests__/presentation-package-integration.test.mjs`
  - integration coverage for new command/evidence/delivery contracts
- `framework/runtime/__tests__/deck-paths-project-only.test.mjs`
  - path contract updates for finalized/exports split and `last-good` removal
- `framework/runtime/__tests__/presentation-package.test.mjs`
  - package constitution + manifest behavior updates
- `framework/runtime/__tests__/presentation-runtime-state.test.mjs`
  - evidence contract updates
- `docs/presentation-package-spec.md`
  - align package spec with new constitution/evidence model
- `docs/superpowers/specs/2026-04-12-presentation-package-core-architecture-design.md`
  - keep architecture doc in sync if implementation forces small clarifications

### Existing files to reference while implementing

- `framework/runtime/deck-source.js`
- `framework/runtime/deck-policy.js`
- `framework/runtime/presentation-intent.js`
- `framework/runtime/rendered-canvas-contract.mjs`
- `framework/runtime/runtime-app.js`
- `framework/runtime/deck-assemble.js`
- `framework/application/project-query-service.mjs`
- `framework/application/action-service.mjs`
- `framework/application/project-hook-service.mjs`
- `framework/runtime/__tests__/deck-policy.test.mjs`
- `framework/runtime/__tests__/presentation-runtime-state.test.mjs`
- `framework/application/__tests__/action-workflow-service.test.mjs`

---

## Chunk 1: Constitution + Path Layer

### Task 1: Rewrite package/output path contracts to match the MECE constitution

**Files:**
- Modify: `framework/runtime/deck-paths.js`
- Test: `framework/runtime/__tests__/deck-paths-project-only.test.mjs`
- Test: `framework/runtime/__tests__/presentation-package.test.mjs`

- [ ] **Step 1: Write failing path-contract tests for finalized/export split and `last-good` removal**

```js
test('getProjectPaths exposes finalized and export output roots without last-good runtime state', () => {
  const paths = getProjectPaths(projectRoot);
  assert.equal(paths.renderStateRel, '.presentation/runtime/render-state.json');
  assert.equal(paths.artifactsRel, '.presentation/runtime/artifacts.json');
  assert.equal(paths.finalizedOutputDirRel, 'outputs/finalized');
  assert.equal(paths.exportsOutputDirRel, 'outputs/exports');
  assert.equal('lastGoodRel' in paths, false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/presentation-package.test.mjs`
Expected: FAIL because current paths still expose `lastGoodRel` and a flat `outputs/` contract.

- [ ] **Step 3: Update `deck-paths.js` to reflect the new constitution**

```js
export const PROJECT_RUNTIME_DIRNAME = 'runtime';
export const PROJECT_RENDER_STATE_FILENAME = 'render-state.json';
export const PROJECT_ARTIFACTS_FILENAME = 'artifacts.json';

export function getProjectOutputPaths(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return {
    finalizedDirRel: 'outputs/finalized',
    finalizedDirAbs: resolve(paths.outputsDirAbs, 'finalized'),
    finalizedPdfRel: 'outputs/finalized/deck.pdf',
    finalizedPdfAbs: resolve(paths.outputsDirAbs, 'finalized', 'deck.pdf'),
    finalizedReportRel: 'outputs/finalized/report.json',
    finalizedReportAbs: resolve(paths.outputsDirAbs, 'finalized', 'report.json'),
    finalizedSummaryRel: 'outputs/finalized/summary.md',
    finalizedSummaryAbs: resolve(paths.outputsDirAbs, 'finalized', 'summary.md'),
    finalizedFullPageRel: 'outputs/finalized/full-page.png',
    finalizedFullPageAbs: resolve(paths.outputsDirAbs, 'finalized', 'full-page.png'),
    finalizedSlidesDirRel: 'outputs/finalized/slides',
    finalizedSlidesDirAbs: resolve(paths.outputsDirAbs, 'finalized', 'slides'),
    exportsDirRel: 'outputs/exports',
    exportsDirAbs: resolve(paths.outputsDirAbs, 'exports'),
  };
}
```

- [ ] **Step 4: Run the tests again**

Run: `node --test framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/presentation-package.test.mjs`
Expected: PASS for the new runtime/output path contract.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/deck-paths.js framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/presentation-package.test.mjs
git commit -m "refactor: align package paths with finalized and export output model"
```

### Task 2: Remove `last-good` from runtime state helpers and add source fingerprint fields

**Files:**
- Modify: `framework/runtime/presentation-runtime-state.js`
- Test: `framework/runtime/__tests__/presentation-runtime-state.test.mjs`

- [ ] **Step 1: Write failing runtime-state tests for the new evidence contract**

```js
test('ensurePresentationRuntimeStateFiles creates render-state and artifacts only', () => {
  const state = ensurePresentationRuntimeStateFiles(projectRoot);
  assert.ok(state.renderState);
  assert.ok(state.artifacts);
  assert.equal('lastGood' in state, false);
});

test('writeRenderState records source fingerprint and producer', () => {
  const renderState = writeRenderState(projectRoot, {
    kind: 'render-state',
    sourceFingerprint: 'sha256:test',
    producer: 'audit-render',
    status: 'pass'
  });
  assert.equal(renderState.sourceFingerprint, 'sha256:test');
  assert.equal(renderState.producer, 'audit-render');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/runtime/__tests__/presentation-runtime-state.test.mjs`
Expected: FAIL because runtime state still creates and returns `lastGood`.

- [ ] **Step 3: Rewrite `presentation-runtime-state.js` around two evidence files**

```js
export function createInitialRenderState() {
  return {
    schemaVersion: 1,
    kind: 'render-state',
    sourceFingerprint: '',
    generatedAt: null,
    producer: '',
    status: 'pending',
    slideIds: [],
    previewKind: 'slides',
    canvasContract: null,
    consoleErrorCount: 0,
    overflowSlides: [],
    failures: [],
    issues: [],
  };
}

export function createInitialArtifacts() {
  return {
    schemaVersion: 1,
    kind: 'artifacts',
    sourceFingerprint: '',
    generatedAt: null,
    finalized: { exists: false },
    latestExport: { exists: false },
  };
}
```

- [ ] **Step 4: Run the tests again**

Run: `node --test framework/runtime/__tests__/presentation-runtime-state.test.mjs`
Expected: PASS with no `lastGood` state and the new evidence shape.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/presentation-runtime-state.js framework/runtime/__tests__/presentation-runtime-state.test.mjs
git commit -m "refactor: remove last-good runtime state and add evidence fingerprint fields"
```

---

## Chunk 2: Structural Compiler Extraction

### Task 3: Extract a dedicated structural compiler with compute and record modes

**Files:**
- Create: `framework/runtime/structural-compiler.js`
- Modify: `framework/runtime/presentation-package.js`
- Test: `framework/runtime/__tests__/structural-compiler.test.mjs`
- Test: `framework/runtime/__tests__/presentation-package.test.mjs`

- [ ] **Step 1: Write failing structural compiler tests**

```js
test('computeStructuralManifest derives normalized slides from valid slide directories only', () => {
  const manifest = computeStructuralManifest(projectRoot);
  assert.deepEqual(manifest.slides.map((slide) => slide.id), ['intro', 'problem']);
  assert.deepEqual(manifest.slides.map((slide) => slide.orderValue), [10, 20]);
});

test('recordStructuralManifest writes package.generated.json only when content changes', () => {
  const first = recordStructuralManifest(projectRoot);
  const second = recordStructuralManifest(projectRoot);
  assert.deepEqual(first, second);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/runtime/__tests__/structural-compiler.test.mjs framework/runtime/__tests__/presentation-package.test.mjs`
Expected: FAIL because `structural-compiler.js` does not exist yet.

- [ ] **Step 3: Create `structural-compiler.js` and delegate legacy package helpers to it**

```js
export function computeStructuralManifest(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  const slideEntries = listSlideSourceEntries(paths).filter((entry) => entry.isValidName);

  return {
    schemaVersion: 1,
    project: {
      slug: paths.slug,
      title: paths.title,
    },
    source: {
      brief: { path: paths.briefRel, exists: existsSync(paths.briefAbs), complete: isComplete(paths.briefAbs) },
      outline: { path: paths.outlineRel, exists: existsSync(paths.outlineAbs), required: slideEntries.length > LONG_DECK_OUTLINE_THRESHOLD, complete: isOutlineComplete(paths, slideEntries) },
      theme: { path: paths.themeCssRel, exists: existsSync(paths.themeCssAbs) },
      sharedAssets: { dir: paths.assetsDirRel, exists: existsSync(paths.assetsDirAbs) },
    },
    slides: slideEntries.map((entry) => ({
      id: entry.slideId,
      orderLabel: entry.orderLabel,
      orderValue: entry.orderValue,
      dir: entry.slideDirRel,
      html: entry.slideHtmlRel,
      css: entry.slideCssRel,
      hasCss: existsSync(entry.slideCssAbs),
      assetsDir: entry.assetsDirRel,
      hasAssetsDir: existsSync(entry.assetsDirAbs),
    })),
    counts: { slidesTotal: slideEntries.length },
  };
}
```

- [ ] **Step 4: Run the tests again**

Run: `node --test framework/runtime/__tests__/structural-compiler.test.mjs framework/runtime/__tests__/presentation-package.test.mjs`
Expected: PASS with compute/record parity and a narrower `presentation-package.js` role.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/structural-compiler.js framework/runtime/presentation-package.js framework/runtime/__tests__/structural-compiler.test.mjs framework/runtime/__tests__/presentation-package.test.mjs
git commit -m "refactor: extract structural compiler from package bootstrap helpers"
```

### Task 4: Keep intent subordinate to structure and validate it explicitly

**Files:**
- Modify: `framework/runtime/presentation-intent.js`
- Test: `framework/runtime/__tests__/structural-compiler.test.mjs`

- [ ] **Step 1: Write a failing test for unknown slide intent references**

```js
test('validatePresentationIntent rejects slide ids not present in the structural manifest', () => {
  const issues = validatePresentationIntent({ slideIntent: { missing: {} } }, {
    slides: [{ id: 'intro' }],
  });
  assert.deepEqual(issues, ['Presentation intent references unknown slide id "missing".']);
});
```

- [ ] **Step 2: Run the test to verify failure if behavior drifts**

Run: `node --test framework/runtime/__tests__/structural-compiler.test.mjs`
Expected: FAIL if intent validation does not remain subordinate to structure.

- [ ] **Step 3: Keep or tighten intent validation around structural truth**

```js
export function validatePresentationIntent(intent, manifest) {
  const issues = [];
  const slideIntent = intent.slideIntent ?? {};
  const knownSlideIds = new Set((manifest?.slides || []).map((slide) => slide.id));

  for (const slideId of Object.keys(slideIntent)) {
    if (!knownSlideIds.has(slideId)) {
      issues.push(`Presentation intent references unknown slide id "${slideId}".`);
    }
  }

  return issues;
}
```

- [ ] **Step 4: Run the test again**

Run: `node --test framework/runtime/__tests__/structural-compiler.test.mjs`
Expected: PASS with intent still constrained by structural truth.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/presentation-intent.js framework/runtime/__tests__/structural-compiler.test.mjs
git commit -m "test: lock intent references under structural manifest authority"
```

---

## Chunk 3: Audit + Status Core

### Task 5: Introduce a normalized audit service with the first four families

**Files:**
- Create: `framework/runtime/audit-service.js`
- Modify: `framework/runtime/deck-policy.js`
- Test: `framework/runtime/__tests__/audit-service.test.mjs`
- Test: `framework/runtime/__tests__/deck-policy.test.mjs`

- [ ] **Step 1: Write failing audit-service tests for issue envelope shape**

```js
test('runThemeAudit returns deterministic issue envelopes', async () => {
  const result = await runThemeAudit(projectRoot, { slideId: 'intro' });
  assert.equal(result.status, 'fail');
  assert.equal(result.issues[0].code, 'theme.raw-value');
  assert.equal(result.issues[0].layer, 'theme');
  assert.ok(Array.isArray(result.nextFocus));
});

test('runBoundaryAudit reports selector scope violations', async () => {
  const result = await runBoundaryAudit(projectRoot, { slideId: 'intro' });
  assert.equal(result.issues[0].code, 'boundary.illegal-selector-scope');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/runtime/__tests__/audit-service.test.mjs framework/runtime/__tests__/deck-policy.test.mjs`
Expected: FAIL because the normalized audit service does not exist yet.

- [ ] **Step 3: Build `audit-service.js` as a wrapper over existing rule knowledge**

```js
export async function runThemeAudit(projectRootInput, options = {}) {
  const issues = collectThemeIssues(projectRootInput, options);
  return buildAuditResult({
    command: 'presentation audit theme',
    scope: buildAuditScope(options),
    issues,
  });
}

export async function runCanvasAudit(projectRootInput, options = {}) {
  const issues = collectCanvasIssues(projectRootInput, options);
  return buildAuditResult({ command: 'presentation audit canvas', scope: buildAuditScope(options), issues });
}

export async function runBoundaryAudit(projectRootInput, options = {}) {
  const issues = collectBoundaryIssues(projectRootInput, options);
  return buildAuditResult({ command: 'presentation audit boundaries', scope: buildAuditScope(options), issues });
}

export async function runAuditAll(projectRootInput, options = {}) {
  const theme = await runThemeAudit(projectRootInput, options);
  const canvas = await runCanvasAudit(projectRootInput, options);
  const boundaries = await runBoundaryAudit(projectRootInput, options);
  return mergeAuditResults('presentation audit all', [theme, canvas, boundaries]);
}
```

- [ ] **Step 4: Run the tests again**

Run: `node --test framework/runtime/__tests__/audit-service.test.mjs framework/runtime/__tests__/deck-policy.test.mjs`
Expected: PASS with normalized issue envelopes and preserved rule coverage.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/audit-service.js framework/runtime/deck-policy.js framework/runtime/__tests__/audit-service.test.mjs framework/runtime/__tests__/deck-policy.test.mjs
git commit -m "refactor: introduce normalized audit service over policy rules"
```

### Task 6: Replace coarse status derivation with a dedicated status service

**Files:**
- Create: `framework/runtime/status-service.js`
- Modify: `framework/runtime/project-state.js`
- Test: `framework/runtime/__tests__/status-service.test.mjs`

- [ ] **Step 1: Write failing status-service tests for workflow and facets**

```js
test('derivePackageStatus returns authoring with stale finalized outputs when source changed after finalize', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'finalized_stale',
    evidence: 'current',
  });
  assert.equal(status.workflow, 'authoring');
  assert.equal(status.facets.delivery, 'finalized_stale');
});

test('derivePackageStatus returns ready_for_finalize when blockers are absent and evidence is current', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'not_finalized',
    evidence: 'current',
  });
  assert.equal(status.workflow, 'ready_for_finalize');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/runtime/__tests__/status-service.test.mjs`
Expected: FAIL because `status-service.js` does not exist yet.

- [ ] **Step 3: Create `status-service.js` and delegate `project-state.js` to it**

```js
export function derivePackageStatus(facts) {
  if (!facts.sourceComplete) {
    return buildStatus('onboarding', facts);
  }
  if (facts.blockerCount > 0) {
    return buildStatus('blocked', facts);
  }
  if (facts.delivery === 'finalized_current') {
    return buildStatus('finalized', facts);
  }
  if (facts.evidence === 'current') {
    return buildStatus('ready_for_finalize', facts);
  }
  return buildStatus('authoring', facts);
}
```

- [ ] **Step 4: Run the tests again**

Run: `node --test framework/runtime/__tests__/status-service.test.mjs`
Expected: PASS with the new workflow-state vocabulary and delivery/evidence facets.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/status-service.js framework/runtime/project-state.js framework/runtime/__tests__/status-service.test.mjs
git commit -m "refactor: move package workflow derivation into dedicated status service"
```

---

## Chunk 4: Evidence + Delivery Rewrite

### Task 7: Split finalized vs export outputs and remove `last-good` writes from finalize flow

**Files:**
- Modify: `framework/runtime/services/presentation-ops-service.mjs`
- Modify: `framework/runtime/finalize-deck.mjs`
- Test: `framework/application/__tests__/presentation-package-integration.test.mjs`
- Test: `framework/runtime/__tests__/presentation-runtime-state.test.mjs`

- [ ] **Step 1: Write failing integration tests for the new finalize contract**

```js
test('finalize writes canonical outputs under outputs/finalized and updates evidence without last-good', async () => {
  const result = await finalizePresentation(projectRoot);
  assert.equal(result.status, 'pass');
  assert.equal(result.outputs.pdf, 'outputs/finalized/deck.pdf');
  assert.equal(existsSync(resolve(projectRoot, '.presentation/runtime/last-good.json')), false);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs`
Expected: FAIL because finalize still writes flat `outputs/` and `last-good.json`.

- [ ] **Step 3: Rewrite finalize flow around canonical finalized outputs and evidence refresh**

```js
export async function finalizePresentation(targetInput, options = {}) {
  const target = createPresentationTarget(targetInput);
  const outputPaths = getProjectOutputPaths(target.projectRootAbs);

  rmSync(outputPaths.finalizedDirAbs, { recursive: true, force: true });
  mkdirSync(outputPaths.finalizedSlidesDirAbs, { recursive: true });

  const report = await capturePresentation(target, outputPaths.finalizedDirAbs, {
    slidesDirName: 'slides',
  });
  await exportDeckPdf(target, outputPaths.finalizedPdfAbs);

  writeRenderState(target.projectRootAbs, {
    kind: 'render-state',
    producer: 'finalize',
    sourceFingerprint: computeSourceFingerprint(target.projectRootAbs),
    generatedAt: new Date().toISOString(),
    status: report.status,
    slideIds: report.slideIds,
    canvasContract: report.consistency.canvasContract,
    consoleErrorCount: report.consoleErrors.length,
    overflowSlides: report.consistency.slidesWithOverflow,
    issues: summarizeIssues(report),
  });

  writeArtifacts(target.projectRootAbs, {
    kind: 'artifacts',
    sourceFingerprint: computeSourceFingerprint(target.projectRootAbs),
    generatedAt: new Date().toISOString(),
    finalized: {
      exists: true,
      outputDir: outputPaths.finalizedDirRel,
      pdf: outputPaths.finalizedPdfRel,
      report: outputPaths.finalizedReportRel,
      summary: outputPaths.finalizedSummaryRel,
      fullPage: outputPaths.finalizedFullPageRel,
      slides: buildFinalizedSlideArtifacts(report, outputPaths),
    },
  });
}
```

- [ ] **Step 4: Run the tests again**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs`
Expected: PASS with finalized outputs under `outputs/finalized` and no `last-good` state.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/services/presentation-ops-service.mjs framework/runtime/finalize-deck.mjs framework/application/__tests__/presentation-package-integration.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs
git commit -m "refactor: split finalize outputs from runtime evidence and remove last-good writes"
```

### Task 8: Rewrite export flow so it writes under `outputs/exports` without finalizing the package

**Files:**
- Modify: `framework/runtime/services/presentation-ops-service.mjs`
- Modify: `framework/runtime/export-pdf.mjs`
- Test: `framework/application/__tests__/presentation-package-integration.test.mjs`

- [ ] **Step 1: Write a failing export integration test**

```js
test('export writes ad hoc artifacts under outputs/exports and does not mark package finalized', async () => {
  const result = await exportPresentation(projectRoot, {
    format: 'pdf',
    slideIds: ['intro'],
    outputDir: 'outputs/exports/test-run/pdf',
  });
  assert.equal(result.status, 'pass');
  assert.match(result.outputs.outputDir, /outputs\/exports\/test-run\/pdf$/);
  const artifacts = readArtifacts(projectRoot);
  assert.equal(artifacts.finalized?.exists ?? false, false);
  assert.equal(artifacts.latestExport.exists, true);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs`
Expected: FAIL because export currently writes a flatter artifact shape and can blur finalize/export state.

- [ ] **Step 3: Rewrite export inventory updates around `latestExport`**

```js
writeArtifacts(projectRoot, {
  kind: 'artifacts',
  sourceFingerprint: computeSourceFingerprint(projectRoot),
  generatedAt: new Date().toISOString(),
  latestExport: {
    exists: true,
    format,
    outputDir: toProjectArtifactPath(projectPaths, outputDir),
    artifacts: outputPaths.map((artifactPath) => toProjectArtifactPath(projectPaths, artifactPath)),
  },
});
```

- [ ] **Step 4: Run the tests again**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs`
Expected: PASS with export inventory distinct from canonical finalize state.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/services/presentation-ops-service.mjs framework/runtime/export-pdf.mjs framework/application/__tests__/presentation-package-integration.test.mjs
git commit -m "refactor: separate ad hoc export inventory from finalized delivery state"
```

---

## Chunk 5: CLI + Application Cutover

### Task 9: Add the new CLI router for `inspect`, `status`, `audit`, `finalize`, and `export`

**Files:**
- Create: `framework/runtime/presentation-cli.mjs`
- Test: `framework/runtime/__tests__/presentation-cli.test.mjs`

- [ ] **Step 1: Write failing CLI contract tests**

```js
test('presentation-cli audit returns exit code 1 on hard violations', async () => {
  const result = await runCli(['audit', 'theme', '--project', projectRoot, '--format', 'json']);
  assert.equal(result.exitCode, 1);
  assert.equal(JSON.parse(result.stdout).status, 'fail');
});

test('presentation-cli status returns workflow and facets', async () => {
  const result = await runCli(['status', '--project', projectRoot, '--format', 'json']);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'ok');
  assert.ok(json.workflow);
  assert.ok(json.facets);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/runtime/__tests__/presentation-cli.test.mjs`
Expected: FAIL because `presentation-cli.mjs` does not exist yet.

- [ ] **Step 3: Implement the new CLI router around the new services**

```js
switch (family) {
  case 'inspect':
    return runInspectCommand(args);
  case 'status':
    return runStatusCommand(args);
  case 'audit':
    return runAuditCommand(args);
  case 'finalize':
    return runFinalizeCommand(args);
  case 'export':
    return runExportCommand(args);
  case 'explain':
    return runExplainCommand(args);
  default:
    throw new Error(`Unknown command family "${family}".`);
}
```

- [ ] **Step 4: Run the tests again**

Run: `node --test framework/runtime/__tests__/presentation-cli.test.mjs`
Expected: PASS with the new family names, JSON envelopes, and exit code contract.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/presentation-cli.mjs framework/runtime/__tests__/presentation-cli.test.mjs
git commit -m "feat: add presentation CLI router with inspect status audit finalize and export families"
```

### Task 10: Keep legacy entrypoints and actions as compatibility wrappers over the new core

**Files:**
- Modify: `framework/runtime/check-deck.mjs`
- Modify: `framework/runtime/deck-capture.mjs`
- Modify: `framework/runtime/export-pdf.mjs`
- Modify: `framework/runtime/finalize-deck.mjs`
- Modify: `framework/application/presentation-action-adapter.mjs`
- Test: `framework/application/__tests__/presentation-package-integration.test.mjs`

- [ ] **Step 1: Write failing compatibility tests for old entrypoints/actions**

```js
test('legacy finalize action delegates to the new finalize semantics', async () => {
  const adapter = createPresentationActionAdapter();
  const result = await adapter.invoke('export_presentation', { target: { projectRoot: projectRoot } });
  assert.equal(result.status, 'pass');
  assert.match(result.detail, /outputs\/finalized\/deck\.pdf$/);
});

test('legacy check entrypoint delegates to audit/status-compatible behavior', async () => {
  const result = await runLegacyCheckCli(projectRoot);
  assert.equal(result.exitCode, 1);
  assert.match(result.stderr + result.stdout, /audit|issues|fail/i);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs`
Expected: FAIL because old entrypoints still directly encode older semantics.

- [ ] **Step 3: Rewrite old entrypoints/actions as compatibility wrappers**

```js
case 'export_presentation': {
  const result = await runFinalizeCommand({
    projectRoot: context.target.projectRootAbs || context.target.projectRoot,
    format: 'json',
  });
  return {
    ...result,
    message: 'Presentation finalize completed.',
    detail: result.outputs?.pdf || '',
  };
}
```

- [ ] **Step 4: Run tests again**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs`
Expected: PASS with old names still working through the new core.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/check-deck.mjs framework/runtime/deck-capture.mjs framework/runtime/export-pdf.mjs framework/runtime/finalize-deck.mjs framework/application/presentation-action-adapter.mjs framework/application/__tests__/presentation-package-integration.test.mjs
git commit -m "refactor: route legacy commands and actions through new presentation core"
```

---

## Chunk 6: Docs + Final Verification

### Task 11: Update user-facing package docs to match the rebuilt core

**Files:**
- Modify: `docs/presentation-package-spec.md`
- Modify: `docs/superpowers/specs/2026-04-12-presentation-package-core-architecture-design.md`

- [ ] **Step 1: Write the doc delta checklist in the plan branch**

```md
- Remove `last-good.json` from the package layout.
- Replace flat `outputs/` examples with `outputs/finalized/` and `outputs/exports/<run-id>/`.
- Replace checkpoint language with native git as agent-internal history.
- Replace broad `check` semantics with `inspect/status/audit/finalize/export`.
```

- [ ] **Step 2: Update `docs/presentation-package-spec.md`**

```md
## Core Principle

The agent should author source and intent.
The system should author structure and evidence.
Git should record history for agents.
The package should not maintain a separate checkpoint file.
```

- [ ] **Step 3: Sync the living architecture doc if implementation forced small clarifications**

```md
- note any path/name adjustments actually chosen
- note any command option deltas actually implemented
- keep the finalized architecture sections authoritative
```

- [ ] **Step 4: Verify docs mention the new folder structure and command families**

Run: `rg -n "last-good|checkpointed|ready_for_checkpoint|presentation checkpoint|outputs/ deck.pdf|flat outputs" docs/presentation-package-spec.md docs/superpowers/specs/2026-04-12-presentation-package-core-architecture-design.md`
Expected: only historical/rejected-model references remain in the architecture doc; none remain in the user-facing package spec.

- [ ] **Step 5: Commit**

```bash
git add docs/presentation-package-spec.md docs/superpowers/specs/2026-04-12-presentation-package-core-architecture-design.md
git commit -m "docs: align presentation package docs with rebuilt core model"
```

### Task 12: Run the final verification matrix

**Files:**
- Verify only

- [ ] **Step 1: Run runtime unit tests**

Run: `node --test framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/presentation-package.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs framework/runtime/__tests__/structural-compiler.test.mjs framework/runtime/__tests__/audit-service.test.mjs framework/runtime/__tests__/status-service.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs`
Expected: PASS

- [ ] **Step 2: Run application integration tests**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs framework/application/__tests__/action-workflow-service.test.mjs`
Expected: PASS

- [ ] **Step 3: Run the existing baseline suite for no-regression coverage**

Run: `npm test`
Expected: PASS

- [ ] **Step 4: Smoke-test the new CLI families against a scaffolded project**

Run:
```bash
npm run new -- --project /tmp/presentation-core-rehaul-smoke
node framework/runtime/presentation-cli.mjs inspect package --project /tmp/presentation-core-rehaul-smoke --format json
node framework/runtime/presentation-cli.mjs status --project /tmp/presentation-core-rehaul-smoke --format json
node framework/runtime/presentation-cli.mjs audit all --project /tmp/presentation-core-rehaul-smoke --format json
```
Expected: commands return structured JSON envelopes without crashing.

- [ ] **Step 5: Commit the verification-only final state if needed**

```bash
git add -A
git commit -m "test: verify presentation core rehaul end to end"
```

---

## Self-Review

### Spec coverage
- Package constitution spec -> Tasks 1, 2, 11
- Structural compiler spec -> Tasks 3, 4
- Evidence + delivery spec -> Tasks 2, 7, 8
- CLI contract spec -> Tasks 5, 6, 9, 10
- Rewrite / migration spec -> all tasks, especially 1 through 10

### Placeholder scan
- No TBD/TODO placeholders remain.
- All tasks list exact files.
- All command steps include explicit commands.
- Code steps include concrete code snippets or signatures.

### Type consistency
- New core service names stay consistent:
  - `computeStructuralManifest`
  - `recordStructuralManifest`
  - `runThemeAudit`
  - `runCanvasAudit`
  - `runBoundaryAudit`
  - `runAuditAll`
  - `derivePackageStatus`
  - `presentation-cli.mjs`
- Workflow states stay consistent:
  - `onboarding`
  - `authoring`
  - `blocked`
  - `ready_for_finalize`
  - `finalized`

## Execution Handoff

---

## Chunk 7: Protected Headless Core Hardening (Core Only)

This chunk explicitly defers new shell work.

The goal here is to make the core small, protected, and semantically authoritative before any UI experimentation continues.

### Task 13: Add a small public headless core facade over the rebuilt runtime services

**Files:**
- Create: `framework/runtime/presentation-core.mjs`
- Test: `framework/runtime/__tests__/presentation-core.test.mjs`
- Modify: `framework/runtime/presentation-cli.mjs`

- [ ] **Step 1: Write failing facade tests for the protected core surface**

```js
test('presentation core exposes semantic query and operation entrypoints', async () => {
  const core = createPresentationCore();
  assert.equal(typeof core.inspectPackage, 'function');
  assert.equal(typeof core.getStatus, 'function');
  assert.equal(typeof core.getPreview, 'function');
  assert.equal(typeof core.runAudit, 'function');
  assert.equal(typeof core.finalize, 'function');
  assert.equal(typeof core.exportPresentation, 'function');
});

test('presentation CLI delegates package status through the core facade', async () => {
  const result = await runPresentationCli(['status', '--project', projectRoot, '--format', 'json']);
  assert.equal(result.exitCode, 0);
  assert.equal(result.payload.workflow, 'onboarding');
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs`
Expected: FAIL because `presentation-core.mjs` does not exist and the CLI does not route through it yet.

- [ ] **Step 3: Add the protected core facade and route CLI calls through it**

```js
export function createPresentationCore(deps = {}) {
  return {
    async inspectPackage(projectRoot) { /* delegate to structure/evidence/status readers */ },
    async getStatus(projectRoot, options = {}) { /* delegate to status service */ },
    async getPreview(projectRoot, options = {}) { /* delegate to preview/runtime assembly */ },
    async runAudit(projectRoot, options = {}) { /* delegate to audit service */ },
    async finalize(projectRoot, options = {}) { /* delegate to finalize flow */ },
    async exportPresentation(projectRoot, options = {}) { /* delegate to export flow */ },
  };
}
```

- [ ] **Step 4: Run tests to verify the facade passes**

Run: `node --test framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs`
Expected: PASS with the CLI now acting as an adapter over the protected core facade.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/presentation-core.mjs framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/presentation-cli.mjs
git commit -m "feat: add protected presentation core facade"
```

### Task 14: Route application-layer presentation adapters through the protected core instead of mixed low-level calls

**Files:**
- Modify: `framework/application/presentation-action-adapter.mjs`
- Modify: `framework/application/project-query-service.mjs`
- Test: `framework/application/__tests__/presentation-package-integration.test.mjs`
- Test: `framework/application/__tests__/project-query-service.test.mjs`

- [ ] **Step 1: Write failing adapter/query tests that assert delegation through the core seam**

```js
test('presentation action adapter finalizes through the protected core facade', async () => {
  const adapter = createPresentationActionAdapter({ core: createFakePresentationCore() });
  await adapter.invoke('export_presentation', { target: { projectRootAbs: projectRoot } });
  assert.deepEqual(coreCalls, [['finalize', projectRoot]]);
});

test('project query service reads package status through the protected core facade', async () => {
  const service = createProjectQueryService({ core: createFakePresentationCore() });
  await service.getProjectStatus(projectRoot);
  assert.deepEqual(coreCalls, [['getStatus', projectRoot]]);
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs framework/application/__tests__/project-query-service.test.mjs`
Expected: FAIL because application-layer adapters still call mixed lower-level runtime helpers directly.

- [ ] **Step 3: Refactor application-facing adapters to consume the protected core facade**

```js
export function createPresentationActionAdapter(options = {}) {
  const core = options.core || createPresentationCore();
  return {
    async invoke(actionId, context = {}) {
      // map action ids to core methods only
    },
  };
}
```

- [ ] **Step 4: Run tests to verify application adapters are now core-backed**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs framework/application/__tests__/project-query-service.test.mjs`
Expected: PASS with application-layer presentation access now flowing through the protected core seam.

- [ ] **Step 5: Commit**

```bash
git add framework/application/presentation-action-adapter.mjs framework/application/project-query-service.mjs framework/application/__tests__/presentation-package-integration.test.mjs framework/application/__tests__/project-query-service.test.mjs
git commit -m "refactor: route application presentation access through protected core"
```

### Task 15: Lock the authored-content mutation boundary with explicit core tests

**Files:**
- Create: `framework/runtime/__tests__/presentation-core-boundary.test.mjs`
- Modify: `framework/runtime/presentation-core.mjs`
- Modify: `framework/runtime/presentation-intent.js`
- Modify: `framework/runtime/presentation-package.js`

- [ ] **Step 1: Write failing boundary tests for authored-content protection**

```js
test('core finalize and export flows never rewrite authored source files', async () => {
  const before = snapshotFiles(projectRoot, [
    'brief.md',
    'theme.css',
    'slides/010-intro/slide.html',
  ]);

  const core = createPresentationCore();
  await core.finalize(projectRoot);
  await core.exportPresentation(projectRoot, {
    format: 'pdf',
    slideIds: ['intro'],
    outputDir: 'outputs/exports/test-run/pdf',
  });

  const after = snapshotFiles(projectRoot, [
    'brief.md',
    'theme.css',
    'slides/010-intro/slide.html',
  ]);

  assert.deepEqual(after, before);
});

test('core may refresh generated structure and runtime evidence without becoming a second author', async () => {
  const core = createPresentationCore();
  await core.inspectPackage(projectRoot);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'package.generated.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')), true);
});
```

- [ ] **Step 2: Run tests to verify failure or missing explicit coverage**

Run: `node --test framework/runtime/__tests__/presentation-core-boundary.test.mjs`
Expected: FAIL because the boundary is not yet locked by dedicated tests.

- [ ] **Step 3: Make boundary rules explicit in the protected core helpers**

```js
// document and centralize authored-content vs system-owned writes
const AUTHORED_SOURCE_GLOBS = [
  'brief.md',
  'theme.css',
  'slides/**/slide.html',
  'slides/**/slide.css',
];
```

- [ ] **Step 4: Run tests to verify the mutation boundary is enforced and documented in code**

Run: `node --test framework/runtime/__tests__/presentation-core-boundary.test.mjs framework/runtime/__tests__/presentation-core.test.mjs`
Expected: PASS with the authored-content boundary now locked into the core test suite.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/__tests__/presentation-core-boundary.test.mjs framework/runtime/presentation-core.mjs framework/runtime/presentation-intent.js framework/runtime/presentation-package.js
git commit -m "test: lock authored-content mutation boundary in presentation core"
```

### Task 16: Verify the protected core seam before starting any shell work

**Files:**
- Verify only

- [ ] **Step 1: Run runtime core-boundary tests**

Run: `node --test framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/presentation-core-boundary.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs`
Expected: PASS

- [ ] **Step 2: Run application seam tests**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs framework/application/__tests__/project-query-service.test.mjs`
Expected: PASS

- [ ] **Step 3: Run the existing runtime/application matrix again**

Run: `node --test framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/presentation-package.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs framework/runtime/__tests__/structural-compiler.test.mjs framework/runtime/__tests__/audit-service.test.mjs framework/runtime/__tests__/status-service.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/presentation-core-boundary.test.mjs framework/application/__tests__/presentation-package-integration.test.mjs framework/application/__tests__/action-workflow-service.test.mjs framework/application/__tests__/project-query-service.test.mjs`
Expected: PASS

- [ ] **Step 4: Record the shell-readiness checkpoint in docs only after the core seam is green**

Run:
```bash
rg -n "Protected Headless Core Boundary Spec|Mutation Boundary|core/shell mental model" docs/presentation-package-spec.md docs/superpowers/specs/2026-04-12-presentation-package-core-architecture-design.md docs/superpowers/plans/2026-04-12-presentation-core-rehaul.md
```
Expected: PASS with the docs and plan aligned around the core-first rule.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: verify protected presentation core seam before shell work"
```

---

## Self-Review Addendum for the Core-Only Phase

### Spec coverage
- protected headless core boundary -> Tasks 13, 14, 15
- CLI remains adapter-only -> Task 13
- application layer uses the protected core seam -> Task 14
- authored-content mutation boundary stays sacred -> Task 15
- shell work remains deferred until core seam is green -> Task 16

### Scope check
- this phase is intentionally core-only
- no new Electron/shell feature work is included
- shell experimentation should begin only after Tasks 13 through 16 pass

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-12-presentation-core-rehaul.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
