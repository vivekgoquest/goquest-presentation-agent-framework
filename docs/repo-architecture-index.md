# Repository Architecture Index

**Use this when:** you need to decide what to read before changing the repository.

**Read this after:** `AGENTS.md`, `README.md`.

**Do not confuse with:**
- `docs/base-canvas-contract.md` — canonical canvas ownership contract
- `docs/presentation-package-spec.md` — canonical project package model
- `docs/prd-human-agent.md` — product and operator requirements

**Key files:**
- `docs/repo-architecture-overview.md`
- `docs/repo-onboarding-reading-order.md`
- `docs/repo-change-impact-matrix.md`
- `docs/repo-call-flows.md`
- `docs/repo-action-trace-export-presentation.md`
- `docs/repo-trace-project-creation.md`
- `docs/repo-high-risk-files.md`

**Verification:** use the commands listed in `AGENTS.md` for the lane you change.

---

## What this index is for

This document is the fastest routing layer for AI agents working in the repository.

The repo already has strong contracts and product docs. This index helps answer a different question:

**Which architecture document should an agent read next for the task in front of it?**

## Start here every time

Read these first:

1. `AGENTS.md`
2. `README.md`
3. `docs/repo-architecture-overview.md`

Then choose the next document based on task type.

## Task-based reading map

### If you are new to the repository
Read:
1. `docs/repo-onboarding-reading-order.md`
2. `docs/repo-architecture-overview.md`
3. `docs/repo-call-flows.md`

### If you need to decide which files to edit
Read:
1. `docs/repo-change-impact-matrix.md`
2. `docs/repo-high-risk-files.md`

### If you need the call graph across layers
Read:
1. `docs/repo-call-flows.md`
2. `docs/repo-architecture-overview.md`

### If you are changing the Export presentation workflow
Read:
1. `docs/repo-action-trace-export-presentation.md`
2. `docs/repo-call-flows.md`
3. `docs/repo-high-risk-files.md`

### If you are changing project scaffolding or project activation
Read:
1. `docs/repo-trace-project-creation.md`
2. `docs/repo-change-impact-matrix.md`
3. `docs/repo-high-risk-files.md`

### If you are changing canvas, policy, or terminal behavior
Read:
1. `docs/repo-high-risk-files.md`
2. the canonical contract doc for that area:
   - `docs/base-canvas-contract.md`
   - `docs/presentation-package-spec.md`
   - `AGENTS.md`

## Canonical contract docs

These new repo docs do not replace the canonical contracts.

### Maintainer contract
- `AGENTS.md`

### Product summary
- `README.md`
- `START-HERE.md`

### Canvas and authoring boundaries
- `docs/base-canvas-contract.md`
- `project-agent/project-dot-claude/rules/framework.md`
- `project-agent/project-dot-claude/rules/authoring-rules.md`
- `project-agent/project-dot-claude/rules/file-boundaries.md`
- `project-agent/project-dot-claude/rules/slide-patterns.md`
- `project-agent/project-dot-claude/rules/tokens.md`

### Project package model
- `docs/presentation-package-spec.md`

### Operator and UX requirements
- `docs/prd-human-agent.md`

## Architecture map in one sentence

Think of the repo as:

- `electron/` = desktop shell
- `framework/application/` = workflow and routing layer
- `framework/runtime/` + `framework/client/` + `framework/templates/` = deterministic presentation engine
- `project-agent/` = scaffolded agent integration package

For a fuller summary, read `docs/repo-architecture-overview.md`.
