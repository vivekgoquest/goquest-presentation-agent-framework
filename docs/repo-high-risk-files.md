# High-Risk Files and Edit Lanes

**Use this when:** you need to know which files are most sensitive before making a change.

**Read this after:** `AGENTS.md` and `docs/repo-change-impact-matrix.md`.

**Do not confuse with:** `docs/repo-change-impact-matrix.md`, which is task-routing guidance. This document is about sensitivity and blast radius.

**Key files:** listed below by risk category.

**Verification:** always run at least `npm test`, plus the lane-specific checks listed under each category.

---

## How to interpret risk in this repository

A file is high risk if one or more of these are true:

- it affects every deck rather than one project
- it defines a contract that other layers assume is stable
- it is enforced by tests or policy
- it influences multiple workflows at once
- it can silently desynchronize package truth, runtime evidence, and outputs

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
- rendered canvas contract validation
- theme/content ownership boundaries

### Typical failure modes
- changing slide ratio or width assumptions
- breaking grid semantics
- making theme overrides unexpectedly pass or fail
- introducing layout changes that overflow existing decks

### Required caution
Only change these files with explicit framework-level intent.

### Minimum verification
- `npm test`
- `npm run check -- --project /abs/path`
- `npm run finalize -- --project /abs/path`
- inspect resulting screenshots and PDF

## Highest-risk category 2: deck policy semantics

### Files
- `framework/runtime/deck-policy.js`
- `framework/runtime/project-state.js`
- `project-agent/project-dot-claude/rules/*.md`
- `docs/base-canvas-contract.md`
- `docs/presentation-package-spec.md`

### Why they are risky
`deck-policy.js` is the enforcement layer for authoring rules. It controls which source patterns are legal and which states block preview, check, export, or finalize.

Changing policy affects:
- every project
- stop-hook behavior
- user-visible validation failures
- action availability via project state

### Typical failure modes
- old valid decks suddenly fail
- dangerous patterns accidentally become allowed
- docs drift away from runtime enforcement
- readiness state misclassifies project status

### Minimum verification
- `npm test`
- scaffold a fresh project and run `check`
- run `finalize` on a valid project
- inspect failure messages for clarity

## Highest-risk category 3: terminal lifecycle

### Files
- `framework/runtime/terminal-core.mjs`
- `electron/worker/terminal-service.mjs`

### Why they are risky
These files own terminal lifecycle guarantees, shell startup, resize behavior, and project-root session behavior.

Changes can break:
- terminal startup
- terminal shutdown
- project switching
- output streaming
- renderer expectations

### Typical failure modes
- dead terminal sessions
- bad cwd after project switch
- resize glitches
- vendor-specific logic leaking into terminal core

### Minimum verification
- `npm test`
- manual terminal start
- manual stop and restart
- manual project switch in Electron

## Highest-risk category 4: action workflow orchestration

### Files
- `framework/application/action-service.mjs`
- `framework/application/presentation-action-adapter.mjs`
- `framework/application/project-hook-service.mjs`

### Why they are risky
These files define named product actions, availability rules, workflow metadata, lifecycle events, and hook behavior.

Changes can affect:
- button availability
- UI action semantics
- agent-launch semantics
- stop-hook validation and checkpointing

### Typical failure modes
- actions enabled in the wrong state
- export/validate/review actions routed incorrectly
- lifecycle events no longer match renderer expectations
- hook behavior drifts from intended application-owned workflow model

### Minimum verification
- `npm test`
- manual invocation of changed actions
- hook smoke on a scaffolded project if hook logic changed

## Highest-risk category 5: deterministic runtime operations

### Files
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/pdf-export.js`
- `framework/runtime/runtime-app.js`
- `framework/runtime/deck-assemble.js`

### Why they are risky
These files sit in the shared path used by preview, check, capture, export, and finalize.

Changes can affect:
- runtime preview correctness
- Playwright capture correctness
- output artifacts
- runtime evidence writes
- finalize pass/fail behavior

### Typical failure modes
- preview works but finalize fails
- capture report drifts from actual rendered output
- outputs are missing or written to wrong paths
- last-good state becomes stale or incorrect

### Minimum verification
- `npm test`
- `npm run check -- --project /abs/path`
- `npm run finalize -- --project /abs/path`
- inspect `outputs/` and `.presentation/runtime/*.json`

## Highest-risk category 6: package and runtime state contracts

### Files
- `framework/runtime/presentation-package.js`
- `framework/runtime/presentation-intent.js`
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/deck-paths.js`
- `docs/presentation-package-spec.md`

### Why they are risky
These files define how project truth is shaped and persisted.

Changes can affect:
- newly scaffolded projects
- existing project compatibility
- package regeneration behavior
- runtime evidence readers and writers
- agent assumptions about editable vs read-only files

### Typical failure modes
- package files missing required fields
- runtime evidence schema drift
- existing projects no longer open cleanly
- intent validation incorrectly blocks work

### Minimum verification
- `npm test`
- scaffold a new project
- open an existing project
- run `check` and `finalize`
- inspect `.presentation/*.json`

## Highest-risk category 7: project scaffolding

### Files
- `framework/runtime/services/scaffold-service.mjs`
- `framework/application/project-scaffold-service.mjs`
- `project-agent/scaffold-package.mjs`
- `framework/templates/*`
- `project-agent/project-dot-claude/*`

### Why they are risky
Scaffolding defines the initial shape of every new project.

Changes can affect:
- source file presence and defaults
- package file initialization
- copied vs linked framework behavior
- project-local Claude rules and skills
- initial git history

### Typical failure modes
- invalid scaffolded projects
- missing `.presentation` files
- project-local agent package out of sync with framework assumptions
- copied framework paths resolving incorrectly

### Minimum verification
- `npm run new -- --project /abs/path`
- inspect scaffold contents
- `npm run check -- --project /abs/path`
- `npm run finalize -- --project /abs/path`

## Highest-risk category 8: architectural boundaries

### Files
- `framework/application/__tests__/boundary-contract.test.mjs`
- any implementation file involved in dependency-direction changes

### Why they are risky
These tests protect the repository’s main separation-of-concerns guarantees.

Changes here are risky because they can turn one accidental shortcut into a long-term architecture leak.

### Typical failure modes
- Electron importing runtime services directly
- runtime depending on application or project-agent modules
- terminal core becoming vendor-aware
- hook wrappers taking ownership they should not have

### Minimum verification
- `npm test`
- read the affected sections of `AGENTS.md`
- confirm the new dependency direction is explicitly intended

## Medium-high risk but usually localizable

### `electron/main.mjs`
Risk reason:
- protocol routing, worker lifecycle, IPC bridge

### `electron/worker/host.mjs`
Risk reason:
- service composition root for the worker process

### `framework/application/project-query-service.mjs`
Risk reason:
- project activation, preview document generation, project state surface

### `project-agent/agent-launcher.mjs`
Risk reason:
- launcher prompt composition and capability execution; should not hardcode product semantics incorrectly

## Lower-risk lanes if you stay within them

These are usually safer when changes are tightly scoped:

- `electron/renderer/app.css`
- `framework/templates/*` content-only improvements
- project-agent skill prose updates that do not alter core product contracts
- `framework/client/*` when behavior changes are small and verified carefully

Lower risk does not mean no risk. It means smaller blast radius if boundaries are respected.

## Agent operating rules for risky edits

Before editing a high-risk file, do all of the following:

1. read the corresponding contract doc first
2. identify the exact workflows affected
3. verify whether the file is named as protected in `AGENTS.md`
4. avoid opportunistic refactors in the same change
5. run the lane-specific verification before claiming success

## Default safe escalation rule

If a requested change seems to require edits in any of these areas:
- `framework/canvas/`
- `framework/runtime/deck-policy.js`
- `framework/runtime/terminal-core.mjs`
- `electron/worker/terminal-service.mjs`

Treat it as explicit framework maintenance work, not a casual implementation detail.
