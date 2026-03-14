# Electron Native-Host Plan

## What this plan is

This is the alternate plan to `docs/electron-packaging-plan.md`.

The current packaging plan keeps the existing browser architecture and embeds it inside Electron by starting `server.mjs` on a loopback port, then loading the console from `http://127.0.0.1`.

This plan takes the opposite approach:

- Electron is the real host
- the packaged desktop app does not run an embedded Express server
- the renderer does not depend on REST, WebSocket, or SSE
- the preview is served through Electron's protocol layer, not localhost
- the framework runtime is split into reusable core modules plus transport adapters

This is a bigger change than the embedded-server approach, but it yields a cleaner desktop architecture and removes the need to hide a browser app inside Electron.

---

## Short ADR

- Status: Proposed
- Date: 2026-03-14
- Decision owner: Presentation framework maintainers
- Compared options:
  - current packaging plan in `docs/electron-packaging-plan.md`
  - this native-host plan

### Decision

Choose the native Electron host as the target architecture for packaged desktop builds.

Keep the current embedded HTTP packaging plan available as a fallback for fast shell experiments and browser compatibility during migration, but do not use it as the long-term packaged-app architecture.

### Decision matrix against the current packaging plan

| Criterion | Current packaging plan: embedded HTTP shell | Native-host plan: Electron as the real host | Winner |
| --- | --- | --- | --- |
| Time to first demo | Best: reuses `server.mjs`, the current console, and HTTP transports almost unchanged | Slower: requires service extraction, IPC, and a new renderer | Current packaging plan |
| Desktop architecture cleanliness | Keeps browser-era localhost, REST, WS, and SSE assumptions inside the app | Separates shared runtime core, Electron worker, renderer, and protocol handlers | Native-host plan |
| Long-term maintenance | Higher transport debt and more hidden coupling to web runtime behavior | Lower transport debt once the extraction is complete | Native-host plan |
| Security posture | Packaged app depends on a hidden local server and broad renderer assumptions | Renderer gets explicit capabilities through preload and IPC | Native-host plan |
| Preview/runtime control | Preview stays tied to web routes and browser-origin behavior | Preview can be delivered through Electron protocols | Native-host plan |
| Short-term migration risk | Lower because it changes less up front | Higher because it adds a new host stack | Current packaging plan |
| Fit for a durable desktop product | Acceptable as a wrapper | Strong fit as the real product architecture | Native-host plan |

### Consequences

- Runtime and terminal logic must be extracted into reusable services before substantial Electron renderer work starts.
- Browser/server mode remains supported during migration, but it becomes a compatibility surface rather than the packaged-app foundation.
- Desktop renderer code must not depend on `/api/...`, `/preview/`, WebSocket terminal transport, or SSE live reload.
- Delivery takes longer than the embedded-server shell, so early milestones should be organized around service extraction, not UI polish.

---

## Decision

**Build a native Electron host, not an Electron shell around the current HTTP app.**

That means:

- no packaged `server.mjs` as the primary app runtime
- no `loadURL('http://127.0.0.1:...')`
- no renderer dependency on `/api/...`, `/preview/`, `/node_modules/...`, WebSocket terminal transport, or EventSource live reload
- no dependence on browser-origin assumptions in `project-console.html` and `project-console.js`

Instead:

- Electron `BrowserWindow` loads a packaged renderer from `app://` or `file://`
- Electron `utilityProcess` owns the long-running backend worker
- renderer and worker communicate over IPC
- preview HTML and project assets are served through a custom Electron protocol

---

## Why choose this path

The embedded-server plan is faster to prototype, but it preserves browser-era coupling:

- console UI still assumes HTTP
- terminal still assumes WebSocket
- preview still assumes a web route
- live reload still assumes SSE
- desktop packaging still depends on a hidden web server being healthy

A native-host plan costs more upfront, but it gives us a better long-term product:

- cleaner desktop mental model
- fewer production dependencies
- no hidden loopback server
- no browser-transport stack inside the packaged app
- more direct control over terminal, preview, and file watching
- better security posture because the renderer only gets explicit capabilities

This plan should be chosen if the goal is a durable desktop product, not the fastest possible Electron wrapper.

---

## Non-goals

This plan does not try to:

- keep `project-console.js` unchanged
- preserve REST, WebSocket, or SSE as the desktop transport contract
- reuse `server.mjs` as the packaged runtime host
- make the first implementation the shortest path to a demo

This plan does try to:

- preserve the existing deck authoring contract
- preserve project-folder mode and deck policy enforcement
- preserve export, capture, finalize, and check behavior
- preserve terminal reliability, including the Python PTY fallback if needed
- preserve browser mode and CLI mode as separate compatibility surfaces during migration

---

## Current architecture

Today the repo has three concerns mixed together:

1. Core presentation logic
   - `framework/runtime/deck-assemble.js`
   - `framework/runtime/deck-policy.js`
   - `framework/runtime/deck-quality.js`
   - `framework/runtime/deck-source.js`
   - `framework/runtime/project-state.js`
   - `framework/runtime/deck-paths.js`
   - `framework/runtime/pdf-export.js`

2. Browser/server transport
   - `framework/runtime/server.mjs`
   - Express routes
   - WebSocket terminal transport
   - SSE live reload
   - HTTP preview routes

3. Browser renderer behavior
   - `framework/console/project-console.html`
   - `framework/console/project-console.js`
   - `framework/console/project-console.css`

The alternate plan separates these concerns cleanly.

---

## Target architecture

```text
Electron main process
  - owns app lifecycle, menus, windows, custom protocols
  - starts one long-running utility process
  - brokers privileged capabilities to renderer through preload IPC

Electron utility process
  - owns project open/create/switch
  - owns PTY terminal session and lifecycle
  - owns file watching and emits structured change events
  - owns export/check/capture/finalize execution
  - calls shared framework core modules directly

Electron renderer
  - loads from app:// or file://
  - renders workspace UI
  - uses preload IPC only
  - embeds preview using a custom protocol URL

Custom protocol layer
  - presentation://preview/current
  - presentation://project-file/...
  - presentation://framework-file/...
```

No embedded Express server is required in the packaged app.

---

## Core architectural principles

### 1. Shared core, multiple hosts

The deck system should be host-agnostic.

Core modules should be callable from:

- CLI commands
- browser/server mode
- Electron worker mode

The transport should change, not the deck rules.

### 2. Desktop renderer gets capabilities, not filesystem access

The renderer should not directly read arbitrary disk paths.

Instead it requests capabilities such as:

- open project
- list project files
- read project state
- launch terminal mode
- send terminal input
- export PDF
- finalize deck

That keeps desktop behavior explicit and testable.

### 3. Preview remains assembled on demand

The framework contract already assumes runtime assembly from slide folders and theme CSS.

That should remain true.

The difference is only the host:

- browser mode: HTTP preview route can still exist
- Electron mode: custom protocol handler returns the assembled HTML

### 4. Migration favors extraction over rewrite

We should not rewrite deck logic.

We should extract reusable services from the current server entrypoints, then build a new Electron transport around them.

---

## Proposed module split

### Shared framework core

Keep and reuse:

- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-policy.js`
- `framework/runtime/deck-quality.js`
- `framework/runtime/deck-source.js`
- `framework/runtime/project-state.js`
- `framework/runtime/deck-paths.js`
- `framework/runtime/pdf-export.js`

Refactor if needed to expose cleaner service functions:

- `framework/runtime/new-deck.mjs`
- `framework/runtime/check-deck.mjs`
- `framework/runtime/deck-capture.mjs`
- `framework/runtime/export-pdf.mjs`
- `framework/runtime/finalize-deck.mjs`

These scripts currently act like CLI entrypoints. Under this plan, their logic should be extractable into reusable functions that the CLI wrappers call.

### New Electron-specific surface

Add a new top-level Electron area, for example:

```text
electron/
  main.mjs
  preload.cjs
  renderer/
    index.html
    app.js
    app.css
    components/
  worker/
    host.mjs
    project-service.mjs
    terminal-service.mjs
    preview-service.mjs
    export-service.mjs
    watch-service.mjs
    ipc-contract.mjs
```

### Compatibility layer

Keep browser mode temporarily:

- `framework/runtime/server.mjs`
- current operator console

But treat it as a compatibility mode, not the future desktop host.

---

## Renderer plan

The Electron renderer should be a new app, not a direct reuse of `project-console.js`.

### Renderer responsibilities

- project picker and recent projects
- file tree and selection
- task composer and quick-action controls
- terminal panel using xterm
- preview panel with slide navigation
- status pills, outputs, and deck state

### Renderer data flow

Instead of:

- `fetch('/api/project/meta')`
- `fetch('/api/project/state')`
- `fetch('/api/project/files')`
- `new WebSocket(...)`
- `new EventSource(...)`

Use:

- `window.electron.project.getMeta()`
- `window.electron.project.getState()`
- `window.electron.project.getFiles()`
- `window.electron.terminal.start(mode)`
- `window.electron.terminal.send(data)`
- `window.electron.terminal.onOutput(callback)`
- `window.electron.watch.onChange(callback)`

### Renderer migration approach

Do not try to progressively patch `project-console.js` into a desktop renderer.

Instead:

1. keep the current browser console intact for browser mode
2. build a new Electron renderer with the same UX goals
3. reuse layout patterns and visual design where helpful
4. move feature-by-feature onto IPC contracts

This avoids a long hybrid period where one file tries to support both HTTP and desktop transports.

---

## Terminal architecture

The terminal should be owned by the Electron worker, not the renderer and not an HTTP server.

### Terminal service responsibilities

- spawn PTY backend
- support launch modes: `shell`, `codex`, `claude`
- maintain terminal metadata
- accept input and resize
- support restart, stop, clear, reveal-in-terminal
- broadcast structured terminal events to renderer

### Backend strategy

Preserve the current dual-backend philosophy:

- first try `node-pty`
- if unavailable or incompatible, fall back to the Python PTY bridge

That logic can likely be extracted from `framework/runtime/terminal-session.js` into a reusable module, then consumed by:

- browser/server mode
- Electron worker mode

### Terminal IPC contract

Examples:

- `terminal:start`
- `terminal:stop`
- `terminal:clear`
- `terminal:resize`
- `terminal:input`
- `terminal:revealPath`
- `terminal:getMeta`
- event stream:
  - `terminal/output`
  - `terminal/meta`
  - `terminal/exit`
  - `terminal/error`

---

## Preview architecture

This is the most important difference from the embedded-server plan.

### Desktop preview should use a custom protocol

Register a privileged custom protocol, for example:

- `presentation://preview/current`
- `presentation://project-file/<relative-path>`
- `presentation://framework-file/<relative-path>`

### How preview works

1. renderer asks worker for current preview context
2. preview iframe loads `presentation://preview/current`
3. protocol handler asks worker for assembled HTML
4. assembled HTML references project and framework assets through the same custom protocol
5. when files change, renderer updates preview token or reloads iframe

### Why this is better than localhost

- no hidden web server
- no port management
- no loopback transport debugging
- no browser-origin dependency
- no HTTP hard-coding in the packaged desktop product

### Required supporting work

Current assembled HTML likely assumes HTTP asset paths. We need a preview-service that can:

- rewrite asset URLs to custom protocol URLs
- serve project-local assets safely
- serve framework-owned assets safely
- preserve deck policy and ownership boundaries

This is real work, but it is the right work for a native host.

---

## Project lifecycle architecture

The Electron worker owns project selection and project state.

### Open existing project

1. user picks folder
2. worker validates `.presentation/project.json`
3. if valid, worker loads project context
4. renderer receives meta, state, file tree, outputs

### Create new project

1. user chooses target folder and initial slide count
2. worker calls extracted scaffold function from `new-deck`
3. worker sets project as active
4. renderer reloads project state

### Switch project

1. worker stops terminal session
2. worker swaps active project context
3. worker resets watchers
4. preview token changes
5. renderer refreshes UI

---

## File watching and live refresh

Replace SSE with worker-driven watch events.

### Watch responsibilities

- watch framework host files when relevant
- watch active project files
- ignore outputs, PDFs, node_modules, and `.git`
- debounce change events
- emit structured events to renderer

### Renderer behavior

- update file tree if needed
- refresh project state
- reload preview when the change affects previewable content
- avoid full-window reload when only the preview changes

This gives us the benefits of live reload without preserving browser-era transport choices.

---

## Export, capture, check, and finalize

These commands should move behind worker services that call shared framework functions directly.

### Export

- worker runs export service
- returns PDF bytes or output path
- renderer can trigger save/open flows

### Capture

- worker runs capture service
- writes screenshots into `outputs/`
- renderer updates output status

### Check

- worker runs deck policy and quality checks
- returns structured diagnostics

### Finalize

- worker runs the same sequence currently used by finalize
- policy and quality remain authoritative

### Important rule

Do not re-implement policy logic inside Electron.

Electron should call the same policy and quality modules the CLI and server use.

---

## Packaging model

### Desktop app contents

Bundle:

- Electron app shell
- renderer assets
- worker code
- shared framework core
- templates, prompts, specs
- Playwright browser bundle
- optional portable Git distribution if we truly need packaged Git behavior

Do not bundle:

- Express as a required runtime dependency for the packaged desktop host
- ws/SSE as the primary desktop transport path

### Playwright strategy

Keep the same practical rule:

- install browsers into a known bundleable directory at build time
- ship them via app resources
- point Playwright to the bundled location at runtime

### Process model

Use Electron `utilityProcess` for the long-running worker.

Do not make packaged desktop behavior depend on `child_process.fork()` semantics from Electron main.

---

## Implementation backlog

This backlog breaks the native-host decision into phases, concrete tasks, and file-level ownership. Ownership is by workstream so multiple agents can work in parallel without sharing write scopes.

### Phase 0: lock the target architecture

Exit criteria: this file is the agreed decision record and execution backlog.

| ID | Task | Owner | Files |
| --- | --- | --- | --- |
| P0.1 | Finalize the native-host decision and comparison against the current packaging plan | Docs / Architecture | `docs/electron-native-host-plan.md`, `docs/electron-packaging-plan.md` |
| P0.2 | Freeze sequencing so extraction work lands before Electron renderer work | Docs / Architecture | `docs/electron-native-host-plan.md` |

### Phase 1: extract shared runtime services from CLI wrappers

Exit criteria: CLI commands still work, but their logic is importable as services without shelling out.

| ID | Task | Owner | Files |
| --- | --- | --- | --- |
| P1.1 | Extract scaffold logic behind `new-deck` into a reusable service | Runtime core | Create `framework/runtime/services/scaffold-service.mjs`; modify `framework/runtime/new-deck.mjs`, `framework/runtime/deck-paths.js`, `framework/runtime/project-state.js` |
| P1.2 | Extract check logic behind `check` into a reusable service | Runtime core | Create `framework/runtime/services/check-service.mjs`; modify `framework/runtime/check-deck.mjs`, `framework/runtime/deck-policy.js`, `framework/runtime/deck-quality.js`, `framework/runtime/deck-source.js` |
| P1.3 | Extract export logic behind `export` into a reusable service | Runtime core | Create `framework/runtime/services/export-service.mjs`; modify `framework/runtime/export-pdf.mjs`, `framework/runtime/pdf-export.js`, `framework/runtime/deck-assemble.js` |
| P1.4 | Extract capture logic behind `capture` into a reusable service | Runtime core | Create `framework/runtime/services/capture-service.mjs`; modify `framework/runtime/deck-capture.mjs`, `framework/runtime/deck-runtime.js`, `framework/runtime/deck-assemble.js` |
| P1.5 | Extract finalize logic behind `finalize` into a reusable service | Runtime core | Create `framework/runtime/services/finalize-service.mjs`; modify `framework/runtime/finalize-deck.mjs`, `framework/runtime/project-state.js`, `framework/runtime/deck-quality.js` |
| P1.6 | Add service-level verification so extraction does not regress deck flows | Runtime verification | Create `framework/runtime/services/__tests__/`; modify `framework/runtime/operator-console-smoke.mjs`, `package.json` |

### Phase 2: extract terminal lifecycle into a host-agnostic core

Exit criteria: browser/server mode and future Electron worker mode both use the same terminal core and fallback behavior.

| ID | Task | Owner | Files |
| --- | --- | --- | --- |
| P2.1 | Split PTY/session logic out of the HTTP-specific adapter | Terminal core | Create `framework/runtime/terminal-core.mjs`; modify `framework/runtime/terminal-session.js`, `framework/runtime/pty-bridge.py` |
| P2.2 | Keep the browser/server transport working against the extracted terminal core | Browser compatibility | Modify `framework/runtime/server.mjs`, `framework/runtime/terminal-session.js` |
| P2.3 | Define a transport-neutral terminal event contract | Terminal core | Create `framework/runtime/terminal-events.mjs`; modify `framework/runtime/terminal-core.mjs`, `framework/runtime/server.mjs` |
| P2.4 | Add PTY fallback and lifecycle regression coverage | Runtime verification | Create `framework/runtime/__tests__/terminal-core.test.mjs`; modify `framework/runtime/operator-console-smoke.mjs` |

### Phase 3: build the Electron main process and worker host

Exit criteria: Electron can open a project and invoke project, terminal, and runtime actions without booting Express.

| ID | Task | Owner | Files |
| --- | --- | --- | --- |
| P3.1 | Create the Electron app shell and preload bridge | Electron shell | Create `electron/main.mjs`, `electron/preload.cjs`; modify `package.json`, `package-lock.json` |
| P3.2 | Create the worker host that owns project lifecycle and service dispatch | Electron worker | Create `electron/worker/host.mjs`, `electron/worker/ipc-contract.mjs`, `electron/worker/project-service.mjs` |
| P3.3 | Connect extracted runtime services into the worker | Electron worker | Modify `electron/worker/host.mjs`, `electron/worker/project-service.mjs`; import `framework/runtime/services/*.mjs` |
| P3.4 | Add a worker-side terminal adapter around the shared terminal core | Electron worker | Create `electron/worker/terminal-service.mjs`; modify `framework/runtime/terminal-core.mjs`, `electron/worker/ipc-contract.mjs` |
| P3.5 | Add worker-side file watching and structured change events | Electron worker | Create `electron/worker/watch-service.mjs`; modify `electron/worker/host.mjs`, `electron/worker/ipc-contract.mjs` |

### Phase 4: build a desktop-first renderer

Exit criteria: the renderer drives project actions, terminal, and preview entirely over preload and IPC with no REST, WS, or SSE dependency.

| ID | Task | Owner | Files |
| --- | --- | --- | --- |
| P4.1 | Create the renderer shell and shared app state | Electron renderer | Create `electron/renderer/index.html`, `electron/renderer/app.js`, `electron/renderer/app.css` |
| P4.2 | Implement project picker, recent projects, and open/create actions | Electron renderer | Create `electron/renderer/components/project-picker.js`; modify `electron/renderer/app.js`, `electron/preload.cjs` |
| P4.3 | Implement terminal panel integration over IPC using xterm | Electron renderer | Create `electron/renderer/components/terminal-panel.js`; modify `electron/renderer/app.js`, `electron/preload.cjs`, `package.json` |
| P4.4 | Implement preview and outputs panels without web-route assumptions | Electron renderer | Create `electron/renderer/components/preview-panel.js`, `electron/renderer/components/outputs-panel.js`; modify `electron/renderer/app.js` |
| P4.5 | Port quick actions and project-state controls without carrying over REST, WS, or SSE contracts | Electron renderer | Create `electron/renderer/components/quick-actions.js`; use `framework/console/project-console.js` and `framework/console/project-console.css` only as behavior reference |

### Phase 5: serve preview through Electron protocols

Exit criteria: preview and asset loading work from Electron protocol handlers with deck boundary rules still enforced.

| ID | Task | Owner | Files |
| --- | --- | --- | --- |
| P5.1 | Register custom protocols for preview and project/framework asset reads | Electron shell | Modify `electron/main.mjs`; create `electron/worker/preview-service.mjs` |
| P5.2 | Adapt assembled preview output for protocol-based asset resolution | Preview runtime | Modify `framework/runtime/deck-assemble.js`, `framework/runtime/deck-source.js`, `electron/worker/preview-service.mjs` |
| P5.3 | Preserve deck asset-boundary and policy enforcement under protocol delivery | Runtime core | Modify `framework/runtime/deck-policy.js`, `framework/runtime/deck-runtime.js`, `framework/runtime/deck-paths.js` |
| P5.4 | Add preview smoke tests for project, framework, and slide-local assets | Runtime verification | Create `electron/smoke/preview-protocol-smoke.mjs`; modify `package.json` |

### Phase 6: package, harden, and verify desktop distribution

Exit criteria: packaged builds can open/create a project, run a terminal session, render preview, and complete export/finalize flows on target platforms.

| ID | Task | Owner | Files |
| --- | --- | --- | --- |
| P6.1 | Add Electron build config and platform packaging scripts | Packaging / Release | Modify `package.json`, `package-lock.json`; create `electron-builder.yml` if config moves out of `package.json` |
| P6.2 | Bundle Playwright browsers and wire runtime lookup paths | Packaging / Release | Modify `package.json`, `electron/main.mjs`; create `scripts/install-playwright-browsers.mjs` if a dedicated prebuild step is needed |
| P6.3 | Decide whether bundled Git is required and package it explicitly if needed | Packaging / Release | Modify `package.json`, `electron/main.mjs`; create `electron/resources/` helpers as needed |
| P6.4 | Add packaged-app smoke coverage for open/create, terminal, preview, export, and finalize | Runtime verification | Create `electron/smoke/app-smoke.mjs`; modify `package.json`, `framework/runtime/operator-console-smoke.mjs` |
| P6.5 | Document release and rollback flow for desktop builds | Docs / Release | Modify `README.md`, `START-HERE.md`, `docs/electron-native-host-plan.md` |

### Phase 7: deprecate desktop reliance on the browser/server host

Exit criteria: packaged Electron builds no longer depend on `framework/runtime/server.mjs`, while browser/server mode remains an explicit compatibility path.

| ID | Task | Owner | Files |
| --- | --- | --- | --- |
| P7.1 | Remove Electron-specific assumptions from `server.mjs` and keep it browser-only | Browser compatibility | Modify `framework/runtime/server.mjs`, `framework/runtime/runtime-app.js` |
| P7.2 | Update docs and scripts so desktop and browser workflows are clearly separated | Docs / Architecture | Modify `README.md`, `START-HERE.md`, `AGENTS.md`, `package.json` |
| P7.3 | Add final migration checks proving native-host parity for check/export/capture/finalize | Runtime verification | Modify `framework/runtime/operator-console-smoke.mjs`; create `electron/smoke/parity-smoke.mjs` |

### Ownership map

- Runtime core: `framework/runtime/services/`, CLI wrappers, deck policy/runtime helpers
- Terminal core: `framework/runtime/terminal-*`, `framework/runtime/pty-bridge.py`
- Electron shell: `electron/main.mjs`, `electron/preload.cjs`, protocol registration, app lifecycle
- Electron worker: `electron/worker/*`
- Electron renderer: `electron/renderer/*`
- Packaging / release: `package.json`, `package-lock.json`, build config, bundled resources
- Docs / architecture: `docs/*.md`, `README.md`, `START-HERE.md`, `AGENTS.md`

### Sequencing rules

- Do not start renderer work until Phase 1 and Phase 2 extraction produce stable imported services.
- Do not start protocol work until the Electron worker can already assemble preview HTML without Express.
- Keep `framework/runtime/server.mjs` runnable during Phases 1-6 so browser mode remains a live fallback.
- Treat any reintroduction of desktop REST, WebSocket, or SSE dependencies as a regression against this decision.

---

## Risks

### Higher initial implementation cost

This is not the fastest route.

Mitigation:

- stage it through service extraction
- keep browser mode working while desktop mode matures

### Preview protocol complexity

Custom protocols and asset rewriting are more work than loading a local web server.

Mitigation:

- implement preview-service as a thin adapter over existing assembly logic
- verify asset rewriting with policy tests

### Temporary dual-host complexity

For a while we will support:

- browser/server mode
- CLI mode
- Electron native-host mode

Mitigation:

- keep transport adapters thin
- keep shared core authoritative

### Renderer rewrite cost

A new Electron renderer is real product work.

Mitigation:

- reuse current UX structure
- migrate by feature area
- do not attempt a half-HTTP, half-IPC hybrid

---

## Why this is still worth it

If the product goal is "ship something working in Electron soon," the embedded-server plan is probably the faster choice.

If the product goal is "own a real desktop architecture that does not smuggle a localhost web app inside Electron," this native-host plan is the better foundation.

It asks us to do the harder systems work now:

- extract the reusable core
- define a real desktop IPC contract
- host preview natively
- separate product architecture from browser-era transport decisions

That is more effort, but it produces a cleaner desktop system and a clearer long-term boundary between:

- deck logic
- transport
- host environment

---

## Recommended next step

Use this file as the canonical native-host decision record and execution backlog.

Next:

1. keep `docs/electron-packaging-plan.md` as the fallback "fastest working shell" option
2. treat this file as the native-host source of truth for decision, sequencing, and ownership
3. start implementation at Phase 1 service extraction rather than jumping straight to Electron renderer work
