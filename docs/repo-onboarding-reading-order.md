# Repository Onboarding Reading Order

**Use this when:** you are new to the repository or returning after enough time that you need to reload the mental model.

**Read this after:** `AGENTS.md`.

**Do not confuse with:** `docs/repo-architecture-index.md`, which is the task-routing layer rather than the learning path.

**Key files:** listed below in order.

**Verification:** after reading, you should be able to explain the four domains, the package model, and the main action flow.

---

## Goal of this reading order

This order is optimized for AI agents. It is designed to answer questions in the right sequence:

1. what the repository is trying to protect
2. what the product does
3. what a scaffolded project looks like
4. how runtime and application layers divide responsibility
5. where implementation changes belong

## Stage 1: repository contract and product summary

### 1. `AGENTS.md`
Read first.

Why it matters:
- defines maintainer mission
- defines the four-domain architecture
- defines allowed and forbidden dependency directions
- lists protected areas
- lists the verification baseline

Do not proceed with framework edits before understanding this file.

### 2. `README.md`
Read second.

Why it matters:
- gives the product summary
- lists supported commands
- shows the scaffolded project structure
- explains the package model at a high level

### 3. `START-HERE.md`
Read third.

Why it matters:
- gives the operator workflow the product expects
- confirms that Electron is the interactive path
- reinforces that `.claude/` is adapter glue, not source truth

## Stage 2: canonical contracts

### 4. `docs/base-canvas-contract.md`
Read next.

Why it matters:
- explains the `content < theme < canvas` ownership model
- identifies protected structural primitives
- explains what theme may and may not do
- explains what content may and may not do
- shows that runtime policy enforces these rules

### 5. `docs/presentation-package-spec.md`
Read next.

Why it matters:
- explains the canonical scaffolded project package structure
- distinguishes authored source from generated structure and runtime evidence
- explains why `.presentation/` exists
- explains which files are agent-editable vs runtime-owned

### 6. `docs/prd-human-agent.md`
Read next.

Why it matters:
- gives the operator persona and workflow
- defines success criteria for the product
- explains how preview, validation, export, and AI collaboration are meant to feel

## Stage 3: project-level authoring contracts

These files live in the scaffold source, but they define what every project-local Claude package is supposed to teach the agent.

### 7. `project-agent/project-dot-claude/rules/framework.md`
Why it matters:
- restates core ownership and package truth for deck work

### 8. `project-agent/project-dot-claude/rules/authoring-rules.md`
Why it matters:
- spells out allowed and forbidden authoring patterns
- clarifies verification workflow

### 9. `project-agent/project-dot-claude/rules/file-boundaries.md`
Why it matters:
- clarifies deck-editable vs framework-protected areas

### 10. `project-agent/project-dot-claude/rules/slide-patterns.md`
Why it matters:
- explains slide source model and structural primitives

### 11. `project-agent/project-dot-claude/rules/tokens.md`
Why it matters:
- explains theme tokens vs canvas tokens and escalation rules

## Stage 4: executable surface

### 12. `package.json`
Why it matters:
- shows actual public scripts
- confirms desktop entrypoint and project-only CLI commands

## Stage 5: implementation entrypoints

### 13. `electron/main.mjs`
Why it matters:
- shows Electron host wiring
- shows protocol registration and worker process startup

### 14. `framework/application/action-service.mjs`
Why it matters:
- is the product action brain
- defines named actions, lifecycle, workflow metadata, and routing

### 15. `framework/application/project-query-service.mjs`
Why it matters:
- explains project creation, opening, state querying, slide listing, and preview assembly entry

### 16. `framework/runtime/deck-assemble.js`
Why it matters:
- shows how authored fragments become full preview HTML

### 17. `framework/runtime/deck-policy.js`
Why it matters:
- shows what the framework truly enforces at runtime

### 18. `framework/runtime/services/presentation-ops-service.mjs`
Why it matters:
- shows validate, capture, export, and finalize end to end

## Stage 6: follow-up operational docs

After the reading above, use these targeted docs depending on the task.

### If you need file-routing help
Read:
- `docs/repo-change-impact-matrix.md`

### If you need the cross-layer call graph
Read:
- `docs/repo-call-flows.md`

### If you need to trace Export presentation
Read:
- `docs/repo-action-trace-export-presentation.md`

### If you need to trace project creation
Read:
- `docs/repo-trace-project-creation.md`

### If you need to know what not to touch lightly
Read:
- `docs/repo-high-risk-files.md`

## Minimal fast path

If you do not have time for the full sequence, the minimum safe path is:

1. `AGENTS.md`
2. `README.md`
3. `docs/base-canvas-contract.md`
4. `docs/presentation-package-spec.md`
5. `framework/application/action-service.mjs`
6. `framework/runtime/deck-assemble.js`
7. `framework/runtime/deck-policy.js`

## What you should be able to explain after finishing

You should be able to answer all of these correctly:

- What are the four architectural domains?
- Which import directions are forbidden?
- What is the difference between source, intent, generated package structure, and runtime evidence?
- Why is `.presentation/package.generated.json` read-only to agents?
- Why does Electron call the application layer instead of runtime services directly?
- Which files own preview assembly, policy, export, and scaffolding?
