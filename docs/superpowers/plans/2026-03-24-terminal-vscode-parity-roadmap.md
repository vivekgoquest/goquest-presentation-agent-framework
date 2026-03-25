# Terminal VS Code Parity Roadmap

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Electron terminal feel close to VS Code for a single-session workflow, without implementing multi-tabs or terminal splits.

**Architecture:** Keep the existing `xterm.js + PTY` core and improve parity in layers: shell authenticity first, then interaction ergonomics, then search/links, then lightweight shell integration, then persistence and polish. Avoid rebuilding IDE-only features; target the parts of VS Code that most affect day-to-day shell feel.

**Tech Stack:** Electron, xterm.js, @xterm/addon-fit, node-pty, existing worker/preload IPC bridge, Node test runner, Playwright smoke tests.

---

## Session Handoff Context

This roadmap was written after a broader Electron shell cleanup pass. A new session should assume the following is already true and should not be re-discovered from scratch.

### Product direction already chosen
- The app is intentionally **terminal-first**.
- The shell should feel closer to **VS Code terminal** than to an assistant console.
- The right pane has been simplified into a **preview/result surface**, not a project dashboard.
- **Do not add terminal tabs or split terminals** as part of this roadmap.

### Important Electron/UI changes already in place
- Terminal input is already off the old request/response IPC path and uses a fire-and-forget channel.
- Terminal output is already buffered in the renderer before writing into xterm.
- Preview refresh is renderer-driven via `srcdoc`, not full preview navigation churn.
- The preview pane has been stripped down substantially:
  - live slides hide most preview chrome
  - draft/blocked preview states use a shared placeholder-stage model
- Toolbar/action language has already been simplified:
  - one primary CTA + `More`
  - shell-centric wording (`Open shell`, `Close shell`, etc.)

### Current terminal implementation baseline
- Renderer terminal lives in `electron/renderer/app.js` and uses:
  - `Terminal` from xterm.js
  - `@xterm/addon-fit`
- Backend lives in `framework/runtime/terminal-core.mjs` and currently:
  - uses `node-pty` first, Python PTY bridge as fallback
  - starts the shell in the project root when a project is active
  - currently resolves non-Windows shell args to `['-i']`
  - tracks meta such as `cwd`, `shell`, `pid`, `alive`, `cols`, `rows`, `backend`, `state`, `projectRoot`, `lastExit`
- Terminal metadata and lifecycle events already flow through:
  - `framework/runtime/terminal-events.mjs`
  - `electron/worker/terminal-service.mjs`
  - `electron/preload.cjs`

### Most likely parity pain points right now
These are the main reasons the terminal may still not feel like VS Code yet:
- shell startup is interactive but not explicitly login-shell / env-parity oriented
- no terminal find UI yet
- no explicit clipboard ergonomics layer yet
- no URL/file-path link handling layer yet
- no shell-integration / command-boundary awareness yet
- no session restore yet

### Verification baseline at time of writing
- `npm test` was green when this roadmap was written.
- If a new session starts from here, re-run `npm test` before claiming any terminal parity work is complete.

### Practical guidance for the next session
- Start with **Sprint 1** unless the human explicitly reprioritizes.
- Do not re-open the broader preview/dashboard redesign unless terminal work forces it.
- Preserve the current product direction: **quiet chrome, shell-first workflow, preview as result surface**.
- Use TDD for each terminal improvement and keep changes incremental; this area touches Electron transport, renderer behavior, and PTY lifecycle.

### Execution notes from the first implementation slice
- A clean global worktree was created at:
  - `~/.config/superpowers/worktrees/presentation-framework/terminal-vscode-parity`
- That worktree was useful for baseline verification, but it does **not** include the uncommitted Electron/UI terminal baseline that this roadmap assumes.
- Because of that, active Sprint 1 implementation continued in the **current workspace**, not the clean worktree.
- Baseline verification in the clean worktree succeeded:
  - `npm install`
  - `npm test`
  - result: **81 passing, 0 failing**
- Sprint 1 has already started in the current workspace with two TDD-backed slices:
  - backend slice in `framework/runtime/terminal-core.mjs`
    - added `resolveShellLaunchOptions(...)`
    - common POSIX shells now prefer login-shell startup (`['-l']`)
    - unknown POSIX shells still fall back to interactive startup (`['-i']`)
    - launch env normalization is now covered by tests (`TERM`, `BASH_SILENCE_DEPRECATION_WARNING`, inherited env)
    - terminal session meta now includes `loginShell`
  - renderer copy/state slice in `electron/renderer/ui-model.js` + `electron/renderer/app.js`
    - running-shell detail now surfaces the active shell compactly
    - login shells are described as e.g. `zsh login shell ready in this project.`
    - fallback interactive shells are described without noisy full paths
    - the visible terminal header subtitle now includes shell context while running, e.g. `Shell open • my-project • zsh login shell`
- Tests already added and passing for these slices:
  - `framework/runtime/__tests__/terminal-core.test.mjs`
  - `electron/renderer/__tests__/ui-model.test.mjs`
  - `electron/__tests__/terminal-smoke.test.mjs`
    - dedicated Electron terminal smoke coverage now owns the shell-name/subtitle assertion
    - this was intentionally split out of the preview-heavy `app-smoke` file so terminal verification no longer rides on preview smoke behavior
  - targeted terminal-adjacent verification:
    - `node --test electron/__tests__/terminal-smoke.test.mjs framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/ui-model.test.mjs electron/worker/__tests__/host.test.mjs`
    - result: **21 passing, 0 failing**
- Full-suite verification status after this slice:
  - `npm test` currently hits a **full-suite-only** failure in `electron/__tests__/app-smoke.test.mjs`
  - failing test name: `electron preview applies a generic viewport shell for ready slide decks`
  - observed errors across full-suite runs:
    - `Execution context was destroyed, most likely because of a navigation`
    - `Frame was detached`
  - the same preview test passed when re-run in isolation, so current evidence points to an existing or pre-existing timing/flake issue in the preview smoke suite rather than a proven Sprint 1 terminal regression
  - no fix for that preview flake has been attempted yet; treat it as a separate debugging task unless new evidence ties it to terminal changes
- Sprint 2 now includes three TDD-backed interaction slices:
  - clipboard / keyboard slice
    - added `electron/renderer/terminal-interaction.js`
      - `isTerminalShortcutModifierActive(...)`
      - `getTerminalClipboardAction(...)`
      - `runTerminalClipboardAction(...)`
    - added `electron/renderer/__tests__/terminal-interaction.test.mjs`
      - covers cmd/ctrl modifier behavior
      - copy only when selection exists
      - paste/select-all only for focused terminal state
      - action execution for copy/paste/select-all
    - added clipboard bridge methods in Electron:
      - `electron/preload.cjs`
      - `electron/main.mjs`
      - `window.electron.system.readClipboardText()`
      - `window.electron.system.writeClipboardText(text)`
    - wired renderer keyboard handling in `electron/renderer/app.js`
      - terminal-scoped copy/paste/select-all shortcuts now route through the new helper + clipboard bridge
  - terminal context-menu slice
    - added `getTerminalContextMenuItems(...)` in `electron/renderer/terminal-interaction.js`
    - added native terminal context-menu bridge methods:
      - `window.electron.terminal.showContextMenu(options)`
      - `window.electron.terminal.onContextMenuAction(callback)`
    - added Electron main-menu handling in `electron/main.mjs`
      - minimal terminal menu items: `Copy`, `Paste`, `Select All`
      - copy writes the current selection directly through Electron clipboard
      - paste/select-all send focused actions back to the renderer
    - wired renderer `contextmenu` handling in `electron/renderer/app.js`
      - right-click on the terminal now opens the terminal-scoped menu
  - selection / discoverability polish slice
    - added `getTerminalShortcutHint(...)` and `getTerminalSurfaceState(...)` in `electron/renderer/terminal-interaction.js`
    - terminal container now exposes a compact tooltip hint such as:
      - macOS: `⌘C copy selection • ⌘V paste • ⌘A select all`
      - non-macOS: `Ctrl+C copy selection • Ctrl+V paste • Ctrl+A select all`
    - terminal pane now tracks:
      - `data-terminal-focused`
      - `data-terminal-selection`
    - `electron/renderer/app.css` now gives the terminal a subtle focus ring / header emphasis and an accent-colored subtitle when selection exists
    - xterm selection colors were tightened in `electron/renderer/app.js` with stronger active/inactive selection backgrounds
- Targeted Sprint 2 verification already passing:
  - `node --test electron/renderer/__tests__/terminal-interaction.test.mjs electron/__tests__/terminal-smoke.test.mjs framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/ui-model.test.mjs electron/worker/__tests__/host.test.mjs`
  - result: **31 passing, 0 failing**
- Sprint 3 has now started with a first TDD-backed terminal-search slice:
  - added `electron/renderer/terminal-search.js`
    - `isTerminalSearchShortcut(...)`
    - `getTerminalSearchAction(...)`
    - `getTerminalSearchUiModel(...)`
  - added `electron/renderer/__tests__/terminal-search.test.mjs`
    - covers cmd/ctrl+F search shortcut behavior
    - Enter / Shift+Enter / Escape behavior inside the search UI
    - minimal query-aware search UI model
  - added the real xterm search dependency:
    - `@xterm/addon-search`
  - wired the addon + UI in:
    - `electron/renderer/index.html`
    - `electron/renderer/app.css`
    - `electron/renderer/app.js`
  - current Sprint 3 terminal search behavior:
    - visible `Find` button in terminal header while shell is open
    - compact search row opens inside the terminal pane
    - `Cmd/Ctrl+F` opens terminal search when terminal is focused
    - `Enter` = next match
    - `Shift+Enter` = previous match
    - `Escape` / `Done` closes search and returns focus to the terminal
- Targeted Sprint 3 verification already passing:
  - `node --test electron/renderer/__tests__/terminal-interaction.test.mjs electron/renderer/__tests__/terminal-search.test.mjs electron/__tests__/terminal-smoke.test.mjs framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/ui-model.test.mjs electron/worker/__tests__/host.test.mjs`
  - result: **34 passing, 0 failing**
- Sprint 3 now also includes a first URL-link slice:
  - added `electron/renderer/terminal-links.js`
    - `normalizeTerminalExternalUrl(...)`
    - `openTerminalExternalLink(...)`
  - added `electron/renderer/__tests__/terminal-links.test.mjs`
    - only `http:`, `https:`, and `mailto:` URLs are allowed
    - `file:`, `javascript:`, and relative paths are rejected
  - added native external-open bridge methods:
    - `window.electron.system.openExternal(url)` in `electron/preload.cjs`
    - `presentation:open-external` in `electron/main.mjs`
  - added real xterm URL detection wiring in `electron/renderer/app.js` using:
    - `@xterm/addon-web-links`
  - added the browser-side addon script in `electron/renderer/index.html`
- Targeted Sprint 3 verification already passing:
  - `node --test electron/renderer/__tests__/terminal-links.test.mjs electron/renderer/__tests__/terminal-search.test.mjs electron/renderer/__tests__/terminal-interaction.test.mjs electron/__tests__/terminal-smoke.test.mjs framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/ui-model.test.mjs electron/worker/__tests__/host.test.mjs`
  - result: **36 passing, 0 failing**
- Sprint 3 now also includes a first file-path link slice:
  - expanded `electron/renderer/terminal-links.js`
    - added `normalizeTerminalProjectPathLink(...)`
    - added `createTerminalProjectPathLinkProvider(...)`
  - added renderer tests in `electron/renderer/__tests__/terminal-links.test.mjs`
    - project-local relative/absolute file paths are normalized to project-relative targets
    - line/column suffixes like `brief.md:12:4` are stripped for reveal targets
    - paths outside the project root are rejected
  - updated runtime reveal behavior in `framework/runtime/terminal-core.mjs`
    - `terminal.reveal(...)` now changes into the containing directory when the reveal target is a file
    - this avoids `cd ...: Not a directory` failures for clicked file links
  - added runtime coverage in `framework/runtime/__tests__/terminal-core.test.mjs`
    - verifies revealing `brief.md` changes into the containing project directory without shell errors
  - wired a real xterm project-path link provider in `electron/renderer/app.js`
    - project-local file-like paths rendered in terminal output can now activate `window.electron.terminal.reveal(targetPath)`
- Important debugging note from this slice:
  - an initial implementation imported Node's `path` module inside `electron/renderer/terminal-links.js`
  - that broke renderer module loading with: `Failed to resolve module specifier "path"`
  - fix: replaced Node-path usage with browser-safe path normalization logic inside the renderer helper
- Targeted Sprint 3 verification already passing:
  - `node --test electron/renderer/__tests__/terminal-links.test.mjs electron/renderer/__tests__/terminal-search.test.mjs electron/renderer/__tests__/terminal-interaction.test.mjs electron/__tests__/terminal-smoke.test.mjs framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/ui-model.test.mjs electron/worker/__tests__/host.test.mjs`
  - result: **38 passing, 0 failing**
- Sprint 4 has now started with a first lightweight shell-integration slice:
  - expanded `framework/runtime/terminal-core.mjs`
    - added `extractTerminalCwdFromOutput(...)`
    - parses OSC 7 working-directory sequences from terminal output
    - updates `meta.cwd` when shell output reports a cwd change
    - emits fresh terminal meta when cwd changes are detected
  - added runtime tests in `framework/runtime/__tests__/terminal-core.test.mjs`
    - parses OSC 7 sequences with BEL and ST terminators
    - verifies shell output can update terminal cwd meta to `/tmp/cwd-updated`
  - this gives the terminal a first real shell-awareness path without implementing full command markers yet
- Targeted shell-integration verification already passing:
  - `node --test framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/terminal-links.test.mjs electron/renderer/__tests__/terminal-search.test.mjs electron/renderer/__tests__/terminal-interaction.test.mjs electron/__tests__/terminal-smoke.test.mjs electron/renderer/__tests__/ui-model.test.mjs electron/worker/__tests__/host.test.mjs`
  - result: **40 passing, 0 failing**
- Sprint 4 now also includes a visible cwd-context slice in the renderer:
  - expanded `electron/renderer/ui-model.js`
    - added compact cwd-context derivation for running shells
    - when `meta.cwd` diverges from `projectRoot`, the UI now exposes a compact cwd suffix
    - examples:
      - inside project subtree: `slides/020-slide-02`
      - outside project root: final directory segment such as `workbench`
  - updated `electron/renderer/app.js`
    - terminal subtitle now joins: label • project leaf • shell context • cwd context
  - updated renderer tests in `electron/renderer/__tests__/ui-model.test.mjs`
    - verifies cwd context for both in-project and outside-project cwd divergence cases
- Targeted shell-integration verification already passing:
  - `node --test electron/renderer/__tests__/ui-model.test.mjs framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/terminal-links.test.mjs electron/renderer/__tests__/terminal-search.test.mjs electron/renderer/__tests__/terminal-interaction.test.mjs electron/__tests__/terminal-smoke.test.mjs electron/worker/__tests__/host.test.mjs`
  - result: **40 passing, 0 failing**
- Sprint 4 now also includes a first command-awareness slice in the runtime:
  - expanded `framework/runtime/terminal-core.mjs`
    - added `extractShellIntegrationSignalsFromOutput(...)`
    - parses OSC 133 shell-integration markers:
      - `A` → prompt start
      - `B` → command start
      - `C` → command executing
      - `D;<exit>` → command finish with exit code
    - terminal meta now tracks lightweight shell-integration state:
      - `supported`
      - `commandState`
      - `lastCommandStartedAt`
      - `lastCommandCompletedAt`
      - `lastCommandExitCode`
      - `lastPromptAt`
  - updated runtime tests in `framework/runtime/__tests__/terminal-core.test.mjs`
    - verifies marker parsing
    - verifies runtime meta updates to `running` and then `failed` with exit code `23`
- Targeted shell-integration verification already passing:
  - `node --test framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/ui-model.test.mjs electron/renderer/__tests__/terminal-links.test.mjs electron/renderer/__tests__/terminal-search.test.mjs electron/renderer/__tests__/terminal-interaction.test.mjs electron/__tests__/terminal-smoke.test.mjs electron/worker/__tests__/host.test.mjs`
  - result: **42 passing, 0 failing**
- Sprint 4 now also includes a quiet command-status renderer slice:
  - expanded `electron/renderer/ui-model.js`
    - adds compact `commandContext` for running shells
    - shows `command running` when shell integration reports an active command
    - shows `exit <code>` only for non-zero exits
    - keeps successful command completions silent to avoid noisy subtitle churn
  - updated `electron/renderer/app.js`
    - terminal subtitle now includes command context as the final compact segment when present
  - updated `electron/renderer/__tests__/ui-model.test.mjs`
    - verifies `command running`
    - verifies `exit 23`
- Targeted terminal verification already passing:
  - `node --test electron/renderer/__tests__/ui-model.test.mjs framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/terminal-links.test.mjs electron/renderer/__tests__/terminal-search.test.mjs electron/renderer/__tests__/terminal-interaction.test.mjs electron/__tests__/terminal-smoke.test.mjs electron/worker/__tests__/host.test.mjs`
  - result: **42 passing, 0 failing**
- A full-trust Electron operator CLI has now been added for real-user-style automation:
  - new files:
    - `electron/operator/paths.mjs`
    - `electron/operator/controller.mjs`
    - `electron/operator/server.mjs`
    - `electron/operator/cli.mjs`
    - `electron/__tests__/operator-cli.test.mjs`
    - `docs/electron-operator-cli.md`
  - package script added:
    - `npm run operator -- <command>`
  - architecture:
    - persistent local operator server
    - bash-callable CLI client
    - Playwright Electron driver + existing preload bridge
  - validated real-user flow through the app:
    - launch Electron app
    - create project
    - wait for shell open
    - focus terminal
    - type `claude --help`
    - press Enter
    - wait for terminal output
    - open terminal find UI
    - take screenshot
  - important operator hardening fixes discovered while using it:
    - stale Playwright page handles after app close now self-heal on relaunch/state reads
    - `create-project` / `open-project` results were made concise for agent consumption
    - terminal text extraction was switched to select-all/copy behavior instead of noisy xterm DOM scraping
- Targeted operator + terminal verification already passing:
  - `node --test electron/__tests__/operator-cli.test.mjs framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/ui-model.test.mjs electron/renderer/__tests__/terminal-interaction.test.mjs electron/renderer/__tests__/terminal-search.test.mjs electron/renderer/__tests__/terminal-links.test.mjs electron/__tests__/terminal-smoke.test.mjs electron/worker/__tests__/host.test.mjs`
  - result: **43 passing, 0 failing**
- If resuming from here, the next best terminal roadmap move is:
  1. keep shell-integration UI here if the current subtitle density feels right
  2. otherwise reduce or restyle subtitle segments before adding anything else
  3. continue ignoring session restore / persistence until reprioritized
  4. use the operator CLI for real-user regression flows before adding more terminal features
  5. keep the preview smoke flake separate from terminal work unless evidence connects them

---

## Scope

### In scope
- Shell startup authenticity
- Clipboard / selection / keyboard ergonomics
- Terminal search
- URL / file-path links
- Lightweight shell integration and command awareness
- Session restore and terminal polish
- VS Code-like terminal chrome density for a **single terminal session**

### Explicit non-goals
- Multiple terminal tabs
- Split terminals
- Full VS Code task/debug/problem integration
- Pixel-perfect VS Code cloning
- Extension ecosystem parity

---

## File Structure / Ownership Map

### Existing files to modify
- `framework/runtime/terminal-core.mjs`
  - Shell startup semantics, cwd/env handling, session metadata, shell integration hooks
- `framework/runtime/terminal-events.mjs`
  - Additional terminal event channels / payloads if shell integration markers are added
- `electron/worker/terminal-service.mjs`
  - Thin adapter only; expose terminal-core capabilities upward
- `electron/preload.cjs`
  - Renderer-safe terminal APIs for find, clipboard, link-open, restore, etc.
- `electron/main.mjs`
  - Electron-side clipboard, external-link open, and any native shell/menu accelerators
- `electron/renderer/app.js`
  - xterm configuration, keyboard wiring, addon mounting, link handling, search UI wiring, restore UX
- `electron/renderer/app.css`
  - Terminal chrome density, find UI, hover/link states, subtle VS Code-like affordances
- `electron/renderer/index.html`
  - Minimal terminal find UI and any compact terminal utility controls
- `electron/renderer/ui-model.js`
  - Terminal state copy and reduced/clear shell-centric status messaging

### Existing tests to extend
- `framework/runtime/__tests__/terminal-core.test.mjs`
- `electron/__tests__/app-smoke.test.mjs`
- `electron/renderer/__tests__/ui-model.test.mjs`
- `electron/worker/__tests__/host.test.mjs`

### New tests likely needed
- `electron/renderer/__tests__/terminal-interaction.test.mjs`
  - Renderer-only behaviors: find UI state, link formatting, keyboard handling, clipboard affordances
- `framework/runtime/__tests__/terminal-shell-integration.test.mjs`
  - If shell integration parsing grows enough to deserve isolated tests

---

## Current Parity Snapshot

### Already strong
- `xterm.js` renderer is in place
- `node-pty` backend exists with Python fallback
- Fast fire-and-forget input path exists
- Output batching exists
- Fit/resize loop exists
- Project-root shell startup exists
- Terminal metadata model exists

### Biggest parity gaps
- Login-shell / env parity
- Clipboard / selection ergonomics
- Find in terminal
- URL and file-path links
- Lightweight shell integration / command awareness
- Session restore
- Further terminal chrome reduction

---

## Sprint 1: Shell Authenticity First

**Goal:** Make the shell feel like the user’s real terminal session, not a wrapped subprocess.

**Demo / Validation:**
- Launch the app, open a project, and verify the shell starts in the expected cwd with the user’s expected shell environment.
- Run targeted tests for shell args, cwd, readiness, and metadata.

### Task 1.1: Audit current shell startup semantics
- **Files:**
  - Modify: `framework/runtime/terminal-core.mjs`
  - Test: `framework/runtime/__tests__/terminal-core.test.mjs`
- [ ] Add a failing test that captures current shell argument behavior on macOS/Linux.
- [ ] Add a failing test for login-shell/env parity expectations.
- [ ] Verify the failing reason is shell startup semantics, not unrelated PTY issues.

### Task 1.2: Add configurable login-shell startup policy
- **Files:**
  - Modify: `framework/runtime/terminal-core.mjs`
  - Test: `framework/runtime/__tests__/terminal-core.test.mjs`
- [ ] Implement minimal shell-arg selection that supports login-shell parity on non-Windows platforms.
- [ ] Preserve current Windows behavior.
- [ ] Emit unchanged meta events and keep startup sequencing stable.

### Task 1.3: Tighten environment inheritance
- **Files:**
  - Modify: `framework/runtime/terminal-core.mjs`
  - Test: `framework/runtime/__tests__/terminal-core.test.mjs`
- [ ] Add a failing test for key env expectations (`TERM`, inherited user env, cwd consistency).
- [ ] Implement minimal env normalization without introducing app-owned shell profiles yet.
- [ ] Verify no regression in current shell start/stop tests.

### Task 1.4: Surface shell identity clearly in meta/state
- **Files:**
  - Modify: `framework/runtime/terminal-core.mjs`
  - Modify: `electron/renderer/ui-model.js`
  - Test: `electron/renderer/__tests__/ui-model.test.mjs`
- [ ] Add failing tests for clearer shell state copy if shell profile / login state is exposed.
- [ ] Expose only useful shell metadata; avoid noisy diagnostic UI.

---

## Sprint 2: Clipboard, Selection, and Keyboard Ergonomics

**Goal:** Make everyday text interaction feel like VS Code.

**Demo / Validation:**
- Mouse select text, copy it, paste into the shell, and interrupt a command without copy/paste conflicts.
- Verify keyboard-driven copy/paste behavior on macOS and non-macOS code paths.

### Task 2.1: Document current selection/copy/paste gaps
- **Files:**
  - Create: `electron/renderer/__tests__/terminal-interaction.test.mjs`
  - Modify: `electron/renderer/app.js`
- [ ] Add failing tests for copy selected text, paste clipboard text, and no accidental paste on plain terminal focus.
- [ ] Keep tests renderer-focused and deterministic.

### Task 2.2: Add explicit clipboard behavior
- **Files:**
  - Modify: `electron/preload.cjs`
  - Modify: `electron/main.mjs`
  - Modify: `electron/renderer/app.js`
  - Test: `electron/renderer/__tests__/terminal-interaction.test.mjs`
- [ ] Add minimal safe clipboard bridge methods.
- [ ] Implement renderer copy/paste handling that respects selection state.
- [ ] Preserve shell-native interrupt behavior when no text selection exists.

### Task 2.3: Add terminal context menu basics
- **Files:**
  - Modify: `electron/main.mjs`
  - Modify: `electron/preload.cjs`
  - Modify: `electron/renderer/app.js`
  - Test: `electron/__tests__/app-smoke.test.mjs`
- [ ] Add a minimal terminal context menu: Copy, Paste, Select All.
- [ ] Keep it terminal-scoped; do not turn it into a general app menu project.

### Task 2.4: Improve selection visibility and keyboard discoverability
- **Files:**
  - Modify: `electron/renderer/app.css`
  - Modify: `electron/renderer/index.html`
  - Test: `electron/renderer/__tests__/terminal-interaction.test.mjs`
- [ ] Tune selection colors and small affordances for keyboard hints if needed.
- [ ] Avoid large UI chrome additions.

---

## Sprint 3: Terminal Find and Link Handling

**Goal:** Add the most valuable missing power-user utilities after shell authenticity.

**Demo / Validation:**
- Open terminal find, search for text, jump next/previous, and click URLs/file paths from terminal output.

### Task 3.1: Add terminal search UI and wiring
- **Files:**
  - Modify: `electron/renderer/index.html`
  - Modify: `electron/renderer/app.css`
  - Modify: `electron/renderer/app.js`
  - Test: `electron/renderer/__tests__/terminal-interaction.test.mjs`
- [ ] Add failing tests for opening search UI, search query binding, and next/previous navigation state.
- [ ] Mount the xterm search addon with minimal chrome.
- [ ] Support keyboard entry/escape behavior.

### Task 3.2: Add URL link detection
- **Files:**
  - Modify: `electron/renderer/app.js`
  - Modify: `electron/preload.cjs`
  - Modify: `electron/main.mjs`
  - Test: `electron/renderer/__tests__/terminal-interaction.test.mjs`
- [ ] Add failing tests for opening URLs from terminal output.
- [ ] Use a renderer-safe bridge for external open behavior.

### Task 3.3: Add file-path link handling for project-local files
- **Files:**
  - Modify: `electron/renderer/app.js`
  - Modify: `electron/preload.cjs`
  - Modify: `electron/main.mjs`
  - Test: `electron/renderer/__tests__/terminal-interaction.test.mjs`
- [ ] Add failing tests for clickable file paths / reveal behavior.
- [ ] Reuse existing `terminal.reveal(...)` where possible instead of inventing duplicate flows.

---

## Sprint 4: Lightweight Shell Integration

**Goal:** Add just enough shell intelligence to improve navigation and confidence, without chasing full IDE parity.

**Demo / Validation:**
- Run commands and verify the terminal can distinguish command boundaries / simple success-failure signals where supported.

### Task 4.1: Decide the shell integration strategy
- **Files:**
  - Modify: `framework/runtime/terminal-core.mjs`
  - Create or Modify: `framework/runtime/__tests__/terminal-shell-integration.test.mjs`
- [ ] Add failing tests for whatever integration strategy is chosen (OSC markers, prompt markers, or explicit shell-init snippet).
- [ ] Keep the approach vendor-neutral and shell-aware.

### Task 4.2: Add command-boundary events
- **Files:**
  - Modify: `framework/runtime/terminal-events.mjs`
  - Modify: `framework/runtime/terminal-core.mjs`
  - Modify: `electron/preload.cjs`
  - Modify: `electron/renderer/app.js`
  - Test: `framework/runtime/__tests__/terminal-shell-integration.test.mjs`
- [ ] Emit minimal command-start / command-end metadata where reliable.
- [ ] Do not block terminal rendering on integration parsing.

### Task 4.3: Add lightweight command decorations in the renderer
- **Files:**
  - Modify: `electron/renderer/app.js`
  - Modify: `electron/renderer/app.css`
  - Test: `electron/renderer/__tests__/terminal-interaction.test.mjs`
- [ ] Add subtle decorations only if they improve navigation; avoid noisy badges or IDE overreach.

### Task 4.4: Track cwd changes from shell output/integration
- **Files:**
  - Modify: `framework/runtime/terminal-core.mjs`
  - Modify: `electron/renderer/ui-model.js`
  - Test: `framework/runtime/__tests__/terminal-shell-integration.test.mjs`
- [ ] Keep terminal meta truthful as users `cd` around.
- [ ] Preserve project-root semantics while reflecting actual active cwd.

---

## Sprint 5: Session Restore and Final Polish

**Goal:** Make the terminal feel persistent, trustworthy, and comfortably dense.

**Demo / Validation:**
- Quit and relaunch the app, reopen the project, and verify useful session continuity.
- Verify smoke tests still pass for shell startup and project switching.

### Task 5.1: Add session restore policy
- **Files:**
  - Modify: `framework/runtime/terminal-core.mjs`
  - Modify: `electron/worker/terminal-service.mjs`
  - Modify: `electron/renderer/app.js`
  - Test: `electron/__tests__/app-smoke.test.mjs`
- [ ] Add failing tests for whatever restore scope is chosen (reopen shell automatically, restore cwd, optionally restore backlog).
- [ ] Implement the smallest credible restore behavior first.

### Task 5.2: Raise scrollback quality
- **Files:**
  - Modify: `electron/renderer/app.js`
  - Modify: `framework/runtime/terminal-core.mjs`
  - Test: `framework/runtime/__tests__/terminal-core.test.mjs`
- [ ] Add failing tests or assertions for improved scrollback limits and backlog policy.
- [ ] Avoid unbounded memory growth.

### Task 5.3: Final chrome density pass
- **Files:**
  - Modify: `electron/renderer/index.html`
  - Modify: `electron/renderer/app.css`
  - Modify: `electron/renderer/ui-model.js`
  - Test: `electron/__tests__/app-smoke.test.mjs`
- [ ] Keep the terminal header minimal and focused.
- [ ] Preserve clarity while removing any remaining “wrapped terminal” feel.

---

## Testing Strategy

### Targeted verification by sprint
- **Sprint 1:** `node --test framework/runtime/__tests__/terminal-core.test.mjs electron/renderer/__tests__/ui-model.test.mjs`
- **Sprint 2:** `node --test electron/renderer/__tests__/terminal-interaction.test.mjs electron/__tests__/app-smoke.test.mjs`
- **Sprint 3:** `node --test electron/renderer/__tests__/terminal-interaction.test.mjs electron/__tests__/app-smoke.test.mjs`
- **Sprint 4:** `node --test framework/runtime/__tests__/terminal-shell-integration.test.mjs electron/renderer/__tests__/terminal-interaction.test.mjs`
- **Sprint 5:** `node --test electron/__tests__/app-smoke.test.mjs framework/runtime/__tests__/terminal-core.test.mjs`

### Full verification after each sprint
- [ ] `npm test`
- [ ] Manual smoke in Electron:
  - [ ] open/create a project
  - [ ] verify shell cwd and env feel correct
  - [ ] verify copy/paste/selection
  - [ ] verify find in terminal
  - [ ] verify link opening / file reveal
  - [ ] verify blocked/ready project transitions do not break the shell

---

## Risks & Gotchas

- **Login-shell changes can break user environments.** Mitigation: ship with explicit tests and preserve a fallback path.
- **Clipboard shortcuts differ by platform.** Mitigation: keep platform-specific handling narrow and tested.
- **Shell integration is fragile across shells.** Mitigation: build a lightweight path, not full parity; degrade gracefully.
- **Session restore can resurrect broken state.** Mitigation: restore minimally at first (shell alive + cwd), not full process history.
- **Renderer add-ons can add latency if misused.** Mitigation: keep find/link/search integrations incremental and profile output-heavy sessions.

---

## Rollback Plan

- Revert by sprint, not all at once.
- Keep each sprint self-contained and test-backed.
- If shell authenticity regressions appear, roll back startup/env changes before touching renderer UX work.
- If shell integration proves flaky, remove command-awareness features while preserving search/links/clipboard improvements.

---

## Recommended Execution Order

1. Sprint 1 — Shell authenticity
2. Sprint 2 — Clipboard/selection/keyboard ergonomics
3. Sprint 3 — Find and links
4. Sprint 4 — Lightweight shell integration
5. Sprint 5 — Session restore and final polish

This order maximizes perceived terminal quality fastest without chasing IDE-scale scope.
