# Repository Architecture Index

**Use this when:** you need to decide what to read before changing the shell-less package.

**Read this after:** `AGENTS.md`, `README.md`, `START-HERE.md`.

**Do not confuse with:**
- `docs/repo-architecture-overview.md` — one-page architecture summary
- `docs/repo-call-flows.md` — execution paths through the CLI/core/runtime stack
- `docs/repo-trace-project-creation.md` — the detailed `presentation init` trace

**Key files:**
- `docs/repo-architecture-overview.md`
- `docs/repo-call-flows.md`
- `docs/repo-trace-project-creation.md`
- `docs/prd-human-agent.md`
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/presentation-core.mjs`
- `framework/runtime/services/scaffold-service.mjs`
- `framework/runtime/services/presentation-ops-service.mjs`

**Verification:** `npm test`, plus the smallest realistic CLI smoke for the lane you touch.

---

## What this index is for

This document is the fastest routing layer for maintainers.

It answers one question:

**Which docs and source files should I read next for the change in front of me?**

## Start here every time

Read these first:

1. `AGENTS.md`
2. `README.md`
3. `START-HERE.md`
4. `docs/repo-architecture-overview.md`

Then pick the next lane below.

## Task-based reading map

### If you are new to the repository
Read:
1. `docs/repo-architecture-overview.md`
2. `docs/repo-call-flows.md`
3. `docs/repo-trace-project-creation.md`
4. `docs/prd-human-agent.md`

### If you are changing the public CLI surface
Read:
1. `framework/runtime/presentation-cli.mjs`
2. `framework/runtime/presentation-core.mjs`
3. `framework/runtime/__tests__/presentation-cli.test.mjs`
4. `framework/runtime/__tests__/shellless-public-surface.test.mjs`

### If you are changing project scaffolding
Read:
1. `docs/repo-trace-project-creation.md`
2. `framework/runtime/services/scaffold-service.mjs`
3. `framework/runtime/deck-paths.js`
4. `framework/shared/project-claude-scaffold-package.mjs`
5. `framework/templates/*`
6. `project-agent/project-dot-claude/*`

### If you are changing package state or workflow status
Read:
1. `framework/runtime/presentation-package.js`
2. `framework/runtime/presentation-runtime-state.js`
3. `framework/runtime/project-state.js`
4. `framework/runtime/status-service.js`
5. `framework/runtime/__tests__/presentation-package.test.mjs`
6. `framework/runtime/__tests__/status-service.test.mjs`

### If you are changing audits or policy
Read:
1. `framework/runtime/deck-policy.js`
2. `framework/runtime/audit-service.js`
3. `docs/base-canvas-contract.md`
4. `framework/runtime/__tests__/deck-policy.test.mjs`

### If you are changing preview behavior
Read:
1. `docs/repo-call-flows.md`
2. `framework/runtime/preview-server.mjs`
3. `framework/runtime/runtime-app.js`
4. `framework/runtime/deck-assemble.js`
5. `framework/client/*`

### If you are changing export or finalize behavior
Read:
1. `docs/repo-call-flows.md`
2. `framework/runtime/services/presentation-ops-service.mjs`
3. `framework/runtime/pdf-export.js`
4. `framework/runtime/presentation-runtime-state.js`
5. `framework/runtime/__tests__/shellless-package-integration.test.mjs`

### If you are changing the scaffolded Claude adapter package
Read:
1. `framework/shared/project-claude-scaffold-package.mjs`
2. `project-agent/project-agents-md.md`
3. `project-agent/project-claude-md.md`
4. `project-agent/project-dot-claude/*`
5. `project-agent/__tests__/scaffold-package.test.mjs`

## Canonical docs for the current product

### Maintainer contract
- `AGENTS.md`

### Package surface and operator entrypoints
- `README.md`
- `START-HERE.md`
- `docs/prd-human-agent.md`

### Canvas and authoring boundaries
- `docs/base-canvas-contract.md`

### Shell-less package architecture
- `docs/repo-architecture-overview.md`
- `docs/repo-call-flows.md`
- `docs/repo-trace-project-creation.md`

## Architecture map in one sentence

Think of the repo as:

```text
presentation CLI -> runtime core -> package/state/policy/preview/export services -> project files
```

Project-local Claude assets are injected during `init`, not used as a separate runtime host.

## When in doubt

If a change feels cross-cutting, read in this order:

1. `framework/runtime/presentation-cli.mjs`
2. `framework/runtime/presentation-core.mjs`
3. `framework/runtime/project-state.js`
4. `framework/runtime/services/presentation-ops-service.mjs`
5. the closest test file in `framework/runtime/__tests__/`
