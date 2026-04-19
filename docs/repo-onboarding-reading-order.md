# Repository Onboarding Reading Order

**Use this when:** you are new to the repository or returning after enough time that you need to reload the current shell-less mental model.

**Read this after:** `AGENTS.md`.

**Do not confuse with:** `docs/repo-architecture-index.md`, which is the task-routing layer rather than the learning path.

**Key outcome:** after reading, you should be able to explain the public CLI surface, the `.presentation/` state model, the `.claude/` scaffold source model, and the preview/export/finalize path.

---

## Goal of this reading order

This order is optimized for maintainers and coding agents.

It is meant to answer these questions in the right sequence:

1. what the repository is trying to protect
2. what the shipped product is
3. what a scaffolded project contains
4. which files define package truth and runtime evidence
5. where implementation changes belong in the shell-less repo

## Stage 1: repository contract and product summary

### 1. `AGENTS.md`
Read first.

Why it matters:
- defines the maintainer contract
- names the protected areas
- defines the current repository shape
- gives the required verification baseline
- states the current public entrypoints:
  - `presentation ...`
  - `node framework/runtime/presentation-cli.mjs ...`
  - `node .presentation/framework-cli.mjs ...`

Do not proceed with framework edits before understanding this file.

### 2. `README.md`
Read second.

Why it matters:
- gives the product summary
- shows the supported command families
- shows the scaffolded project structure
- explains the root-PDF delivery model and the `.presentation/` state model

### 3. `START-HERE.md`
Read third.

Why it matters:
- shows the operator workflow the product expects
- reinforces the shell-less CLI-first entrypoints
- shows how source-checkout usage differs from project-local shim usage

## Stage 2: canonical contracts

### 4. `docs/repo-architecture-overview.md`
Read next.

Why it matters:
- gives the current one-page architecture summary
- names the runtime, package/state, scaffold, and canvas/browser lanes
- explains the dependency direction after the shell/application cleanup

### 5. `docs/base-canvas-contract.md`
Read next.

Why it matters:
- explains the `content < theme < canvas` ownership model
- identifies protected structural primitives
- shows what runtime policy actually enforces

### 6. `docs/presentation-package-spec.md`
Read next.

Why it matters:
- explains the canonical project package structure
- distinguishes authored source from generated structure and runtime evidence
- explains which files are agent-editable vs runtime-owned

### 7. `docs/prd-human-agent.md`
Read next.

Why it matters:
- gives the operator persona and workflow expectations
- defines what preview, audit, export, and finalize are supposed to feel like
- explains the human + scaffolded-agent collaboration model

## Stage 3: scaffolded authoring contracts

These files live in the scaffold source, but they define what every generated project-local Claude packet teaches.

### 8. `project-agent/project-agents-md.md`
Why it matters:
- defines the project contract agents read first inside a scaffolded project
- lists the current `.presentation/` truth files:
  - `project.json`
  - `intent.json`
  - `package.generated.json`
  - `runtime/render-state.json`
  - `runtime/artifacts.json`

### 9. `project-agent/project-claude-md.md`
Why it matters:
- explains what `.claude/` is and what it is not
- reinforces that `.claude/` is helper scaffolding, not package truth

### 10. `project-agent/project-dot-claude/rules/framework.md`
Why it matters:
- restates framework-vs-deck ownership for scaffolded projects

### 11. `project-agent/project-dot-claude/rules/authoring-rules.md`
Why it matters:
- spells out allowed and forbidden authoring patterns
- clarifies project-local verification workflow

### 12. `project-agent/project-dot-claude/rules/file-boundaries.md`
Why it matters:
- clarifies deck-editable vs runtime-owned files
- shows the current read-only `.presentation/runtime/*.json` boundary

### 13. `project-agent/project-dot-claude/rules/slide-patterns.md`
Why it matters:
- explains the slide source model and structural primitives

### 14. `project-agent/project-dot-claude/rules/tokens.md`
Why it matters:
- explains theme tokens vs canvas tokens and escalation rules

## Stage 4: executable package surface

### 15. `package.json`
Why it matters:
- shows the real public bin
- shows the current scripts baseline (`setup`, `test`)
- confirms stale shell-era scripts are gone

### 16. `framework/runtime/presentation-cli.mjs`
Why it matters:
- defines the public command families and argument parsing
- owns CLI envelopes and exit codes

### 17. `framework/runtime/presentation-core.mjs`
Why it matters:
- defines command semantics beneath the CLI
- preserves the mutation boundary between authored source and runtime-owned state

## Stage 5: state and runtime entrypoints

### 18. `framework/runtime/deck-paths.js`
Why it matters:
- defines project path resolution
- defines the shell-less project layout and root-PDF location
- is the first place to read when project shape or help text feels wrong

### 19. `framework/runtime/presentation-package.js`
Why it matters:
- regenerates deterministic package structure
- owns the generated manifest boundary

### 20. `framework/runtime/presentation-runtime-state.js`
Why it matters:
- defines runtime evidence files
- owns `render-state.json` and `artifacts.json`

### 21. `framework/runtime/project-state.js`
Why it matters:
- classifies workflow state such as `onboarding`, `authoring`, `blocked`, `ready_for_finalize`, and `finalized`

### 22. `framework/runtime/deck-policy.js`
Why it matters:
- shows what the framework truly enforces at runtime
- is explicitly protected in `AGENTS.md`

### 23. `framework/runtime/deck-assemble.js`
Why it matters:
- shows how authored fragments become assembled preview HTML

### 24. `framework/runtime/preview-server.mjs`
Why it matters:
- owns the preview serving path for `preview serve|open`

### 25. `framework/runtime/services/presentation-ops-service.mjs`
Why it matters:
- owns validation, capture, PDF export, and finalize behavior
- writes runtime evidence and the canonical root PDF

### 26. `framework/runtime/services/scaffold-service.mjs`
Why it matters:
- owns `presentation init`
- creates the authored workspace, `.presentation/`, `.claude/`, and git repo

### 27. `framework/shared/project-claude-scaffold-package.mjs`
Why it matters:
- connects runtime scaffolding to the `project-agent/` source packet

## Stage 6: follow-up operational docs

After the reading above, use these targeted docs depending on the task.

### If you need file-routing help
Read:
- `docs/repo-change-impact-matrix.md`

### If you need the cross-layer call graph
Read:
- `docs/repo-call-flows.md`

### If you need to trace canonical PDF delivery
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
3. `docs/repo-architecture-overview.md`
4. `docs/base-canvas-contract.md`
5. `docs/presentation-package-spec.md`
6. `framework/runtime/presentation-cli.mjs`
7. `framework/runtime/presentation-core.mjs`
8. `framework/runtime/deck-policy.js`
9. `framework/runtime/services/presentation-ops-service.mjs`

## What you should be able to explain after finishing

You should be able to answer all of these correctly:

- What are the active public entrypoints for the product?
- What is the difference between authored source, intent, generated structure, and runtime evidence?
- Why are `.presentation/runtime/render-state.json` and `.presentation/runtime/artifacts.json` read-only to agents?
- Which files own project creation, package regeneration, preview, export, and finalize?
- Why is `.claude/` scaffold source only rather than a separate runtime host?
- Which protected files in `AGENTS.md` require extra caution before editing?
