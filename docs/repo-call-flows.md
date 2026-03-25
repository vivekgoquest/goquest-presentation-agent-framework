# Repository Call Flows

**Use this when:** you need a maintainer mental model of what calls what across the repository.

**Read this after:** `docs/repo-architecture-overview.md`.

**Do not confuse with:**
- `docs/repo-action-trace-export-presentation.md` — one specific action trace
- `docs/repo-trace-project-creation.md` — one specific scaffold trace

**Key files:**
- `electron/main.mjs`
- `electron/worker/host.mjs`
- `framework/application/electron-request-service.mjs`
- `framework/application/action-service.mjs`
- `framework/application/project-query-service.mjs`
- `framework/runtime/deck-assemble.js`
- `framework/runtime/services/presentation-ops-service.mjs`
- `project-agent/agent-launcher.mjs`

**Verification:** use this doc to find the right files, then run lane-specific verification from `docs/repo-change-impact-matrix.md`.

---

## One-line mental model

The stack is:

```text
Renderer UI -> Electron main -> worker host -> application service -> runtime or agent adapter -> project state / outputs / events -> back to UI
```

## Flow 1: UI request path

This is the default path for most user-triggered operations in the desktop app.

```text
electron/renderer/app.js
  -> window.electron.* bridge from preload
  -> electron/main.mjs ipc handler
  -> electron/worker/host.mjs handleRequest
  -> framework/application/electron-request-service.mjs
  -> either:
       a) framework/application/project-query-service.mjs
       b) framework/application/action-service.mjs
       c) terminal service methods
```

### Why it matters
The renderer should not invent product logic. It should ask the application layer to do named things.

## Flow 2: Project query path

Used for:
- open project
- create project
- get project meta
- get project state
- get file tree
- get slides
- get preview document

```text
renderer request
  -> main ipc
  -> worker host
  -> electron-request-service
  -> project-query-service
       -> project-state
       -> presentation-package ensure/read
       -> deck-assemble for preview
       -> project-tree builder
```

Key files:
- `framework/application/project-query-service.mjs`
- `framework/runtime/project-state.js`
- `framework/runtime/presentation-package.js`
- `framework/runtime/deck-assemble.js`

## Flow 3: Named product action path

Used for actions like:
- Export presentation
- Validate presentation
- Capture screenshots
- Review visuals
- Apply narrative fixes

```text
renderer button/menu click
  -> app.js runProductAction(...)
  -> action invoke bridge
  -> main ipc
  -> worker host
  -> electron-request-service ACTION_INVOKE
  -> framework/application/action-service.mjs
       -> action availability check
       -> workflow lookup
       -> lifecycle events emitted
       -> one of:
            a) presentation-action-adapter
            b) agent-action-adapter
```

### Important consequence
If a new named action is needed, start in `framework/application/action-service.mjs`, not in the renderer.

## Flow 4: Presentation runtime action path

Used for:
- `export_presentation`
- `export_presentation_artifacts`
- `validate_presentation`
- `capture_screenshots`

```text
action-service
  -> createActionWorkflowService(...)
  -> invokePresentationWorkflow(...)
  -> presentation-action-adapter
  -> framework/runtime/services/presentation-ops-service.mjs
       -> deck assembly
       -> runtime app / Playwright / PDF export
       -> runtime evidence writes
```

Key files:
- `framework/application/presentation-action-adapter.mjs`
- `framework/runtime/services/presentation-ops-service.mjs`

## Flow 5: Agent action path

Used for:
- fix validation issues
- review visuals
- apply visual fixes
- review narrative
- apply narrative fixes

```text
action-service
  -> createActionWorkflowService(...)
  -> invokeAgentWorkflow / invokeReviewWorkflow / invokeApplyReviewWorkflow
  -> application-prepared workflow prompt and truth context
  -> agent-action-adapter
  -> project-agent/agent-launcher.mjs
  -> Claude CLI process
```

### Important consequence
The launcher does not define the product workflow meaning. The application layer prepares the workflow and the launcher executes it.

## Flow 6: Preview assembly path

This is the shared path behind preview, validation, capture, export, and finalize.

```text
project target
  -> framework/runtime/presentation-package.js ensure files
  -> framework/runtime/deck-policy.js validate authored workspace
  -> framework/runtime/deck-source.js list valid slide folders
  -> framework/runtime/deck-assemble.js build virtual deck HTML
  -> served by either:
       a) Electron custom protocol
       b) runtime Express server
```

### Why it matters
If preview assembly changes, many downstream workflows change too.

## Flow 7: Electron preview document path

```text
preview iframe src = presentation://preview/current
  -> electron/main.mjs protocol.handle('presentation')
  -> worker invoke('preview:getDocument')
  -> project-query-service.getPreviewDocument()
  -> deck-assemble.js renderPresentationHtml(...)
  -> HTML returned to Electron
```

Project assets and framework assets then flow through:
- `presentation://project-files/...`
- `presentation://project-framework/...`

## Flow 8: Runtime server path for check/capture/export/finalize

```text
presentation-ops-service capture/validate/finalize
  -> withRuntimeServer(...)
  -> framework/runtime/runtime-app.js Express server
  -> /preview/
  -> renderPresentationHtml(...)
  -> Playwright visits the preview URL
  -> capture/report/export operations run on that served document
```

### Why it matters
The repository has two delivery surfaces for preview HTML:
- Electron protocol delivery
- runtime Express delivery

Both depend on the same assembly logic.

## Flow 9: File change and preview refresh path

```text
file save
  -> electron/worker/watch-service.mjs detects change
  -> worker host emits watch/project/preview events
  -> renderer app listens
  -> preview iframe refreshed
  -> project panels refreshed
```

This is how external file edits propagate into the desktop app.

## Flow 10: Terminal path

```text
renderer terminal UI
  -> preload bridge
  -> worker host terminal channels
  -> electron/worker/terminal-service.mjs
  -> framework/runtime/terminal-core.mjs
       -> node-pty or python pty bridge
```

### Important consequence
Terminal vendor logic must not leak into `framework/runtime/terminal-core.mjs`.

## Flow 11: Stop-hook path

Scaffolded project local hook wrapper:
- `project-agent/project-dot-claude/hooks/run-presentation-stop-workflow.mjs`

Delegates to framework-owned workflow:

```text
project-local hook wrapper
  -> load frameworkSource from .presentation/project.json
  -> import framework/application/project-hook-service.mjs
  -> runProjectStopHookWorkflow(projectRoot)
       -> ensure package files
       -> validate intent
       -> run validate action in hook mode
       -> maybe checkpoint git
```

### Important consequence
Project-local hooks are wrapper entrypoints only. The framework owns the actual workflow logic.

## Flow 12: Project scaffolding path

High level:

```text
project create request
  -> project-query-service.createProject(...)
  -> project-scaffold-service.createProjectScaffold(...)
       -> runtime scaffold-service.createPresentationScaffold(...)
       -> project-agent scaffold-package.writeProjectAgentScaffoldPackage(...)
       -> initialize project git history
  -> set active project
  -> emit project and preview changed events
```

For the detailed trace, read `docs/repo-trace-project-creation.md`.

## Fast file-routing map by flow

### If the bug is in action routing
Read:
- `framework/application/action-service.mjs`
- `framework/application/electron-request-service.mjs`
- `electron/worker/host.mjs`

### If the bug is in preview rendering
Read:
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-policy.js`
- `framework/runtime/runtime-app.js`
- `electron/main.mjs`

### If the bug is in agent workflow launch
Read:
- `framework/application/action-service.mjs`
- `project-agent/agent-launcher.mjs`
- `project-agent/agent-capabilities.mjs`

### If the bug is in terminal behavior
Read:
- `electron/worker/terminal-service.mjs`
- `framework/runtime/terminal-core.mjs`

## What not to bypass

Do not bypass these layers:

- do not bypass the application layer from the renderer for named product actions
- do not bypass runtime policy when changing preview assembly assumptions
- do not bypass package/runtime ownership by hand-editing generated JSON files
- do not bypass application-prepared workflow context by letting launcher semantics drift
