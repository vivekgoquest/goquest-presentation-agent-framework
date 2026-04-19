# Action Trace: Export Presentation

**Use this when:** you need to understand or change the canonical PDF-delivery flow in the shell-less package.

**Read this after:** `docs/repo-call-flows.md` and `docs/repo-architecture-overview.md`.

**Do not confuse with:**
- `presentation export screenshots` — explicit PNG artifact export
- `presentation audit all` — deterministic validation without PDF delivery
- `presentation preview serve|open` — browser preview without artifact delivery

**Key files:**
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/presentation-core.mjs`
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/deck-assemble.js`
- `framework/runtime/runtime-app.js`
- `framework/runtime/pdf-export.js`

**Verification:**
- `npm test`
- `node --test framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs`
- a shell-less smoke with `presentation finalize --project /abs/path` or the repo-local/project-local equivalents

---

## What this action means now

There is no separate UI-owned export path anymore.

Canonical PDF delivery is triggered by CLI entrypoints:

- `presentation finalize --project /abs/path`
- `presentation export pdf --project /abs/path`

These are related but not identical:

- `finalize` is the explicit canonical delivery command
- `export pdf` with **no** `--output-dir` or `--output-file` reuses the same canonical finalize path
- `export pdf` **with** `--output-dir` or `--output-file` creates an extra PDF artifact inside the project instead of redefining the canonical finalized output

In all cases, the package updates only current runtime evidence:

- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`

The current product records delivery evidence only through `render-state.json` and `artifacts.json`.

## Entry commands

Typical commands are:

```bash
presentation finalize --project /abs/path/to/my-deck --format json
presentation export pdf --project /abs/path/to/my-deck --format json
presentation export pdf --project /abs/path/to/my-deck --output-dir outputs/manual-export --output-file deck.pdf
```

From a source checkout, use:

```bash
node framework/runtime/presentation-cli.mjs ...
```

Inside a scaffolded project, use:

```bash
node .presentation/framework-cli.mjs ...
```

## Trace A: canonical delivery through `presentation finalize`

## 1. The CLI parses the finalize request

Primary file:
- `framework/runtime/presentation-cli.mjs`

Path:
- `parsePresentationCliArgs(argv)`
- `runFinalizeCommand(parsed, command, core)`

Important validation:
- `finalize` requires `--project`
- `finalize` rejects `--output-dir`
- `finalize` rejects `--output-file`
- `finalize` rejects `--slide`
- `finalize` does not accept extra positionals

Why this matters:
- canonical delivery should stay unambiguous
- manual artifact routing belongs to `export`, not `finalize`

## 2. The CLI dispatches into the runtime core

Primary file:
- `framework/runtime/presentation-core.mjs`

Path:
- `core.finalize(projectRoot)`

What happens here:
- the runtime core preserves the authored-content mutation boundary
- finalize is run under the same shell-less core surface as the other commands
- the returned envelope includes `status`, `outputs`, `evidenceUpdated`, and `issues`

## 3. The finalize service owns the actual delivery work

Primary file:
- `framework/runtime/services/presentation-ops-service.mjs`

Function:
- `finalizePresentation(targetInput, options = {})`

High-level steps:
1. resolve project paths
2. remove stale legacy finalized-output directories if they exist
3. capture the current assembled deck into a temporary runtime directory
4. summarize rendered issues from the capture report
5. generate the canonical root PDF
6. refresh `.presentation/runtime/artifacts.json`
7. refresh `.presentation/runtime/render-state.json`
8. return pass/fail status plus artifact paths

## 4. Capture runs against the runtime preview stack

Still in `presentation-ops-service.mjs`:
- `capturePresentation(...)`

Supporting files:
- `framework/runtime/runtime-app.js`
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-policy.js`

What happens:
- the runtime preview app is started temporarily
- the assembled deck is served at `/preview/`
- Playwright opens that preview URL
- slides are discovered and evaluated
- overflow, console errors, and canvas consistency are collected

Important consequence:
- finalize depends on the same policy and assembly path as preview
- if assembly or policy breaks, delivery breaks too

## 5. The canonical PDF is written to the project root

Still in `presentation-ops-service.mjs`:
- `exportDeckPdf(target, sourcePaths.rootPdfAbs, { recordArtifacts: false })`

Supporting file:
- `framework/runtime/pdf-export.js`

Result:
- the canonical delivered PDF is written to:
  - `<project-root>/<project-slug>.pdf`

This is the current product contract.

## 6. Runtime evidence is refreshed

Files involved:
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/services/presentation-ops-service.mjs`

### `render-state.json` records
- current source fingerprint
- render status (`pass` or `fail`)
- producer (`finalize`)
- slide ids
- console-error count
- overflow and failure summaries
- issues from the rendered run

### `artifacts.json` records
- `finalized.pdf` when canonical delivery is current and passing
- `latestExport.pdf` for the most recent PDF export result
- alias fields kept for compatibility readers

Important detail:
- on a passing canonical finalize, `finalized` and `latestExport` both point at the project-root PDF
- on a failing finalize, render-state still updates, and artifacts are updated conservatively to avoid pretending delivery succeeded

## 7. The CLI returns the finalize envelope

Back in `presentation-cli.mjs`, the response includes:

- `status`
- `summary`
- `outputs.artifacts`
- `evidenceUpdated`
- `issues`

The command exits:
- `0` on pass
- `1` when finalize completes with issues/failures

## Trace B: canonical delivery through `presentation export pdf`

This path starts differently but converges on the same finalize service when the request is for the canonical full-deck PDF.

## 1. The CLI parses the export request

Primary file:
- `framework/runtime/presentation-cli.mjs`

Path:
- `runExportCommand(parsed, command, core)`

What it forwards:
- target format (`pdf` or `screenshots`)
- requested slide ids if any
- `--output-dir`
- `--output-file`

## 2. The runtime core normalizes the export request

Primary file:
- `framework/runtime/presentation-core.mjs`

Path:
- `core.exportPresentation(projectRoot, options)`

What it does:
- runs `inspectPackage` to get the current manifest
- validates slide selections against the manifest
- converts output paths to project-relative paths
- preserves the authored-content mutation boundary

## 3. Canonical `export pdf` requests are routed to finalize

Primary file:
- `framework/runtime/services/presentation-ops-service.mjs`

Function:
- `exportPresentation(targetInput, request = {}, options = {})`

Canonical cases:
- no `--output-dir` and no `--output-file`
- or an explicit output path that resolves to the project-root PDF

In those cases:
- filtered slide selection is rejected
- the service calls `finalizePresentation(...)`
- the returned result is wrapped as an export result

This is why full-deck `export pdf` and `finalize` share the same delivery semantics.

## Trace C: extra PDF export through `presentation export pdf --output-dir ...`

This is the manual artifact path, not canonical finalize.

## 1. The service chooses an explicit output path

`presentation-ops-service.mjs` resolves:
- the requested output directory inside the project
- the requested output file name, or the default suggested PDF name

## 2. It generates the PDF directly

Path:
- `exportDeckPdf(target, outputPath, { recordArtifacts: false, ... })`

Then it records artifacts with:
- `writePdfExportArtifacts(..., { markFinalized: false })`

## 3. Artifact-state behavior differs from finalize

For explicit extra exports:
- `latestExport` is updated to the manual PDF path
- `finalized` is preserved rather than replaced
- no new canonical delivery state is invented

That distinction is important.

The package must not treat an arbitrary manual export as proof that the canonical root PDF is current.

## Trace D: screenshot export through `presentation export screenshots`

For screenshot exports:
- the service requires `--output-dir`
- it runs `capturePresentation(...)`
- it writes slide PNGs to the requested directory
- it does **not** update finalized-PDF delivery state

## What can make canonical delivery fail

This flow can fail because of:
- authored source policy violations
- preview assembly failure
- browser console errors during capture
- overflow detection
- rendered canvas contract violations
- PDF generation failure

## What to change for common requests

### Change CLI wording, flags, or exit behavior
Edit:
- `framework/runtime/presentation-cli.mjs`
- maybe `framework/runtime/presentation-core.mjs`

### Change canonical-vs-manual export routing
Edit:
- `framework/runtime/presentation-core.mjs`
- `framework/runtime/services/presentation-ops-service.mjs`

### Change the generated PDF or capture behavior
Edit:
- `framework/runtime/pdf-export.js`
- `framework/runtime/services/presentation-ops-service.mjs`
- maybe `framework/runtime/runtime-app.js`
- maybe `framework/runtime/deck-assemble.js`

### Change runtime evidence contents
Edit:
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/services/presentation-ops-service.mjs`

## What not to do

- do not reintroduce a separate UI-only export path
- do not duplicate finalize logic in a second orchestration layer
- do not hand-edit `.presentation/runtime/*.json` to fake delivery state
- do not treat a manual PDF export as equivalent to a successful canonical finalize
- do not add back deleted checkpoint-file assumptions

## Minimal verification after changing this flow

### If you changed canonical delivery behavior
- `npm test`
- `node --test framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs`
- scaffold a project, fill a valid `brief.md`, then run:
  - `node .presentation/framework-cli.mjs export pdf --format json`
  - `node .presentation/framework-cli.mjs finalize --format json`
- inspect:
  - `<project-root>/<project-slug>.pdf`
  - `.presentation/runtime/render-state.json`
  - `.presentation/runtime/artifacts.json`

### If you changed only manual export behavior
- `npm test`
- run `node .presentation/framework-cli.mjs export pdf --output-dir outputs/manual-export --output-file deck.pdf`
- run `node .presentation/framework-cli.mjs export screenshots --output-dir outputs/manual-capture`
- confirm `artifacts.json` still distinguishes `latestExport` from `finalized`
