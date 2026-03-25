# Electron UI Rehaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Electron shell feel more like a terminal-first editor by reducing terminal transport overhead, improving renderer terminal behavior, adding pane resizing, and reducing unnecessary UI refresh work.

**Architecture:** Keep terminal control operations on request/response IPC, but move high-frequency terminal input onto dedicated fire-and-forget IPC. Improve renderer output handling with buffered writes, add explicit PTY/system output source metadata, and upgrade the Electron layout to a resizable terminal-first split while preserving current application and runtime boundaries.

**Tech Stack:** Electron, xterm.js, node-pty, Node test runner, Playwright Electron smoke tests, plain CSS

---

## Chunk 1: Terminal transport and event model

### Task 1: Add source-aware terminal output events

**Files:**
- Modify: `framework/runtime/terminal-events.mjs`
- Modify: `framework/runtime/__tests__/terminal-core.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test that asserts terminal output events can carry a `source` field and that system output is distinguishable from PTY output.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test framework/runtime/__tests__/terminal-core.test.mjs`
Expected: FAIL because output event/source semantics are not implemented yet.

- [ ] **Step 3: Write minimal implementation**

Update `createTerminalOutputEvent` and `toTerminalSocketMessage` to preserve `source`, defaulting PTY output to `pty` and framework/system-injected output to `system`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test framework/runtime/__tests__/terminal-core.test.mjs`
Expected: PASS.

### Task 2: Tighten terminal startup sequencing

**Files:**
- Modify: `framework/runtime/terminal-core.mjs`
- Test: `framework/runtime/__tests__/terminal-core.test.mjs`

- [ ] **Step 1: Write the failing test**

Add a test that sends input immediately after ready and expects the session to accept it reliably.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test framework/runtime/__tests__/terminal-core.test.mjs`
Expected: FAIL or expose the readiness race.

- [ ] **Step 3: Write minimal implementation**

Adjust startup sequencing so `ready` is emitted only after the backend is assigned and input is writable.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test framework/runtime/__tests__/terminal-core.test.mjs`
Expected: PASS.

### Task 3: Move terminal input off request/response invoke IPC

**Files:**
- Modify: `electron/preload.cjs`
- Modify: `electron/main.mjs`
- Modify: `electron/renderer/app.js`
- Modify: `electron/worker/host.mjs` only if transport support needs adjustment
- Test: `electron/__tests__/app-smoke.test.mjs`

- [ ] **Step 1: Write the failing test**

Add or extend an Electron smoke assertion that the terminal surface still supports shell interaction while the renderer no longer depends on request/response semantics for keystroke transport.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test electron/__tests__/app-smoke.test.mjs`
Expected: FAIL once the test asserts the new transport contract.

- [ ] **Step 3: Write minimal implementation**

Introduce a dedicated IPC channel for terminal input using fire-and-forget semantics from preload/main to worker. Keep existing request/response terminal control methods intact.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test electron/__tests__/app-smoke.test.mjs`
Expected: PASS.

## Chunk 2: Renderer terminal feel and shell framing

### Task 4: Buffer renderer terminal output flushes

**Files:**
- Modify: `electron/renderer/app.js`
- Test: extend `electron/__tests__/app-smoke.test.mjs` only if practical; otherwise rely on terminal-core and smoke verification

- [ ] **Step 1: Write the failing test**

Add the narrowest practical assertion for terminal responsiveness behavior or render-state expectation if testable; otherwise document the limitation and cover via targeted manual verification after preserving existing automated coverage.

- [ ] **Step 2: Run test to verify it fails**

Run the narrowest relevant test command.
Expected: FAIL if testable.

- [ ] **Step 3: Write minimal implementation**

Replace per-chunk write-and-scroll restoration with buffered flush behavior so multiple terminal output chunks are written together.

- [ ] **Step 4: Run test to verify it passes**

Run the same test command plus Electron smoke if needed.
Expected: PASS.

### Task 5: Reframe the pane as Terminal

**Files:**
- Modify: `electron/renderer/index.html`
- Modify: `electron/renderer/app.css`
- Modify: `electron/__tests__/app-smoke.test.mjs`

- [ ] **Step 1: Write the failing test**

Update the Electron app smoke test to expect `Terminal` instead of `Assistant`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test electron/__tests__/app-smoke.test.mjs`
Expected: FAIL because the UI still says Assistant.

- [ ] **Step 3: Write minimal implementation**

Rename the pane title and any shell copy that should reflect terminal-first framing.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test electron/__tests__/app-smoke.test.mjs`
Expected: PASS.

### Task 6: Add a draggable split handle and resizable panes

**Files:**
- Modify: `electron/renderer/index.html`
- Modify: `electron/renderer/app.js`
- Modify: `electron/renderer/app.css`
- Test: `electron/__tests__/app-smoke.test.mjs` if practical for presence assertions

- [ ] **Step 1: Write the failing test**

Add a smoke assertion that the split handle exists when a project is open.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test electron/__tests__/app-smoke.test.mjs`
Expected: FAIL because no split handle exists.

- [ ] **Step 3: Write minimal implementation**

Add a draggable split handle, maintain a ratio in renderer state, update pane flex-basis values during drag, and refit xterm during resize.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test electron/__tests__/app-smoke.test.mjs`
Expected: PASS.

## Chunk 3: Preview refresh and full verification

### Task 7: Reduce unnecessary panel refresh work on preview changes

**Files:**
- Modify: `electron/renderer/app.js`
- Review: `electron/worker/watch-service.mjs`
- Review: `framework/application/project-query-service.mjs`

- [ ] **Step 1: Write the failing test**

Add the narrowest practical assertion if a stable automation seam exists; otherwise preserve current tests and treat this as a behavior change verified with the project smoke baseline.

- [ ] **Step 2: Run test to verify it fails**

Run the relevant test command if a new automated assertion is added.

- [ ] **Step 3: Write minimal implementation**

Decouple preview iframe reloads from full `refreshProjectPanels()` work on every preview change. Keep project and action refreshes where correctness depends on them.

- [ ] **Step 4: Run test to verify it passes**

Run the relevant test command and Electron smoke.

### Task 8: Run full verification

**Files:**
- No production file changes

- [ ] **Step 1: Run targeted test suites**

Run:
```bash
node --test framework/runtime/__tests__/terminal-core.test.mjs electron/__tests__/app-smoke.test.mjs electron/worker/__tests__/host.test.mjs
```
Expected: PASS.

- [ ] **Step 2: Run repository baseline**

Run:
```bash
npm test
```
Expected: PASS.

- [ ] **Step 3: Manual Electron smoke**

Run:
```bash
npm run start
```
Check:
- terminal starts
- shell accepts input immediately
- terminal pane title reads Terminal
- split handle resizes panes
- preview reloads without obvious extra shell churn

- [ ] **Step 4: Commit**

```bash
git add electron framework docs
git commit -m "feat: rework electron terminal-first shell"
```
