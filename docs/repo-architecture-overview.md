# Repository Architecture Overview

**Use this when:** you need a one-page mental model of the repository before editing anything.

**Read this after:** `AGENTS.md`, `README.md`.

**Do not confuse with:**
- `docs/base-canvas-contract.md` — structural canvas contract
- `docs/presentation-package-spec.md` — scaffolded project package contract

**Key files:**
- `electron/main.mjs`
- `framework/application/action-service.mjs`
- `framework/application/project-query-service.mjs`
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-policy.js`
- `framework/runtime/services/presentation-ops-service.mjs`
- `project-agent/agent-launcher.mjs`

**Verification:** `npm test`, plus project lifecycle smoke commands from `AGENTS.md`.

---

## What this repository is

This repository is the **framework product**, not a single presentation project.

It provides:

- an Electron desktop app
- project-folder scaffolding
- deterministic preview, validation, capture, export, and finalize workflows
- a scaffolded `.claude/` and `AGENTS.md` package for presentation projects

The product is built around independent presentation projects created with:

```bash
npm run new -- --project /abs/path
```

## The four architectural domains

### 1. Electron shell — `electron/`

This domain owns desktop UI and host integration.

It is responsible for:
- window creation
- protocol handling
- renderer UI
- terminal pane integration
- file-watch event delivery into the UI

It must not own runtime service logic or project-agent workflow logic directly.

Important files:
- `electron/main.mjs`
- `electron/renderer/app.js`
- `electron/renderer/ui-model.js`
- `electron/worker/host.mjs`
- `electron/worker/terminal-service.mjs`
- `electron/worker/watch-service.mjs`

### 2. Application layer — `framework/application/`

This domain owns product actions, workflow routing, project queries, and hook orchestration.

It is the only Electron-facing execution layer for named actions.

It is responsible for:
- action definitions and availability
- Electron request routing
- project creation and opening
- hook workflows and git checkpoint policy
- bridging UI actions to runtime actions or agent actions

Important files:
- `framework/application/action-service.mjs`
- `framework/application/project-query-service.mjs`
- `framework/application/presentation-action-adapter.mjs`
- `framework/application/project-scaffold-service.mjs`
- `framework/application/project-hook-service.mjs`
- `framework/application/electron-request-service.mjs`

### 3. Presentation runtime — `framework/runtime/`, `framework/client/`, `framework/templates/`

This domain owns the deterministic presentation engine.

It is responsible for:
- assembling authored slide source into runtime HTML
- validating authored source and rendered behavior
- capture, export, and finalize workflows
- package and runtime state files in `.presentation/`
- browser-side deck behavior such as navigation and counters
- scaffold templates for new projects

Important files:
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-policy.js`
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/presentation-package.js`
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/project-state.js`
- `framework/client/nav.js`
- `framework/client/counter.js`
- `framework/templates/*`

### 4. Agent layer — `project-agent/`

This domain owns agent-specific scaffolding and launcher behavior.

It is responsible for:
- agent capability definitions
- launcher prompt construction
- project-local `AGENTS.md` scaffold content
- project-local `.claude/` rules, skills, hooks, and settings

Important files:
- `project-agent/agent-capabilities.mjs`
- `project-agent/agent-launcher.mjs`
- `project-agent/scaffold-package.mjs`
- `project-agent/project-agents-md.md`
- `project-agent/project-claude-md.md`
- `project-agent/project-dot-claude/*`

## Dependency direction

The allowed dependency direction is:

```text
electron -> framework/application
framework/application -> framework/runtime
framework/application -> project-agent
electron/worker/terminal-service -> framework/runtime/terminal-core
```

The forbidden dependency direction is:

```text
electron -> framework/runtime/services/*
electron -> project-agent/*
framework/runtime -> electron
framework/runtime -> project-agent
framework/runtime/terminal-core -> vendor agent launch logic
```

Boundary tests in `framework/application/__tests__/boundary-contract.test.mjs` enforce these rules.

## The core project model

The framework assumes that each presentation is a standalone project folder.

A scaffolded project contains six lanes:

1. authored source
2. stable package identity
3. editable authoring intent
4. deterministic generated structure
5. deterministic runtime evidence
6. git-backed history

The ownership model is:

- authored source is editable
- `.presentation/intent.json` is editable
- `.presentation/package.generated.json` is deterministic structure
- `.presentation/runtime/*.json` is deterministic runtime evidence
- git is the history lane

For canonical details, read `docs/presentation-package-spec.md`.

## The CSS ownership model

The framework uses the ownership model:

```text
content < theme < canvas
```

Interpretation:
- `canvas` owns structural primitives and stage behavior
- `theme` owns deck-level visual identity
- `content` owns slide-local markup and optional slide-scoped CSS

This is enforced by runtime policy, not just by guidance.

For canonical details, read `docs/base-canvas-contract.md`.

## High-level execution model

### Desktop actions
The Electron app never directly runs runtime services or agent logic.

Instead it:
1. sends a request to the worker
2. the worker routes it to the application layer
3. the application layer invokes either:
   - a presentation runtime operation
   - an agent capability via the launcher

### Preview and runtime operations
Preview, validation, capture, export, and finalize all depend on the same deterministic presentation assembly path.

The key sequence is:
1. project source is read
2. package files are ensured or regenerated
3. deck policy is enforced
4. deck HTML is assembled
5. runtime server or Electron protocol serves preview HTML
6. Playwright or PDF generation operates on that assembled result

### Agent actions
Agent actions do not originate in `project-agent/` alone.

The application layer prepares the workflow context and then asks the project-agent launcher to start the correct capability. The launcher is an execution helper, not the owner of the product workflow semantics.

## Fast routing guide

If the task is about:

- desktop UI → start in `electron/`
- action definitions or routing → start in `framework/application/action-service.mjs`
- deck assembly or policy → start in `framework/runtime/`
- structural stage semantics → start in `framework/canvas/`
- scaffold defaults → start in `framework/templates/` and `project-agent/`
- project-local Claude adapter behavior → start in `project-agent/`

## Read next

- For a guided reading path: `docs/repo-onboarding-reading-order.md`
- For deciding edit lanes: `docs/repo-change-impact-matrix.md`
- For the cross-layer call graph: `docs/repo-call-flows.md`
