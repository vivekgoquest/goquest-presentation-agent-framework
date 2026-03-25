# Trace: Project Creation and Activation

**Use this when:** you need to understand or change how a new presentation project is created and loaded into the desktop app.

**Read this after:** `docs/repo-call-flows.md` and `docs/repo-architecture-overview.md`.

**Do not confuse with:**
- normal project opening flow for an already initialized project
- runtime deck assembly or finalize flow

**Key files:**
- `electron/renderer/app.js`
- `framework/application/project-query-service.mjs`
- `framework/application/project-scaffold-service.mjs`
- `framework/runtime/services/scaffold-service.mjs`
- `project-agent/scaffold-package.mjs`

**Verification:**
- `npm test`
- `npm run new -- --project /abs/path`
- `npm run check -- --project /abs/path`
- `npm run finalize -- --project /abs/path`

---

## What this flow is responsible for

Project creation is responsible for producing a complete, independent presentation project folder that contains:

- authored source files
- deterministic `.presentation/` package files
- project-local `AGENTS.md`
- project-local `.claude/` adapter files
- optional copied framework snapshot
- initial git history when available

It also activates the new project inside the Electron app.

## The full trace

## 1. The user starts project creation in the Electron UI

Primary file:
- `electron/renderer/app.js`

Entry points:
- toolbar New button
- welcome panel New button

The UI flow is:
1. choose a directory
2. read requested slide count from the UI
3. call `window.electron.project.create(...)`
4. start the terminal in the new project

## 2. The directory chooser runs

In the renderer:
- `choosePath()` asks the Electron bridge to choose a directory

In Electron main:
- `presentation:choose-directory` opens the native directory picker

The selected directory is returned to the renderer.

## 3. The renderer invokes project creation

Still in `electron/renderer/app.js`:
- `createProject()`
- `window.electron.project.create({ projectRoot: chosen, slideCount: n })`

The UI does not scaffold files directly.

## 4. The request reaches the worker host

Path:
- renderer bridge
- Electron main IPC
- `electron/worker/host.mjs`
- `framework/application/electron-request-service.mjs`

The request channel is:
- `project:create`

## 5. The project query service owns the create request

File:
- `framework/application/project-query-service.mjs`

Method:
- `createProject(payload = {})`

What it does:
1. normalize and validate the target folder path
2. validate slide count
3. resolve `copyFramework` flag if present
4. call `createProjectScaffold(...)`
5. mark the project as active
6. return meta, state, slides, and file tree

## 6. The framework-level scaffold orchestrator runs

File:
- `framework/application/project-scaffold-service.mjs`

Method:
- `createProjectScaffold(targetInput, options = {}, dependencies = {})`

What it does:
1. call the runtime scaffold service to create the presentation project files
2. call the project-agent scaffold package writer to add `AGENTS.md` and `.claude/`
3. initialize git history with an initial commit if git is available

This file is the join point between runtime scaffold files and agent scaffold files.

## 7. The runtime scaffold service builds the presentation project

File:
- `framework/runtime/services/scaffold-service.mjs`

Primary entry:
- `createPresentationScaffold(targetInput, options = {})`

High-level internal sequence:
1. build pending project paths
2. ensure the target directory exists and is empty
3. compute deck slug and title
4. compute slide plan
5. create directories and authored source files
6. create `.presentation/` files
7. optionally copy framework snapshot
8. create `.gitignore`
9. return scaffold result metadata

## 8. The slide plan is generated

Still in `scaffold-service.mjs`.

The slide plan logic:
- slide folders use sparse numbering: `010`, `020`, `030`, ...
- the first slide is scaffolded as intro
- the last slide is scaffolded as close
- interior slides use a generic slide template
- decks with more than 10 slides are treated as long decks and require outline support

This step determines the initial `slides/<NNN-id>/slide.html` files that will exist.

## 9. Authored source files are created

The runtime scaffold writes:
- `theme.css`
- `brief.md`
- `outline.md` if required
- `assets/.gitkeep`
- `outputs/.gitkeep`
- `slides/<NNN-id>/slide.html`
- `.gitignore`

Templates come from:
- `framework/templates/theme.css`
- `framework/templates/brief.md`
- `framework/templates/outline.md`
- `framework/templates/slides/*`

## 10. `.presentation/` files are created

The runtime scaffold also creates:
- `.presentation/project.json`
- `.presentation/intent.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/last-good.json`
- `.presentation/framework-cli.mjs`

This makes the project self-describing and runnable.

## 11. Linked or copied framework mode is recorded

The runtime scaffold writes project metadata with:
- `frameworkMode: linked` by default
- `frameworkMode: copied` if `--copy-framework` or equivalent is chosen

If copied mode is enabled, framework files are copied into:
- `.presentation/framework/base/`
- `.presentation/framework/overrides/`

Framework asset resolution later uses these locations before falling back to the shared framework source.

## 12. The project-agent scaffold package is written

File:
- `project-agent/scaffold-package.mjs`

This writes project-local agent files such as:
- `AGENTS.md`
- `.claude/settings.json`
- `.claude/CLAUDE.md`
- `.claude/hooks/*`
- `.claude/rules/*`
- `.claude/skills/*`

This is what gives each project its own AI-agent operating package.

## 13. Initial git history is created when possible

Back in:
- `framework/application/project-scaffold-service.mjs`

It attempts:
- `git init`
- `git add -A`
- `git commit -m "Scaffold: <slug>"`

If git is unavailable, project creation still succeeds.

## 14. The new project becomes the active project

Back in:
- `framework/application/project-query-service.mjs`

Method:
- `setActiveProject(projectRootAbs)`

What this does:
- create the active project target
- compute active project paths
- call the project-changed callback

## 15. Project activation updates terminal and file watch services

In the worker host:
- `onProjectChanged(...)` stops the current terminal session
- sets terminal project context
- points the watch service at the new project root
- emits project-changed and preview-changed events

This ensures the desktop app now points at the new project.

## 16. The renderer refreshes state and starts the shell

Back in `electron/renderer/app.js`:
- project panels are refreshed
- preview is loaded
- `startShellSession()` runs

The integrated terminal now starts in the new project directory.

## 17. Preview becomes available

Once the project is active, preview requests flow through:
- `project-query-service.getPreviewDocument()`
- `framework/runtime/deck-assemble.js`

That means even the very first preview depends on the same deterministic assembly and policy path as later validation and finalize actions.

## Resulting project shape

A newly created project contains:

### Authored source
- `brief.md`
- `theme.css`
- optional `outline.md`
- `slides/*/slide.html`
- assets and outputs dirs

### Package truth
- `.presentation/project.json`
- `.presentation/intent.json`
- `.presentation/package.generated.json`

### Runtime evidence placeholders
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/last-good.json`

### Project-local agent package
- `AGENTS.md`
- `.claude/*`

## What to change for common project-creation requests

### Change default brief/theme/slide templates
Edit:
- `framework/templates/*`

### Change file layout or generated package files
Edit:
- `framework/runtime/services/scaffold-service.mjs`
- `framework/runtime/presentation-package.js`
- related runtime state modules if needed

### Change project-local Claude scaffold contents
Edit:
- `project-agent/scaffold-package.mjs`
- `project-agent/project-agents-md.md`
- `project-agent/project-claude-md.md`
- `project-agent/project-dot-claude/*`

### Change activation behavior after creation
Edit:
- `framework/application/project-query-service.mjs`
- `electron/worker/host.mjs`
- possibly `electron/renderer/app.js`

## What not to do

- do not scaffold project files directly from the renderer
- do not make Electron own project package semantics
- do not split project truth between runtime and project-agent in inconsistent ways
- do not forget that scaffolded `.claude/` is adapter glue, not the project’s structural source of truth

## Minimal verification after changes in this flow

1. `npm test`
2. `npm run new -- --project /abs/path`
3. inspect generated project structure
4. `npm run check -- --project /abs/path`
5. `npm run finalize -- --project /abs/path`
