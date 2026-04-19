# Repository Change Impact Matrix

**Use this when:** you know what kind of change is requested and need to find the correct files, risks, and verification steps.

**Read this after:** `docs/repo-architecture-overview.md`.

**Do not confuse with:** `docs/repo-high-risk-files.md`, which focuses on sensitivity rather than routing.

**Verification baseline:** each section lists the minimum recommended checks. Always start with `npm test`.

When a verification step uses `node .presentation/framework-cli.mjs ...`, assume either:
- the project can resolve the installed `pitch-framework` package, or
- you are using the AGENTS.md maintainer smoke setup so the local shim can resolve this repo checkout.

---

## How to use this matrix

For each requested change:

1. identify the closest change category below
2. read the listed files before editing
3. stay inside the listed lane unless the task explicitly requires escalation
4. run the listed verification before claiming success

When a task crosses categories, start with the highest-risk lane first.

## 1. Change the public CLI surface

Examples:
- add or change a command family
- change flags or argument validation
- change JSON/text envelopes
- change exit code behavior
- change public help or error wording

### Read first
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/presentation-core.mjs`
- `README.md`
- `START-HERE.md`

### Primary edit lane
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/presentation-core.mjs`
- `package.json` when the public bin/export surface changes

### Why
This lane owns the shipped product language for `presentation ...` and the repo-local source entrypoint.

### Verify
- `npm test`
- `node --test framework/runtime/__tests__/presentation-cli.test.mjs framework/runtime/__tests__/shellless-public-surface.test.mjs`
- a focused source-entrypoint smoke for the changed command

## 2. Change the project-local shim or project path contract

Examples:
- change `.presentation/framework-cli.mjs`
- change `--project` behavior
- change root PDF location
- change path-related help text
- change copied-framework path resolution

### Read first
- `framework/runtime/project-cli-shim.mjs`
- `framework/runtime/deck-paths.js`
- `docs/repo-trace-project-creation.md`
- `docs/presentation-package-spec.md`

### Primary edit lane
- `framework/runtime/project-cli-shim.mjs`
- `framework/runtime/deck-paths.js`
- related tests in `framework/runtime/__tests__/`

### Why
This lane owns project portability and the shell-less path model.

### Verify
- `npm test`
- `node --test framework/runtime/__tests__/deck-paths-project-only.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs`
- run the AGENTS.md shim smoke baseline if you changed resolution behavior

## 3. Change project scaffolding

Examples:
- add or remove a scaffolded file
- change default theme or brief contents
- change initial slide numbering or naming
- change `.presentation/` initialization
- change `.claude/` scaffold contents
- change git init behavior

### Read first
- `framework/runtime/services/scaffold-service.mjs`
- `framework/shared/project-claude-scaffold-package.mjs`
- `project-agent/project-agents-md.md`
- `project-agent/project-claude-md.md`
- `docs/repo-trace-project-creation.md`

### Primary edit lane
- `framework/runtime/services/scaffold-service.mjs`
- `framework/templates/*`
- `framework/shared/project-claude-scaffold-package.mjs`
- `project-agent/*`

### Why
Scaffolding is split between runtime-owned project files and scaffolded Claude adapter files.

### Verify
- `npm test`
- `node --test project-agent/__tests__/scaffold-package.test.mjs framework/runtime/services/__tests__/runtime-services.test.mjs`
- `node framework/runtime/presentation-cli.mjs init --project "$TMP_PROJECT" --slides 1 --format json`
- inspect generated `.presentation/` and `.claude/`

## 4. Change package state, runtime evidence, or workflow status

Examples:
- change `project.json` fields
- change manifest generation
- change `render-state.json` or `artifacts.json` shape
- change workflow classification such as `blocked` or `finalized`
- change status messaging or next-step guidance

### Read first
- `framework/runtime/presentation-package.js`
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/project-state.js`
- `framework/runtime/status-service.js`
- `docs/presentation-package-spec.md`

### Primary edit lane
- the corresponding runtime state modules
- related tests under `framework/runtime/__tests__/`
- spec docs that define the contract

### Why
These files define durable project truth rather than transient behavior.

### Verify
- `npm test`
- `node --test framework/runtime/__tests__/presentation-package.test.mjs framework/runtime/__tests__/presentation-runtime-state.test.mjs framework/runtime/__tests__/status-service.test.mjs`
- scaffold a project and inspect `.presentation/*.json`
- run project-local `inspect package`, `status`, and `finalize`

## 5. Change audits or policy semantics

Examples:
- change forbidden CSS or HTML rules
- change asset-path policy
- change long-deck outline enforcement
- change audit issue wording or severity behavior

### Read first
- `framework/runtime/deck-policy.js`
- `framework/runtime/audit-service.js`
- `docs/base-canvas-contract.md`
- `docs/presentation-package-spec.md`

### Primary edit lane
- `framework/runtime/deck-policy.js`
- `framework/runtime/audit-service.js`
- related contract docs

### Protected area warning
`AGENTS.md` explicitly flags policy semantics as protected.

### Verify
- `npm test`
- `node --test framework/runtime/__tests__/deck-policy.test.mjs`
- scaffold a project and run `node .presentation/framework-cli.mjs audit all --format json`
- run `node .presentation/framework-cli.mjs finalize --format json` on a valid project

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
This is one of the most sensitive areas in the repo. It affects every project.

### Verify
- `npm test`
- `node --test framework/canvas/__tests__/canvas-contract.test.mjs`
- a shell-less project smoke with `audit all` and `finalize`
- inspect rendered output artifacts carefully

## 7. Change preview serving or assembled HTML composition

Examples:
- change generated slide wrappers
- inject new scripts or styles
- change preview routing
- change runtime preview failure rendering
- change asset rewriting during assembly

### Read first
- `framework/runtime/deck-assemble.js`
- `framework/runtime/runtime-app.js`
- `framework/runtime/preview-server.mjs`
- `docs/repo-call-flows.md`

### Primary edit lane
- `framework/runtime/deck-assemble.js`
- `framework/runtime/runtime-app.js`
- `framework/runtime/preview-server.mjs`

### Why
Preview, export, and finalize all depend on this shared assembly path.

### Verify
- `npm test`
- `node --test framework/runtime/__tests__/preview-server.test.mjs framework/runtime/__tests__/preview-state-page.test.mjs`
- `node .presentation/framework-cli.mjs preview serve`
- `node .presentation/framework-cli.mjs finalize --format json`

## 8. Change export or finalize behavior

Examples:
- change canonical root-PDF behavior
- change manual PDF export behavior
- change screenshot export behavior
- change rendered-issue summarization
- change runtime evidence writes during delivery

### Read first
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/pdf-export.js`
- `framework/runtime/presentation-runtime-state.js`
- `docs/repo-action-trace-export-presentation.md`

### Primary edit lane
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/pdf-export.js`
- related runtime state helpers

### Why
This lane owns deterministic delivery and artifact recording.

### Verify
- `npm test`
- `node --test framework/runtime/services/__tests__/runtime-services.test.mjs framework/runtime/__tests__/shellless-package-integration.test.mjs`
- `node .presentation/framework-cli.mjs export pdf --format json`
- `node .presentation/framework-cli.mjs finalize --format json`
- inspect the project-root PDF plus `.presentation/runtime/render-state.json` and `.presentation/runtime/artifacts.json`

## 9. Change browser-side runtime behavior

Examples:
- keyboard navigation logic
- dot navigation behavior
- counters, animation, or reveal handling
- runtime chrome behavior inside preview

### Read first
- `framework/client/nav.js`
- `framework/client/counter.js`
- `framework/client/animations.js`
- `framework/runtime/deck-assemble.js`

### Primary edit lane
- `framework/client/*`

### Why
The browser runtime behavior is owned by `framework/client/` and is consumed by the preview/export pipeline.

### Verify
- `npm test`
- the closest `framework/client` or preview tests
- manual preview navigation in the browser
- `finalize` for stability if behavior affects rendering

## 10. Change the scaffolded Claude adapter package

Examples:
- add or change a skill
- change `.claude/AGENTS.md` or `.claude/CLAUDE.md`
- change hook wording or hook boundaries
- change deck-editable vs runtime-owned guidance

### Read first
- `framework/shared/project-claude-scaffold-package.mjs`
- `project-agent/project-agents-md.md`
- `project-agent/project-claude-md.md`
- `project-agent/project-dot-claude/*`
- `project-agent/__tests__/scaffold-package.test.mjs`

### Primary edit lane
- `project-agent/*`
- `framework/shared/project-claude-scaffold-package.mjs`

### Why
This lane owns project-local agent guidance, but it must stay subordinate to runtime/package truth.

### Verify
- `npm test`
- `node --test project-agent/__tests__/scaffold-package.test.mjs`
- scaffold a fresh project and inspect `.claude/`
- confirm scaffolded markdown teaches only current shell-less commands and files

## 11. Change maintainer docs or repo contracts

Examples:
- rewrite architecture docs
- update verification runbooks
- update onboarding guidance
- remove stale references to deleted layers or files

### Read first
- `AGENTS.md`
- `README.md`
- `START-HERE.md`
- the specific `docs/repo-*.md` files you are changing

### Primary edit lane
- `docs/*`
- top-level maintainer docs when required

### Why
These docs teach the repository’s current architecture and verification habits.

### Verify
- `npm test`
- `node --test framework/runtime/__tests__/shellless-public-surface.test.mjs`
- spot-check that each documented command and file path still exists

## Final check before editing

Before changing anything, answer these four questions:

1. Which layer owns the behavior I am changing?
2. Is this a protected area named in `AGENTS.md`?
3. What is the minimum verification for this lane?
4. Am I accidentally reintroducing a deleted shell/application workflow or stale runtime evidence assumption?
