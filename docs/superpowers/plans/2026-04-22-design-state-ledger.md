# Design State Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate `.presentation/runtime/design-state.json` as a runtime-owned context ledger that orients agents to canvas, theme, content, package, and evidence state without creating a second source of truth.

**Architecture:** Add a small runtime design-state service that derives observable facts from existing authoritative files: `canvas-contract.mjs`, `theme.css`, `.presentation/intent.json`, `.presentation/package.generated.json`, `slides/`, and runtime evidence. Extend package/runtime state paths so scaffold, inspect, status, audit, preview, export, and finalize can refresh the ledger and surface it as evidence. Keep theme and content `working` until export/finalize; drift detection means stale generated context or cross-layer bypass, not ordinary user edits.

**Tech Stack:** Node.js ESM, Node test runner, runtime JSON evidence files, existing `presentation` CLI, existing policy/audit services, project-local `.presentation/framework-cli.mjs` shim.

---

## File Structure / Responsibility Map

### Runtime path and evidence foundation
- Modify: `framework/runtime/deck-paths.js`
  - Add `PROJECT_DESIGN_STATE_FILENAME`.
  - Add `designStateRel` and `designStateAbs` to system/project path records.
- Modify: `framework/runtime/presentation-runtime-state.js`
  - Create/read/write/ensure the design-state evidence file.
  - Keep render-state and artifacts behavior unchanged.
- Modify: `framework/runtime/source-fingerprint.js`
  - Add reusable file/path fingerprint helpers so the ledger can fingerprint specific source surfaces without duplicating hashing logic.
- Test: `framework/runtime/__tests__/presentation-runtime-state.test.mjs`

### Design state generation
- Create: `framework/runtime/design-state.js`
  - Build the ledger from existing authoritative sources.
  - Extract conservative facts only: canvas contract values, protected selectors, allowed canvas theme variables, theme CSS variables/classes/canvas hook usage, intent slide purposes, slide roots, slide CSS files, asset references, source fingerprints, and current runtime evidence references.
  - Avoid subjective theme interpretation.
- Test: `framework/runtime/__tests__/design-state.test.mjs`

### Lifecycle integration
- Modify: `framework/runtime/presentation-package.js`
  - Ensure the design-state evidence file exists without always refreshing it.
  - Keep lower-level stale detection possible.
- Modify: `framework/runtime/services/scaffold-service.mjs`
  - Ensure scaffolded projects receive `.presentation/runtime/design-state.json`.
  - Include the file in `init` created-file output.
- Modify: `framework/runtime/presentation-core.mjs`
  - Include the ledger in `inspect package`.
  - Include the ledger in status evidence.
  - Refresh the ledger after audit, preview, export, and finalize command paths.
  - Include the ledger in `evidenceUpdated` when runtime evidence is refreshed.
- Test: `framework/runtime/__tests__/presentation-core.test.mjs`
- Test: `framework/runtime/__tests__/presentation-cli.test.mjs`
- Test: `framework/runtime/__tests__/shellless-package-integration.test.mjs`

### Agent-facing guidance
- Modify: `project-agent/project-agents-md.md`
- Modify: `project-agent/project-dot-claude/rules/framework.md`
- Modify: `project-agent/project-dot-claude/rules/authoring-rules.md`
- Modify: `project-agent/project-dot-claude/rules/file-boundaries.md`
- Modify: `docs/base-canvas-contract.md`
- Modify: `docs/presentation-package-spec.md`
  - Teach agents to read `.presentation/runtime/design-state.json` first, then follow authority pointers to source files.
  - Make clear that the ledger is generated evidence, not an editable design file.
- Test: `project-agent/__tests__/scaffold-package.test.mjs`

---

### Task 1: Add Design State Runtime Path And Evidence Helpers

**Files:**
- Modify: `framework/runtime/deck-paths.js`
- Modify: `framework/runtime/presentation-runtime-state.js`
- Modify: `framework/runtime/source-fingerprint.js`
- Test: `framework/runtime/__tests__/presentation-runtime-state.test.mjs`

- [ ] **Step 1: Write failing tests for design-state path and runtime-state creation**

Add this test to `framework/runtime/__tests__/presentation-runtime-state.test.mjs`:

```js
test('ensurePresentationRuntimeStateFiles creates design-state evidence alongside render-state and artifacts', async (t) => {
  const [{ createPresentationScaffold }, {
    ensurePresentationRuntimeStateFiles,
    readDesignState,
  }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  rmSync(resolve(projectRoot, '.presentation', 'runtime'), { recursive: true, force: true });

  const state = ensurePresentationRuntimeStateFiles(projectRoot);
  const designStatePath = resolve(projectRoot, '.presentation', 'runtime', 'design-state.json');

  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'render-state.json')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json')));
  assert.ok(existsSync(designStatePath));
  assert.equal(state.designState.kind, 'presentation-design-state');
  assert.equal(readDesignState(projectRoot).kind, 'presentation-design-state');
});
```

Add this test to the same file:

```js
test('writeDesignState persists generated design-state evidence', async (t) => {
  const [{ createPresentationScaffold }, { writeDesignState }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../presentation-runtime-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  const designStatePath = resolve(projectRoot, '.presentation', 'runtime', 'design-state.json');

  writeDesignState(projectRoot, {
    sourceFingerprint: 'sha256:test',
    canvas: { status: 'fixed' },
    theme: { status: 'working', source: 'theme.css' },
  });

  const json = readJson(designStatePath);
  assert.equal(json.schemaVersion, 1);
  assert.equal(json.kind, 'presentation-design-state');
  assert.equal(json.sourceFingerprint, 'sha256:test');
  assert.equal(json.canvas.status, 'fixed');
  assert.equal(json.theme.status, 'working');
});
```

- [ ] **Step 2: Run the targeted runtime-state test and confirm it fails**

Run:

```bash
node --test framework/runtime/__tests__/presentation-runtime-state.test.mjs
```

Expected: FAIL because `design-state.json`, `readDesignState`, and `writeDesignState` do not exist yet.

- [ ] **Step 3: Add design-state path constants**

Modify `framework/runtime/deck-paths.js`:

```js
export const PROJECT_DESIGN_STATE_FILENAME = 'design-state.json';
```

Update `getProjectSystemPaths(projectRootInput)`:

```js
const designStateAbs = resolve(runtimeDirAbs, PROJECT_DESIGN_STATE_FILENAME);
```

Return it from the same function:

```js
designStateAbs,
```

Update `getProjectPaths(projectRootInput)`:

```js
designStateRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_RUNTIME_DIRNAME}/${PROJECT_DESIGN_STATE_FILENAME}`,
designStateAbs: systemPaths.designStateAbs,
```

- [ ] **Step 4: Add reusable fingerprint helpers**

Modify `framework/runtime/source-fingerprint.js`:

```js
export function computeFileFingerprint(absPath) {
  const stats = statSync(absPath, { throwIfNoEntry: false });
  if (!stats || !stats.isFile()) {
    return '';
  }

  const hash = createHash('sha256');
  hash.update(readFileSync(absPath));
  return `sha256:${hash.digest('hex')}`;
}

export function computePathFingerprint(projectRootAbs, relativePath) {
  const files = [];
  collectFingerprintFiles(projectRootAbs, relativePath, files);
  files.sort();

  if (files.length === 0) {
    return '';
  }

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`${file}\n`);
    hash.update(readFileSync(resolve(projectRootAbs, file)));
    hash.update('\n');
  }

  return `sha256:${hash.digest('hex')}`;
}
```

- [ ] **Step 5: Add design-state runtime-state helpers**

Modify `framework/runtime/presentation-runtime-state.js`:

```js
export function createInitialDesignState() {
  return {
    schemaVersion: 1,
    kind: 'presentation-design-state',
    sourceFingerprint: '',
    generatedAt: null,
    project: null,
    authority: {
      canvas: 'framework/canvas/canvas-contract.mjs',
      theme: 'theme.css',
      intent: '.presentation/intent.json',
      structure: '.presentation/package.generated.json',
      runtime: '.presentation/runtime/',
    },
    canvas: {
      status: 'fixed',
      stage: null,
      structuralTokens: [],
      protectedSelectors: [],
      allowedThemeVariables: [],
    },
    theme: {
      status: 'working',
      source: 'theme.css',
      fingerprint: '',
      observedTokens: [],
      observedPrimitives: [],
      canvasVariablesUsed: [],
      assetReferences: [],
    },
    narrative: {
      status: 'working',
      sources: ['.presentation/intent.json', 'outline.md', 'slides/'],
      slideCount: 0,
      slidePurposes: [],
    },
    content: {
      status: 'working',
      slideRoots: [],
      slideCssFiles: [],
      assetReferences: [],
    },
    audit: {
      lastKnownStatus: 'unknown',
      families: {},
    },
    driftRules: {
      changeIsAllowed: true,
      untrackedLayerBypassIsNotAllowed: true,
    },
    fingerprints: {},
  };
}

export function writeDesignState(projectRootInput, payload = {}) {
  const paths = getProjectPaths(projectRootInput);
  const base = createInitialDesignState();
  const designState = {
    ...base,
    ...payload,
    kind: 'presentation-design-state',
    schemaVersion: 1,
    sourceFingerprint: payload.sourceFingerprint || base.sourceFingerprint,
    generatedAt: payload.generatedAt || new Date().toISOString(),
  };
  writeJson(paths.designStateAbs, designState);
  return designState;
}

export function readDesignState(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return readJson(paths.designStateAbs);
}
```

Update `ensurePresentationRuntimeStateFiles(projectRootInput)`:

```js
if (!existsSync(paths.designStateAbs)) {
  writeJson(paths.designStateAbs, createInitialDesignState());
}

return {
  renderState: readJson(paths.renderStateAbs),
  artifacts: normalizeArtifacts(readJson(paths.artifactsAbs) || {}),
  designState: readJson(paths.designStateAbs),
};
```

- [ ] **Step 6: Run the targeted test**

Run:

```bash
node --test framework/runtime/__tests__/presentation-runtime-state.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 1**

```bash
git add framework/runtime/deck-paths.js framework/runtime/presentation-runtime-state.js framework/runtime/source-fingerprint.js framework/runtime/__tests__/presentation-runtime-state.test.mjs
git commit -m "Add design state runtime evidence file"
```

---

### Task 2: Build The Generated Design State Service

**Files:**
- Create: `framework/runtime/design-state.js`
- Modify: `framework/runtime/source-fingerprint.js`
- Test: `framework/runtime/__tests__/design-state.test.mjs`

- [ ] **Step 1: Write failing tests for conservative ledger generation**

Create `framework/runtime/__tests__/design-state.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-design-state-'));
}

test('buildDesignState reports canvas as fixed and theme/content as working', async (t) => {
  const [{ createPresentationScaffold }, { buildDesignState }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../design-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const state = buildDesignState(projectRoot);

  assert.equal(state.kind, 'presentation-design-state');
  assert.equal(state.canvas.status, 'fixed');
  assert.equal(state.canvas.stage.slideRatio, '16 / 9');
  assert.equal(state.theme.status, 'working');
  assert.equal(state.theme.source, 'theme.css');
  assert.equal(state.narrative.status, 'working');
  assert.equal(state.content.status, 'working');
  assert.deepEqual(state.driftRules, {
    changeIsAllowed: true,
    untrackedLayerBypassIsNotAllowed: true,
  });
});

test('buildDesignState extracts theme tokens, primitives, canvas hooks, slide roots, and slide intent', async (t) => {
  const [{ createPresentationScaffold }, { buildDesignState }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../design-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  writeFileSync(
    resolve(projectRoot, 'theme.css'),
    [
      '@layer theme {',
      '  :root {',
      '    --color-accent: #a52020;',
      '    --canvas-slide-bg: var(--color-accent);',
      '  }',
      '  .hero-title { color: var(--color-accent); }',
      '  .image-treatment { background-image: url("./assets/hero.png"); }',
      '}',
      '',
    ].join('\n')
  );
  writeFileSync(
    resolve(projectRoot, '.presentation', 'intent.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      presentationTitle: 'Ledger Test',
      slideIntent: {
        intro: {
          purpose: 'Open with the core claim.',
          visualIntent: 'Use one strong hero image.',
        },
      },
    }, null, 2)}\n`
  );

  const state = buildDesignState(projectRoot);

  assert.ok(state.theme.observedTokens.includes('--color-accent'));
  assert.ok(state.theme.observedPrimitives.includes('.hero-title'));
  assert.ok(state.theme.canvasVariablesUsed.includes('--canvas-slide-bg'));
  assert.deepEqual(state.theme.assetReferences, ['./assets/hero.png']);
  assert.deepEqual(state.content.slideRoots, [{ slideId: 'intro', rootClass: 'slide slide-hero' }]);
  assert.deepEqual(state.narrative.slidePurposes, [{
    slideId: 'intro',
    purpose: 'Open with the core claim.',
    visualIntent: 'Use one strong hero image.',
  }]);
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
node --test framework/runtime/__tests__/design-state.test.mjs
```

Expected: FAIL because `framework/runtime/design-state.js` does not exist.

- [ ] **Step 3: Create the design-state service**

Create `framework/runtime/design-state.js`:

```js
import { existsSync, readFileSync } from 'node:fs';

import {
  CANVAS_STAGE,
  CANVAS_STRUCTURAL_TOKENS,
  CANVAS_THEME_VARIABLE_ALLOWLIST,
  PROTECTED_CANVAS_SELECTORS,
} from '../canvas/canvas-contract.mjs';
import { getProjectPaths } from './deck-paths.js';
import { listSlideSourceEntries } from './deck-source.js';
import { readPresentationIntent } from './presentation-intent.js';
import { readArtifacts, readRenderState, writeDesignState } from './presentation-runtime-state.js';
import { computeFileFingerprint, computePathFingerprint, computeSourceFingerprint } from './source-fingerprint.js';

const CSS_VARIABLE_RE = /(--[a-z0-9-]+)\s*:/gi;
const CLASS_SELECTOR_RE = /(^|[\\s,{])\\.([a-z][a-z0-9_-]*)\\b/gi;
const URL_RE = /url\\((['"]?)(.*?)\\1\\)/gi;
const SLIDE_ROOT_RE = /<([a-z][a-z0-9-]*)\\b[^>]*class=(["'])([^"']*\\bslide(?:\\s|\\b)[^"']*)\\2/i;

function readIfExists(absPath) {
  if (!existsSync(absPath)) {
    return '';
  }
  return readFileSync(absPath, 'utf8');
}

function readJsonIfExists(absPath) {
  const content = readIfExists(absPath);
  return content ? JSON.parse(content) : null;
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function extractCssVariables(css) {
  return uniqueSorted([...css.matchAll(CSS_VARIABLE_RE)].map((match) => match[1]));
}

function extractCssClasses(css) {
  return uniqueSorted([...css.matchAll(CLASS_SELECTOR_RE)].map((match) => `.${match[2]}`));
}

function extractUrlReferences(css) {
  return uniqueSorted([...css.matchAll(URL_RE)].map((match) => match[2]).filter((value) => value && !value.startsWith('data:')));
}

function extractCanvasVariablesUsed(tokens) {
  return tokens.filter((token) => token.startsWith('--canvas-'));
}

function extractSlideRoot(slideEntry) {
  const html = readIfExists(slideEntry.slideHtmlAbs);
  const match = html.match(SLIDE_ROOT_RE);
  return {
    slideId: slideEntry.slideId,
    rootClass: match ? match[3].trim().replace(/\\s+/g, ' ') : '',
  };
}

function extractSlidePurposes(intent, slideEntries) {
  const slideIntent = intent?.slideIntent && typeof intent.slideIntent === 'object'
    ? intent.slideIntent
    : {};

  return slideEntries.map((entry) => {
    const value = slideIntent[entry.slideId];
    if (typeof value === 'string') {
      return { slideId: entry.slideId, purpose: value, visualIntent: '' };
    }
    if (value && typeof value === 'object') {
      return {
        slideId: entry.slideId,
        purpose: String(value.purpose || value.narrative || '').trim(),
        visualIntent: String(value.visualIntent || '').trim(),
      };
    }
    return { slideId: entry.slideId, purpose: '', visualIntent: '' };
  });
}

export function buildDesignState(projectRootInput, options = {}) {
  const paths = getProjectPaths(projectRootInput);
  const manifest = options.manifest || readJsonIfExists(paths.packageManifestAbs);
  const intent = options.intent || readPresentationIntent(paths.projectRootAbs);
  const renderState = options.renderState || readRenderState(paths.projectRootAbs);
  const artifacts = options.artifacts || readArtifacts(paths.projectRootAbs);
  const slideEntries = listSlideSourceEntries(paths).filter((entry) => entry.isValidName);
  const themeCss = readIfExists(paths.themeCssAbs);
  const observedTokens = extractCssVariables(themeCss);

  return {
    schemaVersion: 1,
    kind: 'presentation-design-state',
    sourceFingerprint: computeSourceFingerprint(paths.projectRootAbs),
    generatedAt: new Date().toISOString(),
    project: {
      root: paths.projectRootAbs,
      slug: paths.slug,
      title: paths.title,
    },
    authority: {
      canvas: 'framework/canvas/canvas-contract.mjs',
      theme: paths.themeCssRel,
      intent: paths.intentRel,
      structure: paths.packageManifestRel,
      runtime: `${paths.runtimeDirRel}/`,
    },
    canvas: {
      status: 'fixed',
      stage: {
        slideMaxWidth: CANVAS_STAGE.slideMaxWidth,
        slideWideMaxWidth: CANVAS_STAGE.slideWideMaxWidth,
        slideRatio: CANVAS_STAGE.slideRatio,
        viewport: { ...CANVAS_STAGE.viewport },
      },
      structuralTokens: [...CANVAS_STRUCTURAL_TOKENS],
      protectedSelectors: [...PROTECTED_CANVAS_SELECTORS],
      allowedThemeVariables: [...CANVAS_THEME_VARIABLE_ALLOWLIST],
    },
    theme: {
      status: 'working',
      source: paths.themeCssRel,
      fingerprint: computeFileFingerprint(paths.themeCssAbs),
      observedTokens,
      observedPrimitives: extractCssClasses(themeCss),
      canvasVariablesUsed: extractCanvasVariablesUsed(observedTokens),
      assetReferences: extractUrlReferences(themeCss),
    },
    narrative: {
      status: 'working',
      sources: [paths.intentRel, paths.outlineRel, `${paths.slidesDirRel}/`],
      slideCount: slideEntries.length,
      slidePurposes: extractSlidePurposes(intent, slideEntries),
    },
    content: {
      status: 'working',
      slideRoots: slideEntries.map((entry) => extractSlideRoot(entry)),
      slideCssFiles: slideEntries.filter((entry) => existsSync(entry.slideCssAbs)).map((entry) => entry.slideCssRel),
      assetReferences: slideEntries.flatMap((entry) => extractUrlReferences(readIfExists(entry.slideHtmlAbs))),
    },
    audit: {
      lastKnownStatus: String(renderState?.status || 'unknown'),
      families: {},
    },
    driftRules: {
      changeIsAllowed: true,
      untrackedLayerBypassIsNotAllowed: true,
    },
    fingerprints: {
      source: computeSourceFingerprint(paths.projectRootAbs),
      theme: computeFileFingerprint(paths.themeCssAbs),
      intent: computeFileFingerprint(paths.intentAbs),
      outline: computeFileFingerprint(paths.outlineAbs),
      slides: computePathFingerprint(paths.projectRootAbs, paths.slidesDirRel),
      packageManifest: computeFileFingerprint(paths.packageManifestAbs),
      renderState: computeFileFingerprint(paths.renderStateAbs),
      artifacts: computeFileFingerprint(paths.artifactsAbs),
    },
    evidence: {
      manifestAvailable: Boolean(manifest),
      renderStateAvailable: Boolean(renderState),
      artifactsAvailable: Boolean(artifacts),
    },
  };
}

export function refreshDesignState(projectRootInput, options = {}) {
  return writeDesignState(projectRootInput, buildDesignState(projectRootInput, options));
}
```

- [ ] **Step 4: Run the new design-state test**

Run:

```bash
node --test framework/runtime/__tests__/design-state.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add framework/runtime/design-state.js framework/runtime/source-fingerprint.js framework/runtime/__tests__/design-state.test.mjs
git commit -m "Generate design state ledger from project sources"
```

---

### Task 3: Refresh The Ledger In Package, Scaffold, And Core Lifecycles

**Files:**
- Modify: `framework/runtime/presentation-package.js`
- Modify: `framework/runtime/services/scaffold-service.mjs`
- Modify: `framework/runtime/presentation-core.mjs`
- Test: `framework/runtime/__tests__/presentation-core.test.mjs`
- Test: `framework/runtime/__tests__/presentation-cli.test.mjs`
- Test: `framework/runtime/__tests__/shellless-package-integration.test.mjs`

- [ ] **Step 1: Write failing tests for scaffold, inspect, status, audit, and finalize ledger refresh**

Add to `framework/runtime/__tests__/presentation-core.test.mjs`:

```js
test('inspectPackage includes generated design state and evidence path', async (t) => {
  const [{ createPresentationScaffold }, { createPresentationCore }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../presentation-core.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  const core = createPresentationCore();
  const result = core.inspectPackage(projectRoot, { target: 'package' });

  assert.equal(result.designState.kind, 'presentation-design-state');
  assert.ok(result.evidence.includes('.presentation/runtime/design-state.json'));
});
```

Add to `framework/runtime/__tests__/presentation-cli.test.mjs`:

```js
test('presentation-cli status includes design state evidence', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const result = runCli(['status', '--project', projectRoot, '--format', 'json']);
  const json = JSON.parse(result.stdout);

  assert.equal(result.exitCode, 0);
  assert.ok(json.evidence.includes('.presentation/runtime/design-state.json'));
});
```

Extend `framework/runtime/__tests__/shellless-package-integration.test.mjs` after `initJson` is parsed:

```js
assert.equal(existsSync(resolve(projectRoot, '.presentation', 'runtime', 'design-state.json')), true);
assert.ok(initJson.files.includes('.presentation/runtime/design-state.json'));
```

Extend the same integration test after finalize:

```js
const designState = JSON.parse(readFileSync(resolve(projectRoot, '.presentation', 'runtime', 'design-state.json'), 'utf8'));
assert.equal(designState.kind, 'presentation-design-state');
assert.equal(designState.theme.status, 'working');
assert.ok(finalizeJson.evidenceUpdated.includes('.presentation/runtime/design-state.json'));
```

- [ ] **Step 2: Run targeted tests and confirm failure**

Run:

```bash
node --test framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs
```

Expected: FAIL because core/CLI envelopes do not include design-state evidence yet.

- [ ] **Step 3: Return design-state evidence when package files are ensured without forcing refresh**

Modify `framework/runtime/presentation-package.js`:

```js
import { ensurePresentationRuntimeStateFiles } from './presentation-runtime-state.js';
```

Update `ensurePresentationPackageFiles(projectRootInput, options = {})`:

```js
const manifest = recordStructuralManifest(paths.projectRootAbs);
const runtimeState = ensurePresentationRuntimeStateFiles(paths.projectRootAbs);
return {
  paths,
  manifest,
  designState: runtimeState.designState,
};
```

- [ ] **Step 4: Include design-state in scaffold outputs**

Modify `framework/runtime/services/scaffold-service.mjs` imports:

```js
import { refreshDesignState } from '../design-state.js';
```

After `ensurePresentationRuntimeStateFiles(paths.sourceDirAbs);` add:

```js
refreshDesignState(paths.sourceDirAbs);
```

Add to `createdFiles`:

```js
createdFiles.push(`${paths.runtimeDirRel}/design-state.json`);
```

- [ ] **Step 5: Add design state to core status, inspect, audit, preview, export, and finalize paths**

Modify `framework/runtime/presentation-core.mjs` imports:

```js
import { refreshDesignState } from './design-state.js';
```

Update `buildStatusResult(state)` evidence:

```js
evidence: [
  '.presentation/runtime/render-state.json',
  '.presentation/runtime/artifacts.json',
  '.presentation/runtime/design-state.json',
],
```

Update `inspectPackage(projectRoot, options = {})`:

```js
const { paths, manifest } = services.ensurePresentationPackageFiles(projectRoot);
const designState = services.refreshDesignState(paths.projectRootAbs, { manifest });
const renderState = services.readRenderState(paths.projectRootAbs);
const artifacts = services.readArtifacts(paths.projectRootAbs);
const status = buildStatusResult(services.getProjectState(paths.projectRootAbs));

return {
  kind: 'presentation-package',
  projectRoot: paths.projectRootAbs,
  title: paths.title,
  slug: paths.slug,
  manifest,
  renderState,
  artifacts,
  designState,
  status,
  evidence: [
    paths.packageManifestRel,
    paths.renderStateRel,
    paths.artifactsRel,
    paths.designStateRel,
  ],
  freshness: {
    relativeToSource: status.freshness.relativeToSource,
  },
};
```

Add `refreshDesignState` to the `services` object:

```js
refreshDesignState,
```

After audit result is produced in `runAudit`, refresh the ledger and include evidence:

```js
const paths = services.getProjectPaths(projectRoot);
const designState = services.refreshDesignState(paths.projectRootAbs);
const evidence = Array.isArray(result.evidence) ? [...result.evidence] : [...nextFocus];
if (!evidence.includes(paths.designStateRel)) {
  evidence.push(paths.designStateRel);
}

return {
  kind: 'presentation-audit',
  family: result.family,
  projectRoot: result.scope.projectRoot,
  slideId: result.scope.slideId ?? null,
  status: result.status,
  issueCount: result.issueCount,
  issues: result.issues,
  nextFocus,
  evidence,
  designState,
  families: result.families,
};
```

Update `getStatus(projectRoot)` so public status refreshes the ledger before deriving status:

```js
getStatus(projectRoot) {
  return runInsideCoreMutationBoundary(() => {
    services.refreshDesignState(projectRoot);
    return buildStatusResult(services.getProjectState(projectRoot));
  });
},
```

In `getPreview(projectRoot)`, call:

```js
services.refreshDesignState(projectRoot);
```

before returning `buildPreviewResult(...)`.

In `finalize(projectRoot, options = {})`, refresh the ledger after `services.finalizePresentation(...)` and include it:

```js
const designState = services.refreshDesignState(paths.projectRootAbs);

return {
  kind: 'presentation-finalize',
  projectRoot: paths.projectRootAbs,
  status: result.status,
  outputs: result.outputs,
  designState,
  evidenceUpdated: [
    paths.renderStateRel,
    paths.artifactsRel,
    paths.designStateRel,
  ],
  issues: result.issues || [],
};
```

In `exportPresentation(projectRoot, options = {})`, refresh the ledger after the export operation and include it:

```js
const designState = services.refreshDesignState(paths.projectRootAbs);
const evidenceUpdated = result.evidenceUpdated || (target === 'pdf' ? [paths.artifactsRel] : []);
if (!evidenceUpdated.includes(paths.designStateRel)) {
  evidenceUpdated.push(paths.designStateRel);
}

return {
  kind: 'presentation-export',
  projectRoot: paths.projectRootAbs,
  status: result.status || 'pass',
  scope,
  outputDir: toProjectRelativeOutputPath(paths.projectRootAbs, result.outputDir, scope),
  artifacts: (result.outputPaths || []).map((outputPath) => toProjectRelativeOutputPath(paths.projectRootAbs, outputPath, scope)),
  designState,
  evidenceUpdated,
  issues: result.issues || [],
};
```

- [ ] **Step 6: Run targeted lifecycle tests**

Run:

```bash
node --test framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

```bash
git add framework/runtime/presentation-package.js framework/runtime/services/scaffold-service.mjs framework/runtime/presentation-core.mjs framework/runtime/__tests__/presentation-core.test.mjs framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs
git commit -m "Refresh design state through runtime lifecycle"
```

---

### Task 4: Add Deterministic Stale Ledger Detection To Status

**Files:**
- Modify: `framework/runtime/project-state.js`
- Modify: `framework/runtime/status-service.js`
- Test: `framework/runtime/__tests__/status-service.test.mjs`
- Test: `framework/runtime/__tests__/project-state.test.mjs`

- [ ] **Step 1: Write failing tests for stale design-state classification**

Add to `framework/runtime/__tests__/status-service.test.mjs`:

```js
test('derivePackageStatus focuses audit when design state is stale', async () => {
  const { derivePackageStatus } = await import('../status-service.js');

  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'not_finalized',
    evidence: 'current',
    designStateEvidence: 'stale',
  });

  assert.equal(status.workflow, 'authoring');
  assert.equal(status.facets.designState, 'stale');
  assert.deepEqual(status.nextFocus, ['presentation audit all']);
});
```

Add to `framework/runtime/__tests__/project-state.test.mjs`:

```js
test('getProjectState marks design state stale when source moves after ledger generation', async (t) => {
  const [{ createPresentationScaffold }, { getProjectState }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../project-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  writeFileSync(resolve(projectRoot, 'theme.css'), '@layer theme { :root { --color-accent: #000000; } }\\n');

  const state = getProjectState(projectRoot);

  assert.equal(state.facets.designState, 'stale');
  assert.ok(state.nextFocus.includes('presentation audit all'));
});
```

- [ ] **Step 2: Run targeted status tests and confirm failure**

Run:

```bash
node --test framework/runtime/__tests__/status-service.test.mjs framework/runtime/__tests__/project-state.test.mjs
```

Expected: FAIL because design-state freshness is not part of status facets.

- [ ] **Step 3: Add design-state facet support**

Modify `framework/runtime/status-service.js`:

```js
const DESIGN_STATE_FACETS = new Set([
  'current',
  'stale',
  'missing',
  'unknown',
]);

function normalizeDesignStateFacet(designStateEvidence) {
  if (DESIGN_STATE_FACETS.has(designStateEvidence)) {
    return designStateEvidence;
  }
  return 'unknown';
}
```

Update `derivePackageStatus(facts = {})`:

```js
const facets = {
  delivery: normalizeDeliveryFacet(facts.delivery, blockerCount),
  evidence: normalizeEvidenceFacet(facts.evidence),
  designState: normalizeDesignStateFacet(facts.designStateEvidence),
};
```

Update `buildSummary(workflow, facets)` authoring branch:

```js
if (facets.designState === 'stale' || facets.designState === 'missing') {
  return 'Authoring is still active because the generated design-state ledger is not current.';
}
```

Update `buildNextFocus(workflow, facets, facts = {})` authoring branch:

```js
if (facets.designState === 'stale' || facets.designState === 'missing') {
  return ['presentation audit all'];
}
```

Update workflow classification:

```js
} else if (facets.designState === 'stale' || facets.designState === 'missing') {
  workflow = 'authoring';
} else if (facets.delivery === 'finalized_current' && facets.evidence === 'current') {
```

- [ ] **Step 4: Resolve design-state freshness in project state**

Modify `framework/runtime/project-state.js` imports:

```js
import { readArtifacts, readDesignState, readRenderState } from './presentation-runtime-state.js';
```

Add helper:

```js
function resolveDesignStateFacet(designState, currentSourceFingerprint) {
  if (!designState) {
    return 'missing';
  }

  const designStateFingerprint = String(designState?.sourceFingerprint || '').trim();
  if (!designStateFingerprint || !currentSourceFingerprint) {
    return 'stale';
  }

  return designStateFingerprint === currentSourceFingerprint ? 'current' : 'stale';
}
```

In `getProjectState(projectRootInput)`, read and pass design state:

```js
const designState = readDesignState(paths.projectRootAbs);
const designStateEvidence = resolveDesignStateFacet(designState, currentSourceFingerprint);
```

Pass to `derivePackageStatus`:

```js
designStateEvidence,
```

Include in returned state:

```js
designStateAvailable: Boolean(designState),
lastDesignStateGeneratedAt: designState?.generatedAt || '',
```

- [ ] **Step 5: Run targeted status tests**

Run:

```bash
node --test framework/runtime/__tests__/status-service.test.mjs framework/runtime/__tests__/project-state.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add framework/runtime/status-service.js framework/runtime/project-state.js framework/runtime/__tests__/status-service.test.mjs framework/runtime/__tests__/project-state.test.mjs
git commit -m "Track design state freshness in project status"
```

---

### Task 5: Teach Scaffolded Agents To Read The Ledger First

**Files:**
- Modify: `project-agent/project-agents-md.md`
- Modify: `project-agent/project-dot-claude/rules/framework.md`
- Modify: `project-agent/project-dot-claude/rules/authoring-rules.md`
- Modify: `project-agent/project-dot-claude/rules/file-boundaries.md`
- Modify: `docs/base-canvas-contract.md`
- Modify: `docs/presentation-package-spec.md`
- Test: `project-agent/__tests__/scaffold-package.test.mjs`

- [ ] **Step 1: Write failing scaffold guidance tests**

Add to `project-agent/__tests__/scaffold-package.test.mjs`:

```js
test('scaffolded agent docs teach design-state ledger startup and ownership', () => {
  const scaffold = getProjectClaudeScaffoldPackage({ frameworkRoot: process.cwd() });
  const agentsEntry = scaffold.entries.find((entry) => entry.targetRel === '.claude/AGENTS.md');
  const frameworkRule = scaffold.entries.find((entry) => entry.targetRel === '.claude/rules/framework.md');

  assert.match(agentsEntry.content, /\\.presentation\\/runtime\\/design-state\\.json/);
  assert.match(agentsEntry.content, /generated evidence/i);
  assert.match(frameworkRule.content, /single context surface/i);
  assert.match(frameworkRule.content, /not.*source of truth/i);
});
```

- [ ] **Step 2: Run scaffold tests and confirm failure**

Run:

```bash
node --test project-agent/__tests__/scaffold-package.test.mjs
```

Expected: FAIL because scaffolded docs do not mention the design-state ledger yet.

- [ ] **Step 3: Update project agent startup order**

Modify `project-agent/project-agents-md.md` startup/read order to include:

```md
1. `.presentation/runtime/design-state.json`
2. `.presentation/project.json`
3. `.presentation/intent.json`
4. `.presentation/package.generated.json`
5. `.presentation/runtime/render-state.json`
6. `.presentation/runtime/artifacts.json`
```

Add this rule near the core authoring rules:

```md
- `.presentation/runtime/design-state.json` is generated evidence and the first orientation surface.
- Use it to find the current canvas/theme/content authorities.
- Do not edit it by hand; rerun the project-local CLI if it is missing or stale.
```

- [ ] **Step 4: Update scaffolded rules**

Modify `project-agent/project-dot-claude/rules/framework.md`:

```md
## Design State Ledger

Read `.presentation/runtime/design-state.json` first when it exists.

It is a generated context surface, not an editable source of truth.
It points to the authoritative canvas, theme, intent, structure, and runtime evidence files.

The rule is: single context surface, not single authority.
```

Modify `project-agent/project-dot-claude/rules/authoring-rules.md`:

```md
- If a theme/content change changes reusable visual language, update `theme.css` and rerun `node .presentation/framework-cli.mjs audit all` so the design-state ledger refreshes.
- If a change is slide-only, keep it in the slide source and let audit verify that it does not bypass theme or canvas.
- Never hand-edit `.presentation/runtime/design-state.json`.
```

Modify `project-agent/project-dot-claude/rules/file-boundaries.md`:

```md
Generated package and runtime truth are read-only:

- `<project>/.presentation/runtime/design-state.json`
```

- [ ] **Step 5: Update maintainer docs**

Modify `docs/base-canvas-contract.md` under runtime enforcement:

```md
The runtime also generates `.presentation/runtime/design-state.json` as an agent orientation ledger. The ledger records the fixed canvas contract and points agents back to `theme.css`, `.presentation/intent.json`, `outline.md`, and `slides/` for current theme and content truth.
```

Modify `docs/presentation-package-spec.md` in the runtime evidence section:

```md
- `.presentation/runtime/design-state.json` is generated design-state evidence. It is an index over canvas, theme, narrative, content, package structure, and runtime evidence. It is not authorable state.
```

- [ ] **Step 6: Run scaffold tests**

Run:

```bash
node --test project-agent/__tests__/scaffold-package.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add project-agent/project-agents-md.md project-agent/project-dot-claude/rules/framework.md project-agent/project-dot-claude/rules/authoring-rules.md project-agent/project-dot-claude/rules/file-boundaries.md docs/base-canvas-contract.md docs/presentation-package-spec.md project-agent/__tests__/scaffold-package.test.mjs
git commit -m "Teach agents to use the design state ledger"
```

---

### Task 6: Full Verification And Contract Smoke

**Files:**
- Test only; no planned source edits unless verification exposes a defect.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run shell-less CLI smoke with design-state checks**

Run:

```bash
TMP_ROOT="$(mktemp -d)"
TMP_PROJECT="$TMP_ROOT/demo"
mkdir -p "$TMP_ROOT/node_modules"
ln -s "$(pwd)" "$TMP_ROOT/node_modules/pitch-framework"

node framework/runtime/presentation-cli.mjs init --project "$TMP_PROJECT" --slides 1 --format json
test -f "$TMP_PROJECT/.presentation/runtime/design-state.json"
node "$TMP_PROJECT/.presentation/framework-cli.mjs" inspect package --format json
node "$TMP_PROJECT/.presentation/framework-cli.mjs" status --format json
node "$TMP_PROJECT/.presentation/framework-cli.mjs" audit all --format json
```

Expected:

- `init` exits `0`
- `design-state.json` exists
- `inspect package` includes `designState`
- `status` evidence includes `.presentation/runtime/design-state.json`
- `audit all` exits `0` for the one-slide scaffold after filling required brief content if policy requires it

- [ ] **Step 3: Verify stale detection manually**

Run:

```bash
node "$TMP_PROJECT/.presentation/framework-cli.mjs" audit all --format json >/tmp/design-ledger-audit.json
printf '\n@layer theme { .ledger-check { color: var(--color-accent); } }\n' >> "$TMP_PROJECT/theme.css"
PROJECT_ROOT="$TMP_PROJECT" node --input-type=module -e "import { getProjectState } from './framework/runtime/project-state.js'; console.log(getProjectState(process.env.PROJECT_ROOT).facets.designState)"
```

Expected: the direct low-level state read prints `stale`.

Then run:

```bash
node "$TMP_PROJECT/.presentation/framework-cli.mjs" status --format json
PROJECT_ROOT="$TMP_PROJECT" node --input-type=module -e "import { getProjectState } from './framework/runtime/project-state.js'; console.log(getProjectState(process.env.PROJECT_ROOT).facets.designState)"
```

Expected: public `status` refreshes the ledger, and the following direct low-level state read prints `current`.

- [ ] **Step 4: Inspect final git state**

Run:

```bash
git status --short
git log --oneline -6
```

Expected:

- working tree is clean after task commits
- recent commits correspond to the task commits above

- [ ] **Step 5: Commit verification-only fixes if needed**

If verification exposed a small defect, commit the defect fix with:

```bash
git add <changed-files>
git commit -m "Fix design state ledger verification"
```

If no defects were found, do not create an empty commit.

---

## Plan Self-Review Checklist

- Spec coverage: This plan implements the generated runtime ledger, source authority pointers, canvas/theme/content lifecycle, conservative extraction, refresh lifecycle, status freshness, scaffolded agent guidance, and final verification smoke from `docs/superpowers/specs/2026-04-22-design-state-ledger.md`.
- Second-source control: The ledger is generated into `.presentation/runtime/design-state.json`; authorable truth stays in `theme.css`, `.presentation/intent.json`, `outline.md`, and `slides/`.
- Scope control: V1 extracts concrete facts and fingerprints only. It does not judge taste, infer a full semantic design system, or create an author-maintained Google-style `DESIGN.md`.
- Open decision resolved for implementation: choose generated ledger first; do not add `designIntent` fields to `.presentation/intent.json` in this pass.
