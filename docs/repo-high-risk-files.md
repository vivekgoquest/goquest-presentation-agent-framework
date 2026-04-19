# High-Risk Files and Edit Lanes

**Use this when:** you need to know which files are most sensitive before making a change.

**Read this after:** `AGENTS.md` and `docs/repo-change-impact-matrix.md`.

**Do not confuse with:** `docs/repo-change-impact-matrix.md`, which is task-routing guidance. This document is about sensitivity and blast radius.

**Verification baseline:** always run at least `npm test`, plus the lane-specific checks listed below.

When a verification step uses `node .presentation/framework-cli.mjs ...`, assume either:
- the project can resolve the installed `pitch-framework` package, or
- you set up the AGENTS.md maintainer smoke so the local shim can resolve this repo checkout.

---

## How to interpret risk in this repository

A file is high risk if one or more of these are true:

- it affects every deck rather than one project
- it defines a contract other layers assume is stable
- it is named as protected in `AGENTS.md`
- it influences multiple command families at once
- it can silently desynchronize authored source, generated structure, runtime evidence, and delivery output

For any high-risk change, also keep the shell-less product contract in mind:

- public entrypoints are `presentation ...`, `node framework/runtime/presentation-cli.mjs ...`, and `node .presentation/framework-cli.mjs ...`
- deterministic project state lives under `.presentation/`
- scaffolded vendor guidance lives under `.claude/`
- canonical delivery is the project-root PDF plus runtime evidence in `.presentation/runtime/*.json`

## Highest-risk category 1: structural canvas contract

### Files
- `framework/canvas/canvas-contract.mjs`
- `framework/canvas/canvas.css`
- `docs/base-canvas-contract.md`

### Why they are risky
These files define the structural stage, protected selectors, and structural tokens that every deck depends on.

Changing them can affect:
- preview layout
- screenshot capture
- PDF export
- rendered canvas validation
- theme/content ownership boundaries

### Typical failure modes
- changing slide ratio or stage width assumptions
- breaking grid semantics
- making theme overrides unexpectedly pass or fail
- introducing layout changes that overflow existing decks

### Minimum verification
- `npm test`
- a shell-less project smoke with `init`, `audit all`, and `finalize`
- inspect the resulting preview/PDF behavior closely

## Highest-risk category 2: policy semantics and authored-boundary enforcement

### Files
- `framework/runtime/deck-policy.js`
- `framework/runtime/presentation-core.mjs`
- `framework/runtime/project-state.js`
- `project-agent/project-dot-claude/rules/*.md`
- `docs/base-canvas-contract.md`
- `docs/presentation-package-spec.md`

### Why they are risky
`deck-policy.js` is the enforcement layer for authoring rules, and `presentation-core.mjs` protects the mutation boundary between authored content and runtime-owned files.

Changing this lane affects:
- every project
- audit results
- preview/export/finalize eligibility
- user-visible failure messages
- scaffolded authoring guidance

### Typical failure modes
- old valid decks suddenly fail
- dangerous patterns accidentally become allowed
- runtime commands start mutating authored source
- docs drift away from runtime enforcement
- workflow state is misclassified

### Minimum verification
- `npm test`
- scaffold a fresh project
- run `node .presentation/framework-cli.mjs audit all --format json`
- run `node .presentation/framework-cli.mjs finalize --format json` on a valid project
- inspect failure messages for clarity if you touched diagnostics

## Highest-risk category 3: project/package state contracts

### Files
- `framework/runtime/deck-paths.js`
- `framework/runtime/presentation-package.js`
- `framework/runtime/presentation-intent.js`
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/project-state.js`
- `framework/runtime/status-service.js`
- `docs/presentation-package-spec.md`

### Why they are risky
These files define the project model the package creates and the state it persists.

Changing them can affect:
- newly scaffolded projects
- existing project compatibility
- the generated manifest shape
- `render-state.json` and `artifacts.json`
- status workflow classification
- agent assumptions about editable vs read-only files

### Typical failure modes
- missing required files under `.presentation/`
- bad path resolution for the project-local shim or root PDF
- runtime evidence schema drift
- stale or misleading status guidance
- compatibility regressions for copied-framework projects

### Minimum verification
- `npm test`
- scaffold a new project from the source entrypoint
- inspect `.presentation/project.json`, `intent.json`, `package.generated.json`, `runtime/render-state.json`, and `runtime/artifacts.json`
- run project-local `inspect package`, `status`, and `finalize`

## Highest-risk category 4: public CLI surface and project-local shim portability

### Files
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/presentation-core.mjs`
- `framework/runtime/project-cli-shim.mjs`
- `package.json`

### Why they are risky
These files define the actual shipped entrypoints and command semantics.

Changing them can affect:
- installed-package usage via `presentation ...`
- source-checkout usage via `node framework/runtime/presentation-cli.mjs ...`
- scaffolded project usage via `node .presentation/framework-cli.mjs ...`
- exit codes, JSON envelopes, and user-facing help text

### Typical failure modes
- command families parse incorrectly
- the shim hard-codes framework source paths and stops being portable
- CLI help or error messages teach stale workflows
- source-entrypoint and project-local behavior drift apart

### Minimum verification
- `npm test`
- `node framework/runtime/presentation-cli.mjs init --project "$TMP_PROJECT" --slides 1 --format json`
- `node "$TMP_PROJECT/.presentation/framework-cli.mjs" inspect package --format json`
- `node "$TMP_PROJECT/.presentation/framework-cli.mjs" status --format json`

## Highest-risk category 5: preview, export, and finalize pipeline

### Files
- `framework/runtime/preview-server.mjs`
- `framework/runtime/runtime-app.js`
- `framework/runtime/deck-assemble.js`
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/pdf-export.js`
- `framework/runtime/presentation-runtime-state.js`

### Why they are risky
These files sit in the shared delivery path used by preview, audit-render checks, export, and finalize.

Changing them can affect:
- preview correctness
- screenshot capture correctness
- canonical root-PDF generation
- manual PDF/screenshot exports
- runtime evidence writes in `.presentation/runtime/*.json`

### Typical failure modes
- preview works but finalize fails
- export writes the wrong PDF path
- `artifacts.json` stops reflecting finalized vs latest-export state correctly
- render-state data no longer matches the actual capture result
- delivery breaks because policy/assembly assumptions changed underneath it

### Minimum verification
- `npm test`
- scaffold a project and fill a valid `brief.md`
- run `node .presentation/framework-cli.mjs preview serve` if preview behavior changed
- run `node .presentation/framework-cli.mjs export pdf --format json`
- run `node .presentation/framework-cli.mjs finalize --format json`
- inspect the project-root PDF plus `.presentation/runtime/render-state.json` and `.presentation/runtime/artifacts.json`

## Highest-risk category 6: project scaffolding and Claude packet generation

### Files
- `framework/runtime/services/scaffold-service.mjs`
- `framework/shared/project-claude-scaffold-package.mjs`
- `framework/templates/*`
- `project-agent/project-agents-md.md`
- `project-agent/project-claude-md.md`
- `project-agent/project-dot-claude/*`

### Why they are risky
Scaffolding defines the initial shape of every new project.

Changing it can affect:
- authored file presence and defaults
- `.presentation/` file initialization
- `.claude/` guidance and hooks
- project-local shim availability
- git initialization behavior
- copied-framework mode behavior

### Typical failure modes
- invalid scaffolded projects
- missing `.presentation` state files
- stale or contradictory scaffolded markdown
- `.claude/` rules drifting away from runtime behavior
- projects that cannot resolve or run their local shim

### Minimum verification
- `npm test`
- `node --test project-agent/__tests__/scaffold-package.test.mjs framework/runtime/services/__tests__/runtime-services.test.mjs`
- scaffold a fresh project and inspect `.claude/` plus `.presentation/`
- run project-local `audit all` and `status`

## Highest-risk category 7: shared scaffold source and maintainer docs

### Files
- `README.md`
- `START-HERE.md`
- `docs/repo-*.md`
- `docs/presentation-package-spec.md`
- `docs/prd-human-agent.md`

### Why they are risky
These files teach maintainers and operators how the current product works.

If they drift, the repository becomes harder to maintain even when the code is correct.

### Typical failure modes
- docs teach deleted command paths
- docs mention deleted layers or stale entrypoints
- docs describe runtime evidence that no longer exists
- verification commands no longer match the real product

### Minimum verification
- `npm test`
- `node --test framework/runtime/__tests__/shellless-public-surface.test.mjs`
- manually spot-check the commands and file paths you document

## Medium-high risk but usually localizable

### `framework/client/*`
Risk reason:
- browser-side preview/navigation behavior can change without changing the shell-less package shape, but the blast radius still reaches every deck.

### `framework/templates/*`
Risk reason:
- content-only scaffold improvements are often local, but they still affect every newly initialized project.

### `project-agent/project-dot-claude/skills/*`
Risk reason:
- skills are prose, but they can still teach stale workflows or violate the current package contract.

## Agent operating rules for risky edits

Before editing a high-risk file, do all of the following:

1. read the corresponding contract doc first
2. identify the exact command families and files affected
3. verify whether the file is named as protected in `AGENTS.md`
4. avoid opportunistic refactors in the same change
5. run the lane-specific verification before claiming success

## Default safe escalation rule

If a requested change seems to require edits in any of these areas:
- `framework/canvas/`
- `framework/runtime/deck-policy.js`
- `framework/runtime/presentation-package.js`
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/project-state.js`
- `framework/runtime/project-cli-shim.mjs`
- `framework/runtime/services/scaffold-service.mjs`
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/pdf-export.js`
- `framework/shared/project-claude-scaffold-package.mjs`

Treat it as explicit framework maintenance work, not a casual implementation detail.
