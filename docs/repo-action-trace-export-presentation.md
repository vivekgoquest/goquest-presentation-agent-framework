# Action Trace: Export Presentation

**Use this when:** you need to understand or change what happens when the user triggers **Export presentation**.

**Read this after:** `docs/repo-call-flows.md` and `docs/repo-architecture-overview.md`.

**Do not confuse with:**
- `export_presentation_artifacts` — direct PDF/PNG artifact export
- `validate_presentation` — validation-only workflow

**Key files:**
- `electron/renderer/app.js`
- `framework/application/action-service.mjs`
- `framework/application/presentation-action-adapter.mjs`
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/finalize-deck.mjs`

**Verification:**
- `npm test`
- `npm run finalize -- --project /abs/path`
- manual Electron export smoke if UI changed

---

## What this action means

The `export_presentation` action is the **canonical finalize pipeline**.

It is not the same as the direct artifact export dialog. It is the product action that:

- captures the deck
- exports the canonical PDF
- writes `outputs/report.json`
- writes `outputs/summary.md`
- updates runtime evidence in `.presentation/runtime/`
- returns pass/fail status for delivery readiness

## The full trace

## 1. The user clicks Export presentation in the Electron UI

Primary UI file:
- `electron/renderer/app.js`

What happens:
- the primary toolbar button is bound to an action id
- `runProductAction(actionId, button)` is called
- the action id for this path is `export_presentation`

Key renderer behavior:
- action status label is updated to running
- more-menu is closed
- button loading state is shown

## 2. The renderer invokes the action bridge

Still in `electron/renderer/app.js`:
- `invokeProductAction(actionId, args)`
- `window.electron.actions.invoke(actionId, args)`

This means the renderer does not call runtime code directly.

## 3. Electron main process forwards the request to the worker

File:
- `electron/main.mjs`

Path:
- IPC handler `presentation:invoke`
- `invokeWorker(request.channel, request.payload)`

The main process acts as the transport bridge only.

## 4. The worker host dispatches the request

File:
- `electron/worker/host.mjs`

The worker host receives the request and routes it through:
- `framework/application/electron-request-service.mjs`

The request channel for actions is:
- `action:invoke`

## 5. The Electron request service hands off to the application action service

File:
- `framework/application/electron-request-service.mjs`

For `ACTION_INVOKE`, it calls:
- `actionService.invokeAction(payload.actionId, payload.args || {})`

This is the moment the request becomes a named product workflow.

## 6. The action service validates availability and emits lifecycle events

File:
- `framework/application/action-service.mjs`

High-level steps:
1. find the action definition for `export_presentation`
2. list resolved actions and confirm the action is enabled
3. create a run id
4. build the action context
5. emit lifecycle events:
   - queued
   - running
6. invoke the workflow service

The action catalog marks this action as:
- id: `export_presentation`
- label: `Export presentation`
- surface: `primary`
- kind: `presentation`

## 7. The workflow service routes to the presentation workflow path

Still in `framework/application/action-service.mjs`:
- `createActionWorkflowService(...).invokeAction(...)`

For `export_presentation`, the workflow service chooses:
- `invokePresentationWorkflow(...)`

It does **not** go through the agent launcher.

## 8. The presentation action adapter maps the action to finalize

File:
- `framework/application/presentation-action-adapter.mjs`

For `export_presentation`, it calls:
- `finalizePresentation(target, args.options || {})`

This is the canonical runtime operation for this action.

## 9. The runtime finalize pipeline starts

File:
- `framework/runtime/services/presentation-ops-service.mjs`

Function:
- `finalizePresentation(targetInput, options = {})`

High-level steps inside finalize:
1. resolve project source and output paths
2. remove the existing `outputs/` directory contents
3. recreate output directories
4. capture the presentation into canonical output paths
5. export the PDF to `outputs/deck.pdf`
6. build issue summary
7. write `outputs/report.json`
8. write `outputs/summary.md`
9. write runtime evidence files
10. if pass, write `last-good.json`

## 10. Capture runs against the runtime preview

Still in `presentation-ops-service.mjs`:
- `capturePresentation(...)`
- via `withRuntimeServer(...)`

Supporting file:
- `framework/runtime/runtime-app.js`

What happens:
- an Express runtime server is started temporarily
- the assembled deck is served at `/preview/`
- Playwright opens that preview URL
- slides are discovered and evaluated
- full-page PNG and per-slide PNGs are captured
- report data is collected

## 11. Capture depends on deterministic deck assembly

Capture and finalize both depend on:
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-policy.js`
- `framework/runtime/presentation-package.js`

That means Export presentation inherits all of the following:
- package regeneration
- authored source validation
- strict policy enforcement
- runtime preview assembly

If assembly or policy breaks, export breaks.

## 12. The PDF is generated

Still in `presentation-ops-service.mjs`:
- `exportDeckPdf(...)`

Supporting file:
- `framework/runtime/pdf-export.js`

The generated PDF is written to:
- `outputs/deck.pdf`

## 13. Finalize writes canonical artifacts and runtime evidence

Files involved:
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/presentation-runtime-state.js`

Outputs written:
- `outputs/deck.pdf`
- `outputs/report.json`
- `outputs/summary.md`
- `outputs/full-page.png`
- `outputs/slides/*.png`

Runtime evidence written:
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/last-good.json` when status is pass

## 14. Control returns through the stack

The runtime returns a structured result to:
- `presentation-action-adapter`
- `action-service`
- worker response
- Electron main process
- renderer

The action service emits the final lifecycle event:
- succeeded or failed

The renderer then:
- updates action status text
- shows a toast
- refreshes project panels

## What can make Export presentation fail

This action can fail because of:
- authored source policy violations
- preview assembly failure
- browser console errors during capture
- overflow detection
- rendered canvas contract violations
- PDF export failure

In CLI form, `npm run finalize` exits non-zero on failure.

## What to change for common export-related requests

### Change button text, loading states, or toasts
Edit:
- `electron/renderer/app.js`
- maybe `electron/renderer/ui-model.js`

### Change action availability
Edit:
- `framework/application/action-service.mjs`
- maybe `framework/runtime/project-state.js`

### Change what Export presentation actually does
Edit:
- `framework/application/presentation-action-adapter.mjs`
- `framework/runtime/services/presentation-ops-service.mjs`

### Change report or runtime evidence contents
Edit:
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/presentation-runtime-state.js`

### Change preview or capture assumptions
Edit:
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-policy.js`
- possibly `framework/runtime/runtime-app.js`

## What not to do

- do not make the renderer call finalize logic directly
- do not duplicate finalize behavior in Electron-specific code
- do not confuse `export_presentation` with `export_presentation_artifacts`
- do not hand-edit runtime evidence files to fake export state

## Minimal verification after changing this flow

### If UI-only change
- `npm test`
- manual export click in Electron

### If action/application change
- `npm test`
- manual export click in Electron
- confirm lifecycle events still update UI

### If runtime/finalize change
- `npm test`
- `npm run finalize -- --project /abs/path`
- inspect `outputs/` and `.presentation/runtime/*.json`
