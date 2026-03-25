# Action Surface Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove orphaned and duplicate action paths so the product has exactly one trigger path per outcome and one implementation path per outcome, with no backward compatibility shims.

**Architecture:** The canonical surface is `framework/application/action-catalog.mjs` plus `createActionWorkflowService()`. Electron should trigger only named product actions through `window.electron.actions.invoke(...)`, hooks should trigger only application workflows, and runtime CLIs should call a single canonical leaf per deterministic outcome. Legacy preload operation channels, legacy review/build naming, and unused quality-hook paths should be deleted rather than preserved.

**Tech Stack:** Electron, Node ESM, Playwright-based runtime capture/export services, application action workflow layer, Claude project-agent launcher.

---

## Current State Summary

### Canonical product actions
- `export_presentation`
- `validate_presentation`
- `capture_screenshots`
- `fix_validation_issues`
- `review_narrative_presentation`
- `apply_narrative_review_changes`
- `review_visual_presentation`
- `apply_visual_review_changes`

### Current cleanup targets

#### Confirmed orphaned or legacy-only code
- `project-agent/project-dot-claude/hooks/check-slide-quality.mjs`
- `framework/application/project-hook-service.mjs:runProjectQualityHookWorkflow`
- `framework/runtime/project-quality-check.mjs:runProjectQualityCheck`
- `project-agent/agent-capabilities.mjs` legacy capabilities:
  - `review_presentation`
  - `revise_presentation`
- `project-agent/project-dot-claude/skills/review-deck/`
- `project-agent/project-dot-claude/skills/revise-deck/`
- `framework/runtime/services/capture-service.mjs:captureDeck`
- `framework/runtime/deck-capture.mjs:captureDeck`

#### Confirmed duplicate or parallel trigger surfaces
- Preload/worker legacy channels:
  - `build:check`
  - `build:finalize`
  - `build:captureScreenshots`
  - `export:start`
  - `review:run`
  - `review:revise`
  - `review:fixWarnings`
  - `review:getAvailability`
- Preload namespaced APIs:
  - `window.electron.build.*`
  - `window.electron.export.*`
  - `window.electron.review.*`
- Renderer/export modal mismatch:
  - `electron/renderer/app.js` currently calls `runProductAction('export.start', ...)`, but `export.start` is not an action id

#### Confirmed semantic duplicates
- `export_presentation` has two internal branches:
  - finalize-style export via `finalizePresentation()`
  - direct artifact export via `exportPresentation()`
- Runtime CLIs expose overlapping concepts:
  - `npm run finalize`
  - `npm run export`
  - `npm run check`
  - `npm run capture`

## Cleanup Rules

### Hard rules
- No backward compatibility shims.
- No duplicate trigger surfaces for the same product outcome.
- No duplicate implementation paths for the same product outcome.
- No legacy action naming once the new action surface exists.
- Boundary tests should fail if old paths return.

### Canonical direction after cleanup
- Electron renderer -> `window.electron.actions.invoke(actionId, args)`
- Preload -> generic `actions` surface only
- Worker -> `ACTION_INVOKE`, `ACTION_LIST`, terminal/project/preview channels only
- Application layer -> canonical action workflows only
- Hooks -> application workflows only
- Runtime deterministic leaves:
  - `validatePresentation()`
  - `capturePresentation()`
  - `finalizePresentation()`
  - `exportDeckPdf()` only if we still need a narrow PDF leaf

## Chunk 1: Remove True Orphans First

### Task 1: Delete quality-hook orphan lane

**Files:**
- Delete: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/project-agent/project-dot-claude/hooks/check-slide-quality.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/project-hook-service.mjs`
- Delete: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/project-quality-check.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/__tests__/project-hook-service.test.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/__tests__/boundary-contract.test.mjs`

- [ ] **Step 1: Remove the unused quality-hook workflow from application code**
- [ ] **Step 2: Delete the unused project-local quality hook wrapper**
- [ ] **Step 3: Delete the runtime project-quality-check helper**
- [ ] **Step 4: Remove tests that explicitly preserve quality-hook behavior**
- [ ] **Step 5: Strengthen boundary tests to assert the deleted quality-hook path stays gone**

**Acceptance Criteria:**
- No shipped hook references `check-slide-quality.mjs`
- `runProjectQualityHookWorkflow` no longer exists
- `runProjectQualityCheck` no longer exists

**Validation:**
- Run: `rg -n "check-slide-quality|runProjectQualityHookWorkflow|runProjectQualityCheck" framework project-agent`
- Expected: no hits outside intentional changelog/plan files

### Task 2: Delete legacy broad review capability lane

**Files:**
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/project-agent/agent-capabilities.mjs`
- Delete: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/project-agent/project-dot-claude/skills/review-deck/SKILL.md`
- Delete: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/project-agent/project-dot-claude/skills/revise-deck/SKILL.md`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/project-agent/__tests__/agent-launcher.test.mjs`

- [ ] **Step 1: Remove `review_presentation` and `revise_presentation` capability definitions**
- [ ] **Step 2: Delete their legacy skill directories**
- [ ] **Step 3: Remove or rewrite tests that still call the deleted capabilities**

**Acceptance Criteria:**
- No agent capability remains for the old broad review/revise pair
- Narrative and visual review lanes are the only review capabilities

**Validation:**
- Run: `rg -n "review_presentation|revise_presentation|review-deck|revise-deck" project-agent framework electron`
- Expected: no product-code hits

### Task 3: Remove unused capture aliases

**Files:**
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/services/capture-service.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/deck-capture.mjs`

- [ ] **Step 1: Delete `captureDeck` alias exports**
- [ ] **Step 2: Keep only `capturePresentation()` and `getDefaultCaptureOutputDir()` if still needed**

**Acceptance Criteria:**
- There is one canonical capture leaf name

**Validation:**
- Run: `rg -n "\\bcaptureDeck\\b" framework project-agent electron`
- Expected: no hits

## Chunk 2: Collapse Duplicate Trigger Surfaces

### Task 4: Remove preload legacy build/export/review APIs

**Files:**
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/preload.cjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/worker/ipc-contract.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/electron-request-service.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/__tests__/app-smoke.test.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/worker/__tests__/host.test.mjs`

- [ ] **Step 1: Remove legacy worker request channels**
  - `build:check`
  - `build:finalize`
  - `build:captureScreenshots`
  - `export:start`
  - `review:run`
  - `review:revise`
  - `review:fixWarnings`
  - `review:getAvailability`
- [ ] **Step 2: Remove preload namespaces**
  - `window.electron.build`
  - `window.electron.export`
  - `window.electron.review`
- [ ] **Step 3: Route all action invocation through `window.electron.actions.invoke(...)`**
- [ ] **Step 4: If availability is still needed, move it under `window.electron.actions` rather than keeping a separate review namespace**

**Acceptance Criteria:**
- Preload exports only:
  - `project`
  - `preview`
  - `actions`
  - `system`
  - `terminal`
- Worker request contract has no build/review/export legacy action channels

**Validation:**
- Run: `rg -n "build:check|build:finalize|build:captureScreenshots|export:start|review:run|review:revise|review:fixWarnings|review:getAvailability" electron framework`
- Expected: no hits outside historical notes/tests intentionally rewritten

### Task 5: Fix renderer to use action ids only

**Files:**
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/renderer/app.js`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/renderer/ui-model.js`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/renderer/__tests__/ui-model.test.mjs`

- [ ] **Step 1: Remove reliance on `window.electron.review.getAvailability()`**
- [ ] **Step 2: Source action availability from `window.electron.actions.list()` or a new canonical actions query only**
- [ ] **Step 3: Replace the broken `runProductAction('export.start', ...)` call with the real action id path**
- [ ] **Step 4: Remove any renderer assumptions about build/review/export legacy namespaces**

**Acceptance Criteria:**
- Every renderer-triggered outcome uses a real action id from `action-catalog.mjs`
- No renderer code references `window.electron.build`, `window.electron.export`, or `window.electron.review`

**Validation:**
- Run: `rg -n "window\\.electron\\.(build|export|review)" electron/renderer`
- Expected: no hits

## Chunk 3: Collapse Duplicate Implementations Per Outcome

### Task 6: Make export semantics singular

**Files:**
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/presentation-action-adapter.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/services/export-service.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/services/finalize-service.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/__tests__/action-service.test.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/services/__tests__/runtime-services.test.mjs`

- [ ] **Step 1: Decide canonical semantics**
  - `export_presentation` = finalized/exported deck outputs
  - `capture_screenshots` = separate explicit artifact action
- [ ] **Step 2: Remove alternate internal export branches that represent the same outcome through different service paths**
- [ ] **Step 3: Keep narrow direct artifact exports only if they are explicitly separate product outcomes**

**Acceptance Criteria:**
- There is one implementation path for the main product export outcome
- Direct PDF-only export is either:
  - intentionally retained as CLI-only utility, or
  - folded into the singular export path

**Validation:**
- Review adapter switch and ensure one runtime leaf per product action outcome

### Task 7: Reconcile runtime CLI duplication

**Files:**
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/package.json`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/check-deck.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/finalize-deck.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/export-pdf.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/deck-capture.mjs`

- [ ] **Step 1: Decide which runtime scripts remain first-class**
  - likely `check`, `finalize`, `capture`
  - possibly remove or rename `export` if it duplicates finalized export semantics
- [ ] **Step 2: Remove script names that imply duplicate product paths**
- [ ] **Step 3: Update CLI usage strings to match the new singular terminology**

**Acceptance Criteria:**
- Runtime scripts no longer represent overlapping user concepts

## Chunk 4: Remove Latent Semantic Slop

### Task 8: Remove deterministic state fields that still depend on old quality heuristics

**Files:**
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/runtime/project-state.js`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/project-query-service.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/__tests__/project-query-service.test.mjs`

- [ ] **Step 1: Remove `qualityWarningCount` from project state if it no longer drives any product flow**
- [ ] **Step 2: Remove the `checkDeckQuality()` dependency from project-state calculation**
- [ ] **Step 3: Keep project state focused on deterministic readiness and policy only**

**Acceptance Criteria:**
- `getProjectState()` does not compute unused heuristic quality values

**Validation:**
- Run: `rg -n "qualityWarningCount|checkDeckQuality" framework electron`
- Expected: only intentionally retained narrative/visual review helpers, not project-state readiness

### Task 9: Remove stale lifecycle status semantics

**Files:**
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/action-events.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/renderer/ui-model.js`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/renderer/__tests__/ui-model.test.mjs`

- [ ] **Step 1: Remove `needs-review` handling from action lifecycle mapping if no canonical action returns it anymore**
- [ ] **Step 2: Remove renderer warning semantics that only exist for dead legacy statuses**

**Acceptance Criteria:**
- Lifecycle/status vocabulary matches actual action results only

## Chunk 5: Guardrails To Prevent Reintroduction

### Task 10: Expand boundary-contract coverage to enforce the hard switch

**Files:**
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/framework/application/__tests__/boundary-contract.test.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/__tests__/app-smoke.test.mjs`
- Modify: `/Users/vivek/Goquest Media Dropbox/Vivek Lath/Tech and Code/presentation-framework/electron/worker/__tests__/host.test.mjs`

- [ ] **Step 1: Add explicit assertions that preload exposes no legacy build/review/export namespaces**
- [ ] **Step 2: Add explicit assertions that worker request channels contain no legacy action channels**
- [ ] **Step 3: Add assertions that renderer only triggers actions by canonical action id**
- [ ] **Step 4: Add assertions that removed legacy capabilities do not exist**

**Acceptance Criteria:**
- Reintroducing a legacy trigger surface breaks tests immediately

## Execution Order

1. Delete true orphans:
   - quality hook lane
   - legacy broad review capabilities
   - capture aliases
2. Remove duplicate trigger surfaces:
   - legacy preload/worker action channels
   - legacy renderer namespace usage
3. Collapse duplicate implementations:
   - export/finalize duplication
   - redundant CLI concepts
4. Remove latent semantic slop:
   - quality fields in project state
   - dead lifecycle statuses
5. Tighten guardrails and rerun the full suite

## Testing Strategy

- Fast grep gate after each chunk:
  - `rg` for deleted names/channels
- Focused test sweeps after each chunk:
  - `framework/application/__tests__/boundary-contract.test.mjs`
  - `framework/application/__tests__/action-service.test.mjs`
  - `framework/application/__tests__/action-workflow-service.test.mjs`
  - `electron/worker/__tests__/host.test.mjs`
  - `electron/renderer/__tests__/ui-model.test.mjs`
  - `electron/__tests__/app-smoke.test.mjs`
- Full suite at the end:
  - `npm test`

## Risks And Gotchas

- The renderer/export modal currently mixes canonical action ids with a legacy `export.start` path. Fix this early so later deletions do not strand export UX.
- `window.electron.review.getAvailability()` is still carrying action availability in a review-specific namespace. Removing it requires a canonical replacement before renderer cleanup lands.
- `export_presentation` currently means both “finalized export” and “direct selected artifact export.” That semantic split must be decided before deleting code, or we risk removing a still-needed user outcome.
- `project-state.js` still computes quality heuristics even though deterministic validation was cleaned up. If not removed, heuristic slop can leak back into readiness semantics later.

## Rollback Plan

- Each chunk should land as its own commit so any mistaken deletion can be reverted without restoring the whole legacy stack.
- If a chunk causes integration breakage, revert only that chunk’s commit and keep prior deletions intact.

## Recommended First Implementation Slice

Start with Chunk 1 Task 1 and Task 2 together:
- remove the quality-hook orphan lane
- remove the legacy broad review/revise capabilities

That gives the biggest surface cleanup with the lowest product-risk because neither path is part of the current intended user flow.
