# Presentation Package Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a first-class presentation package model with deterministic structural manifests, deterministic runtime evidence, and a stop-hook pipeline that keeps source, package truth, and render truth synchronized.

**Architecture:** Keep authored source in the project root, add a generated structural manifest and runtime evidence files under `.presentation/`, and make the stop-hook pipeline regenerate and validate them on every clean stop. Treat git as the history lane only: current package truth lives in generated JSON files, while render/build/finalize update runtime-owned evidence files.

**Tech Stack:** Node.js, `node:test`, existing runtime/services stack, project-agent stop hooks, git-backed project scaffolds

---

## File Structure

### New files

- `framework/runtime/presentation-package.js`
  - deterministic package manifest generator for `.presentation/package.generated.json`
- `framework/runtime/presentation-intent.js`
  - helpers for reading and validating `.presentation/intent.json`
- `framework/runtime/presentation-runtime-state.js`
  - helpers for writing `render-state.json`, `artifacts.json`, and `last-good.json`
- `framework/runtime/__tests__/presentation-package.test.mjs`
  - structural manifest generation tests
- `framework/runtime/__tests__/presentation-runtime-state.test.mjs`
  - runtime evidence writing tests
- `project-agent/project-dot-claude/hooks/check-presentation-package.mjs`
  - stop-hook orchestrator for manifest sync + validation + runtime evidence
- `project-agent/project-dot-claude/hooks/lib/presentation-hook-runner.mjs`
  - small hook orchestration helper
- `project-agent/project-dot-claude/hooks/lib/git-checkpoint.mjs`
  - optional clean-stop git checkpoint helper
- `framework/application/__tests__/presentation-package-integration.test.mjs`
  - end-to-end project package integration tests

### Modified files

- `framework/runtime/services/scaffold-service.mjs`
  - scaffold `intent.json`, `.presentation/runtime/`, and initial generated files
- `framework/runtime/deck-paths.js`
  - add canonical paths for `intent.json`, `package.generated.json`, and runtime evidence files
- `framework/runtime/project-state.js`
  - derive state using generated package/runtime evidence where appropriate
- `framework/runtime/deck-assemble.js`
  - ensure generated package sync occurs before assembly
- `framework/runtime/services/check-service.mjs`
  - update `render-state.json`
- `framework/runtime/services/capture-service.mjs`
  - update `artifacts.json` and render evidence
- `framework/runtime/services/export-service.mjs`
  - update `artifacts.json` on PDF/PNG export
- `framework/runtime/services/finalize-service.mjs`
  - update all runtime evidence files including `last-good.json`
- `framework/application/project-query-service.mjs`
  - surface package/runtime evidence to Electron-facing project queries as needed
- `project-agent/project-dot-claude/settings.json`
  - swap single stop hook to package-oriented orchestrator
- `project-agent/project-dot-claude/rules/framework.md`
  - remove “folder naming is the manifest” language
- `project-agent/project-dot-claude/rules/file-boundaries.md`
  - add `.presentation/intent.json` as editable, generated/runtime JSON as read-only
- `project-agent/project-dot-claude/rules/authoring-rules.md`
  - instruct agents to author intent and content only
- `docs/presentation-package-spec.md`
  - mark implemented vs pending pieces as work completes
- `AGENTS.md`
  - add the new package/runtime ownership rules once implemented

### Existing files to reference while implementing

- `framework/application/project-scaffold-service.mjs`
- `framework/runtime/services/scaffold-service.mjs`
- `framework/runtime/deck-source.js`
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-policy.js`
- `framework/runtime/project-quality-check.mjs`
- `framework/runtime/services/check-service.mjs`
- `framework/runtime/services/capture-service.mjs`
- `framework/runtime/services/export-service.mjs`
- `framework/runtime/services/finalize-service.mjs`
- `project-agent/project-dot-claude/hooks/check-slide-quality.mjs`
- `docs/presentation-package-spec.md`

---

## Chunk 1: Package Model Foundations

### Task 1: Add canonical package paths and file contracts

**Files:**
- Modify: `framework/runtime/deck-paths.js`
- Test: `framework/runtime/__tests__/presentation-package.test.mjs`

- [ ] **Step 1: Write the failing path-contract test**

```js
test('getProjectPaths exposes canonical presentation package files', () => {
  const paths = getProjectPaths(projectRoot);
  assert.equal(paths.intentRel, '.presentation/intent.json');
  assert.equal(paths.packageManifestRel, '.presentation/package.generated.json');
  assert.equal(paths.runtimeDirRel, '.presentation/runtime');
  assert.equal(paths.renderStateRel, '.presentation/runtime/render-state.json');
  assert.equal(paths.artifactsRel, '.presentation/runtime/artifacts.json');
  assert.equal(paths.lastGoodRel, '.presentation/runtime/last-good.json');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test framework/runtime/__tests__/presentation-package.test.mjs`
Expected: FAIL because the new package path properties do not exist yet.

- [ ] **Step 3: Add canonical path fields in `deck-paths.js`**

Implement:
- `.presentation/intent.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/last-good.json`

- [ ] **Step 4: Run the test again**

Run: `node --test framework/runtime/__tests__/presentation-package.test.mjs`
Expected: PASS for the new path contract.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/deck-paths.js framework/runtime/__tests__/presentation-package.test.mjs
git commit -m "feat: add presentation package path contract"
```

### Task 2: Add deterministic package generation

**Files:**
- Create: `framework/runtime/presentation-package.js`
- Modify: `framework/runtime/services/scaffold-service.mjs`
- Test: `framework/runtime/__tests__/presentation-package.test.mjs`

- [ ] **Step 1: Write failing generation tests**

```js
test('generatePresentationPackageManifest derives slides from source tree', () => {
  const manifest = generatePresentationPackageManifest(projectRoot);
  assert.deepEqual(manifest.slides.map((slide) => slide.id), ['intro', 'close']);
});

test('scaffold writes package.generated.json and intent.json', () => {
  createPresentationScaffold({ projectRoot }, { slideCount: 2 });
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'intent.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'package.generated.json')));
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `node --test framework/runtime/__tests__/presentation-package.test.mjs`
Expected: FAIL because no package generator exists yet.

- [ ] **Step 3: Implement the generator and scaffold writes**

In `presentation-package.js`, add:
- `generatePresentationPackageManifest(projectRoot)`
- `writePresentationPackageManifest(projectRoot)`

In `scaffold-service.mjs`, add:
- initial `.presentation/intent.json`
- initial `.presentation/package.generated.json`
- `.presentation/runtime/` directory creation

- [ ] **Step 4: Run the tests again**

Run: `node --test framework/runtime/__tests__/presentation-package.test.mjs`
Expected: PASS with correct generated manifest shape and initial scaffold files.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/presentation-package.js framework/runtime/services/scaffold-service.mjs framework/runtime/__tests__/presentation-package.test.mjs
git commit -m "feat: generate deterministic presentation package manifests"
```

---

## Chunk 2: Runtime Evidence Model

### Task 3: Add runtime evidence writers

**Files:**
- Create: `framework/runtime/presentation-runtime-state.js`
- Test: `framework/runtime/__tests__/presentation-runtime-state.test.mjs`

- [ ] **Step 1: Write failing evidence tests**

```js
test('writeRenderState persists runtime validation truth', () => {
  writeRenderState(projectRoot, {
    status: 'pass',
    slideIds: ['intro', 'close']
  });
  const json = readJson(renderStatePath);
  assert.equal(json.status, 'pass');
  assert.deepEqual(json.slideIds, ['intro', 'close']);
});

test('writeArtifacts persists output inventory', () => {
  writeArtifacts(projectRoot, {
    pdf: 'outputs/deck.pdf',
    slides: ['outputs/slides/slide-intro.png']
  });
  const json = readJson(artifactsPath);
  assert.equal(json.pdf.path, 'outputs/deck.pdf');
});
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `node --test framework/runtime/__tests__/presentation-runtime-state.test.mjs`
Expected: FAIL because the evidence writer module does not exist.

- [ ] **Step 3: Implement runtime evidence helpers**

Add helpers:
- `writeRenderState(projectRoot, payload)`
- `writeArtifacts(projectRoot, payload)`
- `writeLastGood(projectRoot, payload)`

These helpers should:
- normalize relative paths
- set `schemaVersion`
- create parent dirs safely
- write pretty JSON with trailing newline

- [ ] **Step 4: Re-run the tests**

Run: `node --test framework/runtime/__tests__/presentation-runtime-state.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/presentation-runtime-state.js framework/runtime/__tests__/presentation-runtime-state.test.mjs
git commit -m "feat: add presentation runtime evidence writers"
```

### Task 4: Wire runtime evidence into check/capture/export/finalize

**Files:**
- Modify: `framework/runtime/services/check-service.mjs`
- Modify: `framework/runtime/services/capture-service.mjs`
- Modify: `framework/runtime/services/export-service.mjs`
- Modify: `framework/runtime/services/finalize-service.mjs`
- Test: `framework/runtime/services/__tests__/runtime-services.test.mjs`

- [ ] **Step 1: Write failing service integration tests**

Add tests asserting:
- `check` writes `.presentation/runtime/render-state.json`
- `capture` writes `artifacts.json`
- `exportPresentation` updates `artifacts.json`
- `finalizePresentation` updates `render-state.json`, `artifacts.json`, and `last-good.json`

- [ ] **Step 2: Run only the runtime service suite**

Run: `node --test framework/runtime/services/__tests__/runtime-services.test.mjs`
Expected: FAIL with missing runtime evidence files.

- [ ] **Step 3: Implement evidence updates**

Behavior:
- `check` writes current validation state
- `capture` writes screenshot inventory and render state
- `export` records user-facing PDF/PNG outputs
- `finalize` writes a full evidence set and updates `last-good.json` only on pass / clean needs-review policy you explicitly choose

- [ ] **Step 4: Re-run the service suite**

Run: `node --test framework/runtime/services/__tests__/runtime-services.test.mjs`
Expected: PASS with runtime evidence files written correctly.

- [ ] **Step 5: Commit**

```bash
git add framework/runtime/services/check-service.mjs framework/runtime/services/capture-service.mjs framework/runtime/services/export-service.mjs framework/runtime/services/finalize-service.mjs framework/runtime/services/__tests__/runtime-services.test.mjs
git commit -m "feat: persist presentation runtime evidence"
```

---

## Chunk 3: Hook Enforcement

### Task 5: Replace the single quality hook with a package-oriented stop pipeline

**Files:**
- Create: `project-agent/project-dot-claude/hooks/check-presentation-package.mjs`
- Create: `project-agent/project-dot-claude/hooks/lib/presentation-hook-runner.mjs`
- Create: `project-agent/project-dot-claude/hooks/lib/git-checkpoint.mjs`
- Modify: `project-agent/project-dot-claude/settings.json`
- Modify: `project-agent/project-dot-claude/hooks/check-slide-quality.mjs`
- Test: `project-agent/__tests__/agent-launcher.test.mjs`
- Test: `framework/application/__tests__/presentation-package-integration.test.mjs`

- [ ] **Step 1: Write failing pipeline tests**

Add tests asserting:
- stop hook regenerates `package.generated.json`
- stop hook fails when source and generated package drift
- stop hook updates runtime JSON files on clean pass
- stop hook only checkpoints git after clean package + render state

- [ ] **Step 2: Run the failing tests**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs project-agent/__tests__/agent-launcher.test.mjs`
Expected: FAIL because the new package hook does not exist.

- [ ] **Step 3: Implement stop-hook pipeline**

Pipeline order:
1. regenerate package manifest
2. validate source vs generated manifest
3. validate `intent.json` against generated manifest
4. run quality/policy/canvas/runtime checks
5. update runtime evidence files
6. optional git checkpoint

Keep the current quality checker as a helper, not the top-level hook contract.

- [ ] **Step 4: Re-run the targeted tests**

Run: `node --test framework/application/__tests__/presentation-package-integration.test.mjs project-agent/__tests__/agent-launcher.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add project-agent/project-dot-claude/settings.json project-agent/project-dot-claude/hooks/check-presentation-package.mjs project-agent/project-dot-claude/hooks/lib/presentation-hook-runner.mjs project-agent/project-dot-claude/hooks/lib/git-checkpoint.mjs project-agent/project-dot-claude/hooks/check-slide-quality.mjs project-agent/__tests__/agent-launcher.test.mjs framework/application/__tests__/presentation-package-integration.test.mjs
git commit -m "feat: enforce presentation package sync at stop hook"
```

---

## Chunk 4: Agent Contract and Project Queries

### Task 6: Update authoring rules to reflect read/write ownership

**Files:**
- Modify: `project-agent/project-dot-claude/rules/framework.md`
- Modify: `project-agent/project-dot-claude/rules/file-boundaries.md`
- Modify: `project-agent/project-dot-claude/rules/authoring-rules.md`
- Modify: `project-agent/project-claude-md.md`
- Test: `framework/application/__tests__/boundary-contract.test.mjs`

- [ ] **Step 1: Write failing rule-contract assertions**

Add assertions that:
- no rule says “folder naming is the manifest”
- `.presentation/intent.json` is explicitly editable
- generated/runtime JSON files are explicitly read-only

- [ ] **Step 2: Run the failing test**

Run: `node --test framework/application/__tests__/boundary-contract.test.mjs`
Expected: FAIL because the rules still describe the old manifest model.

- [ ] **Step 3: Update the rules and maintainer contract**

Rewrite the authoring language so agents understand:
- content + intent are editable
- generated structure is deterministic
- runtime evidence is read-only
- hooks will regenerate package truth automatically

- [ ] **Step 4: Re-run the test**

Run: `node --test framework/application/__tests__/boundary-contract.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add project-agent/project-dot-claude/rules/framework.md project-agent/project-dot-claude/rules/file-boundaries.md project-agent/project-dot-claude/rules/authoring-rules.md project-agent/project-claude-md.md framework/application/__tests__/boundary-contract.test.mjs
git commit -m "docs: define agent ownership in presentation package"
```

### Task 7: Surface package and runtime evidence through project queries

**Files:**
- Modify: `framework/application/project-query-service.mjs`
- Modify: `framework/runtime/project-state.js`
- Test: `framework/application/__tests__/project-query-service.test.mjs`

- [ ] **Step 1: Write failing query tests**

Add tests for:
- `project.getState()` reflecting generated package/runtime evidence instead of only inferred source state
- `project.getMeta()` surfacing package-mode fields when useful
- `preview.getMeta()` remaining viewer-only while reading deterministic runtime state where appropriate

- [ ] **Step 2: Run the failing tests**

Run: `node --test framework/application/__tests__/project-query-service.test.mjs`
Expected: FAIL because query service does not yet read the new package/runtime files.

- [ ] **Step 3: Implement the minimal query integration**

Do not expose raw internals to Electron.
Keep Electron-facing responses product-shaped, but back them with:
- generated package state
- runtime render state
- runtime artifact inventory

- [ ] **Step 4: Re-run the query tests**

Run: `node --test framework/application/__tests__/project-query-service.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add framework/application/project-query-service.mjs framework/runtime/project-state.js framework/application/__tests__/project-query-service.test.mjs
git commit -m "feat: back project queries with package and runtime state"
```

---

## Chunk 5: Migration and Regression Closure

### Task 8: Migrate scaffolded projects and document the package model

**Files:**
- Modify: `framework/runtime/services/scaffold-service.mjs`
- Modify: `framework/runtime/project-cli-shim.mjs`
- Modify: `docs/presentation-package-spec.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `START-HERE.md`

- [ ] **Step 1: Add a migration strategy note to the tests**

Add test coverage ensuring:
- new scaffolds contain `intent.json`
- runtime dirs exist
- legacy projects without generated/runtime files can regenerate them safely on check/finalize

- [ ] **Step 2: Run the relevant scaffold/runtime tests**

Run: `node --test framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/presentation-package.test.mjs`
Expected: FAIL until migration behavior is implemented.

- [ ] **Step 3: Implement migration behavior**

Behavior:
- scaffold writes all new files for new projects
- legacy projects regenerate missing generated/runtime files on first check/finalize/preview
- no manual migration step required for existing decks

- [ ] **Step 4: Update docs**

Update:
- maintainer docs
- quickstart docs
- package spec status section

- [ ] **Step 5: Re-run the scaffold/runtime tests**

Run: `node --test framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/presentation-package.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add framework/runtime/services/scaffold-service.mjs framework/runtime/project-cli-shim.mjs docs/presentation-package-spec.md AGENTS.md README.md START-HERE.md framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/presentation-package.test.mjs
git commit -m "feat: scaffold and migrate presentation package files"
```

### Task 9: Full regression sweep

**Files:**
- Test only

- [ ] **Step 1: Run focused package/runtime suites**

Run:

```bash
node --test framework/runtime/__tests__/presentation-package.test.mjs
node --test framework/runtime/__tests__/presentation-runtime-state.test.mjs
node --test framework/runtime/services/__tests__/runtime-services.test.mjs
node --test framework/application/__tests__/project-query-service.test.mjs
node --test framework/application/__tests__/boundary-contract.test.mjs
node --test framework/application/__tests__/presentation-package-integration.test.mjs
node --test project-agent/__tests__/agent-launcher.test.mjs
```

Expected: all PASS.

- [ ] **Step 2: Run full repo tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Run project lifecycle smoke**

Run:

```bash
TMP_PROJECT="$(mktemp -d /tmp/pf-package-XXXXXX)"
npm run new -- --project "$TMP_PROJECT" --slides 2
node "$TMP_PROJECT/.presentation/framework-cli.mjs" check
node "$TMP_PROJECT/.presentation/framework-cli.mjs" finalize
npm run check -- --project "$TMP_PROJECT"
npm run finalize -- --project "$TMP_PROJECT"
```

Expected:
- scaffold succeeds
- generated package files exist
- runtime evidence files exist
- finalize produces outputs and `last-good.json`

- [ ] **Step 4: Verify cleanup**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Commit final integration**

```bash
git add -A
git commit -m "feat: implement deterministic presentation package model"
```

---

## Notes For The Implementer

- Keep the generated package manifest deterministic and derived from source only.
- Do not let the agent write runtime evidence files directly.
- Do not push git history into the runtime JSON layer; only reference commits from `last-good.json`.
- Keep Electron-facing project/preview APIs product-shaped. Do not expose raw package internals unless they are needed for a product use case.
- Keep the hook orchestrator modular: one stop entrypoint, multiple deterministic validation phases.
- Prefer automatic regeneration of missing package/runtime files for legacy projects over one-off migration commands.

## Recommended Execution Order

1. package paths
2. deterministic manifest generation
3. runtime evidence writers
4. runtime services integration
5. stop-hook pipeline
6. rules/docs updates
7. query integration
8. migration behavior
9. full regression and final integration commit

Plan complete and saved to `docs/superpowers/plans/2026-03-22-presentation-package-implementation.md`. Ready to execute?
