# Repository Architecture Overview

**Use this when:** you need a one-page mental model of the current repository before editing.

**Read this after:** `AGENTS.md`, `README.md`, `START-HERE.md`.

**Do not confuse with:**
- `docs/base-canvas-contract.md` — the canvas ownership contract
- `docs/repo-call-flows.md` — command-by-command execution paths
- `docs/repo-trace-project-creation.md` — the detailed `presentation init` trace

**Key files:**
- `package.json`
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/presentation-core.mjs`
- `framework/runtime/services/scaffold-service.mjs`
- `framework/runtime/project-state.js`
- `framework/runtime/presentation-package.js`
- `framework/runtime/preview-server.mjs`
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/shared/project-claude-scaffold-package.mjs`

**Verification:** `npm test`, plus an init/status/preview/finalize smoke when you change package behavior.

---

## What this repository is

This repository is the framework product for a shell-less presentation package.

The public surface is:

- the installed `presentation` CLI
- the generated project-local shim at `.presentation/framework-cli.mjs`
- deterministic project/package state under `.presentation/`
- scaffolded Claude adapter assets under `.claude/`

The repository does **not** ship a separate host shell anymore. The package itself is the product.

## The current architectural shape

Think about the repo in four layers.

### 1. Public package surface

Files:
- `package.json`
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/presentation-core.mjs`

Responsibilities:
- define the public `presentation` bin
- parse command families and flags
- format text/JSON envelopes
- dispatch to the runtime core
- preserve the shell-less contract for `init`, `inspect`, `status`, `audit`, `preview`, `export`, and `finalize`

This layer should stay thin. It owns command shape and output shape, not deck semantics.

### 2. Project model and state

Files:
- `framework/runtime/deck-paths.js`
- `framework/runtime/presentation-package.js`
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/project-state.js`
- `framework/runtime/status-service.js`

Responsibilities:
- define what a valid project looks like
- resolve root, hidden, and artifact paths
- regenerate deterministic package structure
- read and write runtime evidence
- classify workflow state such as `onboarding`, `authoring`, `blocked`, `ready_for_finalize`, and `finalized`

This layer is the source of truth for package semantics.

### 3. Runtime engine

Files:
- `framework/runtime/deck-assemble.js`
- `framework/runtime/deck-policy.js`
- `framework/runtime/audit-service.js`
- `framework/runtime/preview-server.mjs`
- `framework/runtime/runtime-app.js`
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/client/*`
- `framework/canvas/*`

Responsibilities:
- enforce authoring policy
- assemble authored source into preview HTML
- serve previews
- capture rendered slides
- export PDFs and screenshots
- refresh `.presentation/runtime/*.json`
- preserve the `content < theme < canvas` ownership contract

This layer owns the deterministic delivery pipeline.

### 4. Scaffold sources

Files:
- `framework/runtime/services/scaffold-service.mjs`
- `framework/templates/*`
- `framework/shared/project-claude-scaffold-package.mjs`
- `project-agent/*`

Responsibilities:
- create new project folders
- write initial authored files
- write `.presentation/` metadata, intent, generated structure, and runtime-state placeholders
- write `.presentation/framework-cli.mjs`
- scaffold `.claude/AGENTS.md`, `.claude/CLAUDE.md`, hooks, rules, skills, and settings
- optionally vendor a framework snapshot under `.presentation/framework/`

`project-agent/` is scaffold source, not a live runtime shell.

## High-level dependency direction

The current dependency direction is simple:

```text
presentation CLI -> runtime core -> package/state/runtime services
runtime scaffold service -> templates + shared Claude scaffold package
shared Claude scaffold package -> project-agent scaffold source files
```

The important negative rule is:

```text
Runtime package behavior must not depend on an extra host shell or router layer.
```

## The project model the package creates

A scaffolded project separates four concerns:

1. authored source at the root
2. hidden package machinery in `.presentation/`
3. project-local Claude adapter files in `.claude/`
4. the canonical delivered PDF at the project root after export/finalize

In practice that means:

- `brief.md`, `theme.css`, `slides/`, and `assets/` are the authored workspace
- `.presentation/intent.json` is authorable package intent
- `.presentation/package.generated.json` is deterministic structure
- `.presentation/runtime/render-state.json` and `.presentation/runtime/artifacts.json` are deterministic runtime evidence
- `.presentation/framework-cli.mjs` is the project-local entrypoint into the installed package
- `.claude/` is helper scaffolding, not structural deck truth

## The shared delivery path

Preview, export, and finalize all share the same core path:

1. read project source
2. ensure package files exist and generated structure is current
3. enforce deck policy
4. assemble deck HTML
5. either serve that HTML for preview or render it through capture/export flows
6. write runtime evidence back to `.presentation/runtime/*.json`

Because of that shared path, changes in policy or assembly can affect every major command family.

## Fast routing guide

If the task is about:

- CLI flags or envelopes → start in `framework/runtime/presentation-cli.mjs`
- command semantics or mutation boundaries → start in `framework/runtime/presentation-core.mjs`
- project shape or init behavior → start in `framework/runtime/services/scaffold-service.mjs`
- hidden package files or workflow state → start in `framework/runtime/presentation-package.js`, `presentation-runtime-state.js`, and `project-state.js`
- policy and audits → start in `framework/runtime/deck-policy.js` and `framework/runtime/audit-service.js`
- preview serving → start in `framework/runtime/preview-server.mjs` and `framework/runtime/runtime-app.js`
- PDF/screenshot delivery → start in `framework/runtime/services/presentation-ops-service.mjs`
- scaffolded Claude assets → start in `framework/shared/project-claude-scaffold-package.mjs` and `project-agent/`

## Read next

- `docs/repo-architecture-index.md`
- `docs/repo-call-flows.md`
- `docs/repo-trace-project-creation.md`
- `docs/prd-human-agent.md`
