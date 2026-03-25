# Repository Change Impact Matrix

**Use this when:** you know what kind of change is requested and need to find the correct files, risks, and verification steps.

**Read this after:** `docs/repo-architecture-overview.md`.

**Do not confuse with:** `docs/repo-high-risk-files.md`, which focuses on sensitive files rather than task routing.

**Key files:** this document references the primary edit lanes for each change type.

**Verification:** each section lists the minimum recommended checks.

---

## How to use this matrix

For each requested change:

1. identify the closest change category below
2. read the listed files before editing
3. stay inside the listed lane unless the task explicitly requires escalation
4. run the listed verification before claiming success

## 1. Desktop UI or Electron UX change

Examples:
- toolbar button behavior
- welcome screen changes
- diagnostics drawer changes
- export modal UX
- toast behavior
- split-pane interactions

### Read first
- `electron/renderer/app.js`
- `electron/renderer/ui-model.js`
- `electron/main.mjs`
- `AGENTS.md`

### Primary edit lane
- `electron/renderer/*`
- `electron/main.mjs`
- `electron/preload.cjs`

### Avoid unless required
- `framework/runtime/services/*`
- `project-agent/*`

### Why
Electron owns UI and host integration only. It must not take ownership of presentation runtime logic or project-agent workflow semantics.

### Verify
- `npm test`
- manual `npm run start` smoke
- confirm UI action still routes correctly through the application layer

## 2. Add or change a named product action

Examples:
- new toolbar action
- new menu action
- new review/apply action
- changed action availability rules

### Read first
- `framework/application/action-service.mjs`
- `framework/application/presentation-action-adapter.mjs`
- `framework/application/electron-request-service.mjs`
- `electron/renderer/ui-model.js`

### Primary edit lane
- `framework/application/action-service.mjs`
- `framework/application/presentation-action-adapter.mjs`
- `electron/renderer/ui-model.js`
- `electron/renderer/app.js`

### Additional lane for agent-backed actions
- `project-agent/agent-capabilities.mjs`
- `project-agent/agent-launcher.mjs`

### Why
The application layer owns deterministic action definitions and routing.

### Verify
- `npm test`
- action-related tests
- manual invocation through the Electron UI if surfaced there

## 3. Change project scaffolding

Examples:
- add a scaffolded file
- change default theme/brief/outline contents
- change slide numbering defaults
- change copy-framework behavior
- change scaffolded `.claude/` package contents

### Read first
- `framework/runtime/services/scaffold-service.mjs`
- `framework/application/project-scaffold-service.mjs`
- `project-agent/scaffold-package.mjs`
- `docs/presentation-package-spec.md`

### Primary edit lane
- `framework/runtime/services/scaffold-service.mjs`
- `framework/templates/*`
- `project-agent/scaffold-package.mjs`
- `project-agent/project-agents-md.md`
- `project-agent/project-claude-md.md`
- `project-agent/project-dot-claude/*`

### Why
Scaffolding is split between runtime project files and project-agent adapter files.

### Verify
- `npm run new -- --project /abs/path`
- inspect generated project structure
- `npm run check -- --project /abs/path`
- `npm run finalize -- --project /abs/path`

## 4. Change preview assembly or runtime HTML composition

Examples:
- change generated slide wrappers
- inject new scripts or styles
- change asset rewriting
- change preview shell assumptions

### Read first
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-source.js`
- `framework/runtime/runtime-app.js`
- `framework/runtime/deck-policy.js`

### Primary edit lane
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-source.js`
- `framework/runtime/runtime-app.js`

### Why
Preview, validation, capture, export, and finalize all depend on this path.

### Verify
- `npm test`
- `npm run check -- --project /abs/path`
- manual preview in `npm run start`

## 5. Change authoring policy or package validation semantics

Examples:
- change forbidden CSS or HTML rules
- change asset path policy
- change long-deck outline requirement
- change package validation logic

### Read first
- `framework/runtime/deck-policy.js`
- `framework/runtime/project-state.js`
- `docs/base-canvas-contract.md`
- `docs/presentation-package-spec.md`

### Primary edit lane
- `framework/runtime/deck-policy.js`
- `framework/runtime/project-state.js`
- related docs that define the contract

### Protected area warning
This is a sensitive edit lane. `AGENTS.md` explicitly flags policy semantics as protected.

### Verify
- `npm test`
- scaffold a project and run `check`
- run `finalize` on a valid project

## 6. Change structural canvas behavior

Examples:
- slide dimensions
- stage ratio
- grid semantics
- reveal helper behavior
- structural stage tokens

### Read first
- `framework/canvas/canvas-contract.mjs`
- `framework/canvas/canvas.css`
- `docs/base-canvas-contract.md`
- `framework/runtime/deck-policy.js`

### Primary edit lane
- `framework/canvas/*`

### Protected area warning
This is one of the most sensitive areas in the repo. It affects every linked project.

### Verify
- `npm test`
- `npm run check -- --project /abs/path`
- `npm run finalize -- --project /abs/path`
- inspect rendered output artifacts

## 7. Change browser-side slide behavior

Examples:
- keyboard navigation logic
- in-preview dot navigation
- counter behavior
- animation and reveal handling

### Read first
- `framework/client/nav.js`
- `framework/client/counter.js`
- `framework/client/animations.js`
- `framework/runtime/deck-assemble.js`

### Primary edit lane
- `framework/client/*`

### Why
The browser runtime behavior is owned by `framework/client/`, not Electron.

### Verify
- `npm test`
- manual preview navigation in Electron
- `check` and `finalize` for stability

## 8. Change capture, export, or finalize behavior

Examples:
- screenshot behavior
- report shape
- PDF export behavior
- finalize output writing
- runtime evidence writing

### Read first
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/pdf-export.js`
- `framework/runtime/presentation-runtime-state.js`

### Primary edit lane
- `framework/runtime/services/presentation-ops-service.mjs`
- related runtime helper files

### Why
This lane owns deterministic output generation and evidence persistence.

### Verify
- `npm test`
- `npm run check -- --project /abs/path`
- `npm run finalize -- --project /abs/path`
- inspect `outputs/` and `.presentation/runtime/*.json`

## 9. Change project/package state files or schemas

Examples:
- add intent fields
- change generated manifest shape
- change runtime evidence JSON shape

### Read first
- `framework/runtime/presentation-intent.js`
- `framework/runtime/presentation-package.js`
- `framework/runtime/presentation-runtime-state.js`
- `docs/presentation-package-spec.md`

### Primary edit lane
- the corresponding runtime state modules
- spec docs that define the contract

### Why
These files define durable project truth, not just transient behavior.

### Verify
- scaffold a new project
- open an existing project
- run `check` and `finalize`
- inspect `.presentation/*.json`

## 10. Change terminal behavior

Examples:
- shell startup behavior
- resize behavior
- terminal lifecycle
- project context switching

### Read first
- `framework/runtime/terminal-core.mjs`
- `electron/worker/terminal-service.mjs`
- `AGENTS.md`

### Primary edit lane
- `framework/runtime/terminal-core.mjs`
- `electron/worker/terminal-service.mjs`

### Protected area warning
Terminal lifecycle guarantees are explicitly protected in `AGENTS.md`.

### Verify
- `npm test`
- manual shell start/stop/restart
- manual project switching in Electron

## 11. Change file watching or preview refresh behavior

Examples:
- debounce timing
- ignored paths
- watch roots
- refresh triggers

### Read first
- `electron/worker/watch-service.mjs`
- `electron/worker/host.mjs`
- `electron/renderer/app.js`

### Primary edit lane
- `electron/worker/watch-service.mjs`
- related worker/renderer integration files

### Verify
- edit `theme.css`
- edit a slide
- add or remove a slide folder
- confirm preview refreshes only when expected

## 12. Change project-local Claude scaffolding or agent capabilities

Examples:
- add a new skill
- change launcher prompt composition
- change project-local `AGENTS.md` or `.claude/` scaffold content

### Read first
- `project-agent/agent-capabilities.mjs`
- `project-agent/agent-launcher.mjs`
- `project-agent/scaffold-package.mjs`
- `framework/application/action-service.mjs`

### Primary edit lane
- `project-agent/*`
- action registration in `framework/application/action-service.mjs` if needed

### Why
The agent layer owns vendor-specific execution details, but the application layer still owns the workflow semantics.

### Verify
- `npm test`
- scaffold a fresh project and inspect `AGENTS.md` and `.claude/`
- manually invoke affected action if available

## Final check before editing

Before changing anything, answer these four questions:

1. Which domain owns the behavior I am changing?
2. Is this a protected area named in `AGENTS.md`?
3. What is the minimum verification for this lane?
4. Am I accidentally bypassing the application layer or the package/runtime ownership model?
