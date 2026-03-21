# Codebase Cleanup Issue Ledger

Audit baseline for the current `presentation-framework` repo state.

This document is intentionally scoped as an issue ledger, not an implementation plan. It captures the cleanup backlog we identified during the codebase pass, grouped by subsystem, with Electron UI/UX called out as the first active workstream.

## Current System Model

The intended product model is simple:

- Electron is the only interactive UI.
- The integrated terminal is the agent surface.
- The project folder is the source of truth for the presentation.
- Preview, check, capture, export, and finalize should reflect the same presentation state.

Today, the code still contains several split paths and migration leftovers that make the effective behavior more complex than the intended model.

## Current Flow Summary

### Project lifecycle

- `npm run new -- --project /abs/path` scaffolds a project via `framework/runtime/new-deck.mjs` and `framework/runtime/services/scaffold-service.mjs`.
- Electron main starts the app, worker, and `presentation://` protocol via `electron/main.mjs`.
- The Electron worker owns project state, terminal state, and file watching via `electron/worker/host.mjs`.
- The renderer drives the UI through the preload bridge in `electron/preload.cjs` and `electron/renderer/app.js`.

### Presentation lifecycle

- Electron preview uses `presentation://preview/current` and `electron/worker/project-service.mjs`.
- CLI/runtime preview for capture/export/finalize uses `framework/runtime/runtime-app.js`.
- `check` uses `framework/runtime/services/check-service.mjs`.
- `capture` uses `framework/runtime/services/capture-service.mjs`.
- `export` uses `framework/runtime/services/export-service.mjs` plus `framework/runtime/pdf-export.js`.
- `finalize` chains capture and export in `framework/runtime/services/finalize-service.mjs`.

## Severity Scale

- `Critical`: actively misleading or dangerous behavior; should be fixed before broader cleanup.
- `High`: major contract split or user-facing reliability problem.
- `Medium`: meaningful inconsistency, stale surface, or missing behavior.
- `Low`: residue, dead paths, naming drift, or cleanup debt with lower immediate risk.

## Active Workstream

We will fix Electron UI/UX first.

That means the first pass should stay focused on:

- preview correctness and authority
- renderer/worker IPC correctness
- terminal startup and visible failure handling
- watch/refresh behavior
- visible project status and controls
- protocol and asset-path correctness
- dead or misleading Electron-facing UI surfaces

The runtime/scaffolding/docs issues below remain in scope for the overall cleanup, but they are not the first execution lane unless they block an Electron fix.

## Electron UI/UX Issues

### E-01 Preview authority split

- Severity: `High`
- Summary: Electron preview is not authoritative. If `renderPresentationHtml()` fails, the worker falls back to stitching raw slide fragments into a preview instead of showing the same onboarding or policy-error state used by the runtime preview.
- Impact: the user can see a preview that looks usable while `check`, `export`, or `finalize` reject the project.
- Evidence:
  - `electron/worker/project-service.mjs`
  - `electron/main.mjs`
  - `framework/runtime/runtime-app.js`

### E-02 Terminal startup failures are swallowed

- Severity: `High`
- Summary: after project open/create, the renderer auto-starts the shell and drops any startup error.
- Impact: the core UI + agent loop can silently fail, leaving the user with no usable terminal and no actionable error.
- Evidence:
  - `electron/renderer/app.js`

### E-03 Watch-driven preview refresh is racey

- Severity: `Medium`
- Summary: `watch/change` triggers fire-and-forget preview reloads with no sequencing or cancellation.
- Impact: rapid file writes or user navigation can reselect stale slides or interleave old/new refresh state.
- Evidence:
  - `electron/renderer/app.js`
  - `electron/worker/watch-service.mjs`

### E-04 Project state exists but is hidden from the real UI

- Severity: `High`
- Summary: project onboarding/in-progress/policy/finalized state is computed centrally, but the visible UI mostly hides it and only exposes it in diagnostics JSON.
- Impact: the user has weak feedback about whether the project is blocked, incomplete, or ready.
- Evidence:
  - `framework/runtime/project-state.js`
  - `electron/renderer/app.js`
  - `electron/renderer/index.html`

### E-05 `presentation://project-files` path handling is weaker than framework asset resolution

- Severity: `Medium`
- Summary: project file resolution in Electron uses a simpler `resolve(...).startsWith(...)` guard and does not decode the URL path like the framework asset resolver path does.
- Impact: encoded asset names can misresolve and path-prefix checks are weaker than the framework asset path.
- Evidence:
  - `electron/main.mjs`
  - `electron/project-framework-resolver.mjs`

### E-06 Filmstrip rebuild logic keys off `slideId` only

- Severity: `Medium`
- Summary: the renderer skips rebuilding the filmstrip if the comma-joined `slideId` list is unchanged.
- Impact: pure renumber/reorder changes can be missed because folder order comes from the numeric prefix while `slideId` comes from the suffix.
- Evidence:
  - `electron/renderer/app.js`
  - `framework/runtime/deck-source.js`

### E-07 Renderer-to-worker `check` payload is broken

- Severity: `Medium`
- Summary: the renderer passes `outputDir` to `runtime.check()`, but the worker ignores it and only forwards `payload.options`.
- Impact: the UI implies project-local check artifacts, but the actual check output still lands in default temp locations.
- Evidence:
  - `electron/renderer/app.js`
  - `electron/worker/host.mjs`
  - `framework/runtime/services/check-service.mjs`

### E-08 Split handle exists but does not resize anything

- Severity: `Medium`
- Summary: the split handle is present in DOM and CSS, but there are no drag handlers in the renderer.
- Impact: the UI advertises a resize affordance that does not work.
- Evidence:
  - `electron/renderer/index.html`
  - `electron/renderer/app.css`
  - `electron/renderer/app.js`

### E-09 Copy-framework choice exists in worker/runtime, not in UI

- Severity: `Medium`
- Summary: the project create path supports `copyFramework`, but the Electron New flow has no control for it.
- Impact: the documented product contract and the visible UI do not match.
- Evidence:
  - `docs/prd-human-agent.md`
  - `electron/worker/project-service.mjs`
  - `electron/renderer/index.html`
  - `electron/renderer/app.js`

### E-10 Welcome copy is stale

- Severity: `Low`
- Summary: the welcome panel still says “Create beautiful slide decks from your browser.”
- Impact: confusing product messaging for an Electron-only app.
- Evidence:
  - `electron/renderer/index.html`

### E-11 Preview is not visually dominant

- Severity: `High`
- Summary: the main working layout spends substantial width on a fixed filmstrip and nearly equal-width terminal pane, so the actual slide canvas is smaller than it should be.
- Impact: the user’s primary authoring surface feels cramped while lower-value chrome remains resident.
- Evidence:
  - `electron/renderer/app.css`
  - `electron/renderer/app.js`
  - `framework/canvas/canvas.css`
  - `electron/worker/project-service.mjs`

### E-12 Filmstrip is low-information navigation

- Severity: `High`
- Summary: the filmstrip shows numbered placeholder cards instead of meaningful thumbnails, uses weak labels, and is built from clickable `div`s rather than stronger focusable controls.
- Impact: the UI pays a large width cost for navigation that is hard to scan, weakly accessible, and poor at conveying slide identity.
- Evidence:
  - `electron/renderer/app.js`
  - `electron/renderer/app.css`
  - `electron/renderer/index.html`

### E-13 Terminal pane has no real empty or failure state

- Severity: `High`
- Summary: when the shell is stopped or startup fails, the terminal area degrades into a blank dark pane with little or no visible explanation.
- Impact: the core user-plus-agent loop can look dead without telling the user whether the terminal is loading, stopped, or broken.
- Evidence:
  - `electron/renderer/app.js`
  - `electron/renderer/index.html`
  - `electron/renderer/app.css`

### E-14 Action hierarchy is backwards during onboarding

- Severity: `High`
- Summary: the first prominent action after project creation is `Build`, while the actual next step is usually to complete `brief.md` and finish slide sources; `Check deck policy` is hidden under the overflow menu.
- Impact: the UI encourages the wrong action first and makes the product feel blocked instead of guided.
- Evidence:
  - `electron/renderer/index.html`
  - `electron/renderer/app.js`
  - `framework/runtime/project-state.js`
  - `framework/runtime/services/scaffold-service.mjs`

### E-15 Secondary text and disabled states are too faint

- Severity: `Medium`
- Summary: low-contrast secondary text, watch/status cues, filmstrip labels, and disabled toolbar controls often drop below comfortable readability.
- Impact: important status cues look like dead chrome, and the interface feels quieter than it should at exactly the moments where the user needs orientation.
- Evidence:
  - `electron/renderer/app.css`
  - `electron/renderer/index.html`

### E-16 Welcome and create flow under-explain the project model

- Severity: `Medium`
- Summary: the first-run copy is thin, “open existing project” does not explain that it expects an initialized presentation folder, and the new-project flow hides capabilities like slide count selection behind a hidden input.
- Impact: onboarding assumes repo-specific knowledge instead of teaching the product model in the UI.
- Evidence:
  - `electron/renderer/index.html`
  - `electron/renderer/app.js`
  - `electron/worker/project-service.mjs`

## Electron UX/UI Deep-Pass Notes

Second-pass Electron review using multiple internal sub-agents, live screenshots, and two read-only headless Claude audits converged on the same root pattern:

- The backend already computes strong lifecycle state, but the renderer treats that state as diagnostics instead of product UI.
- The working shell is optimized for “keep all panes visible” instead of “make the presentation preview dominant and the next step obvious.”
- The current interface uses too much weak chrome: placeholder filmstrip tiles, a dead split affordance, a blank terminal empty state, and faint status text.

That means the Electron-first cleanup order should tighten to:

1. Surface `projectState.status`, `nextStep`, and completion counts in the visible UI.
2. Stop preview from looking healthier than the actual build/check/finalize pipeline.
3. Rebalance layout so preview is dominant, navigation is more informative, and terminal failures are visible.
4. Fix onboarding/action hierarchy before polishing lower-level visual details.

## Runtime / Orchestration Issues

### R-01 `finalize` wipes `outputs/` before it knows the run will succeed

- Severity: `High`
- Summary: `finalizePresentation()` deletes the output directory up front, then runs capture/export.
- Impact: a failed finalize destroys the last known-good artifacts.
- Evidence:
  - `framework/runtime/services/finalize-service.mjs`

### R-02 Stop hook is weaker than the claimed quality gate

- Severity: `High`
- Summary: the stop hook only runs `checkDeckQuality()` and does not execute full deck-policy/render validation.
- Impact: policy-invalid work can still be auto-committed as long as the lighter warning pass is clean.
- Evidence:
  - `project-agent/project-dot-claude/hooks/check-slide-quality.mjs`
  - `framework/runtime/deck-quality.js`
  - `framework/runtime/deck-policy.js`

### R-03 Default 3-slide scaffold is intentionally incomplete, but the maintainer baseline is easy to misread

- Severity: `Medium`
- Summary: a default 3-slide scaffold contains generic slide TODOs, so `check` and `finalize` fail until content is authored.
- Impact: maintainers can mistake expected policy failure for a broken lifecycle path if the baseline is interpreted as “fresh scaffold should already pass.”
- Evidence:
  - `framework/templates/slides/generic/slide.html`
  - `framework/runtime/services/scaffold-service.mjs`
  - `framework/runtime/check-deck.mjs`

### R-04 In-preview export surface appears half-retired

- Severity: `Medium`
- Summary: the assembler still injects export UI and client code, but the Electron preview hides the export bar and does not wire the old browser export route.
- Impact: dead behavior increases confusion and keeps legacy code alive.
- Evidence:
  - `framework/runtime/deck-assemble.js`
  - `framework/client/export.js`
  - `electron/worker/project-service.mjs`
  - `electron/main.mjs`

## Scaffolding / Project-Agent Contract Issues

### S-01 `revisions.md` contract drift

- Severity: `High`
- Summary: docs and project-agent guidance still treat `revisions.md` as part of the workflow, but scaffolding does not create it and tests explicitly expect it to be absent.
- Impact: authoring contract, scaffold, and skills disagree.
- Evidence:
  - `docs/prd-human-agent.md`
  - `docs/prd-ai-agent.md`
  - `project-agent/project-claude-md.md`
  - `framework/runtime/services/__tests__/runtime-services.test.mjs`

### S-02 Review/revise skills do not persist the documented `revisions.md` flow

- Severity: `Medium`
- Summary: the review/revise skills talk about revision work, but they do not consistently instruct the agent to write or maintain `revisions.md`.
- Impact: revision plans stay ephemeral in chat instead of project state.
- Evidence:
  - `project-agent/project-dot-claude/skills/revise-deck/SKILL.md`
  - `project-agent/project-dot-claude/skills/review-deck/SKILL.md`

### S-03 Scaffolded agent contract under-reports available workflows

- Severity: `Medium`
- Summary: the scaffold copies 9 skills, but the top-level project contract only lists a smaller subset.
- Impact: users and agents get an incomplete picture of available workflows.
- Evidence:
  - `project-agent/project-claude-md.md`
  - `framework/runtime/services/scaffold-service.mjs`
  - `framework/runtime/services/__tests__/runtime-services.test.mjs`

### S-04 Removed operator-console skills are still scaffolded into projects

- Severity: `Medium`
- Summary: old operator-console test/judge skills are still copied into every new project.
- Impact: new projects still distribute removed workflows.
- Evidence:
  - `framework/runtime/services/scaffold-service.mjs`
  - `project-agent/project-dot-claude/skills/operator-console-user-test/SKILL.md`
  - `project-agent/project-dot-claude/skills/operator-console-judge/SKILL.md`

### S-05 Copied project rule docs contain broken framework links

- Severity: `Medium`
- Summary: some scaffolded `.claude/rules` files link to repo-relative framework paths that do not exist from inside the generated project.
- Impact: copied projects ship invalid internal references.
- Evidence:
  - `project-agent/project-dot-claude/rules/file-boundaries.md`
  - `project-agent/project-dot-claude/rules/tokens.md`

### S-06 Preview-blocking messaging is inconsistent with real Electron behavior

- Severity: `Medium`
- Summary: scaffold next steps say preview/export/finalize stay blocked until TODOs are resolved, but Electron preview still renders incomplete projects through fallback preview logic.
- Impact: user-facing messaging and actual app behavior diverge.
- Evidence:
  - `framework/runtime/services/scaffold-service.mjs`
  - `electron/worker/project-service.mjs`

## Legacy / Dead-Path Cleanup Issues

### L-01 Historical docs still read like current architecture in places

- Severity: `Medium`
- Summary: the Electron packaging/native-host plan docs carry historical notes, but large sections still read as live instructions for `server.mjs`, browser mode, and HTTP/WS transport.
- Impact: future maintainers can follow removed paths.
- Evidence:
  - `docs/electron-native-host-plan.md`
  - `docs/electron-packaging-plan.md`

### L-02 Docs still refer to old bare `templates/` paths

- Severity: `Medium`
- Summary: PRD and audit docs still refer to `templates/` even though the real source-of-truth path is `framework/templates/`.
- Impact: agent and contributor guidance still points at a removed top-level concept.
- Evidence:
  - `docs/prd-ai-agent.md`
  - `docs/prd-implementation-audit.md`

### L-03 Preview export client appears dead after Electron cutover

- Severity: `Medium`
- Summary: export UI/client code remains in the assembled deck despite being hidden or unwired in actual Electron usage.
- Impact: misleading behavior and unnecessary code surface.
- Evidence:
  - `framework/runtime/deck-assemble.js`
  - `framework/client/export.js`
  - `electron/main.mjs`

### L-04 Physical leftovers remain in the tree

- Severity: `Low`
- Summary: there are still dead or near-dead remnants like `framework/console`, reduced `examples/` residue, and `.DS_Store` files.
- Impact: noise and migration residue.
- Evidence:
  - `framework/console/`
  - `examples/`
  - `.DS_Store` files under repo paths

### L-05 `ws` is likely dead

- Severity: `Low`
- Summary: `ws` remains in dependencies, but the current code path does not appear to use it.
- Impact: unnecessary dependency surface unless retained for a real upcoming use.
- Evidence:
  - `package.json`

## Verification Notes

The following checks were run during the audit:

- `npm test` -> passed (`10/10`)
- temp-project smoke:
  - default 3-slide scaffold confirmed expected policy failure until TODOs are filled
  - 2-slide scaffold with `brief.md` filled confirmed `new -> check -> finalize` pass path

## Suggested Electron-First Order

When we start implementation, the Electron-first sequence should be:

1. `E-01` Preview authority split
2. `E-07` Broken renderer-to-worker `check` payload
3. `E-02` Terminal startup failure handling
4. `E-04` Visible project status and next-step guidance
5. `E-03` Watch/refresh synchronization
6. `E-08` Split handle behavior
7. `E-05` Protocol path normalization and guard hardening
8. `E-06` Filmstrip reorder detection
9. `E-09` Copy-framework UI choice
10. `E-10` stale Electron copy

After that, we can move to runtime hardening and then scaffold/docs cleanup.
