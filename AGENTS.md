# Presentation Framework Maintainer Contract

This contract is for maintaining the repository itself.

Use project-local `.claude/CLAUDE.md` when authoring a specific deck inside a scaffolded project.

## Mission

Maintain the shell-less presentation package.

The package owns:

- the public CLI surface
- the runtime/core execution path
- deterministic project state under `.presentation/`
- scaffolded project `.claude/` adapter assets
- preview, export, and finalize flows

## Core product surface

Treat these as the active product entrypoints:

- installed package command: `presentation ...`
- source checkout entrypoint: `node framework/runtime/presentation-cli.mjs ...`
- project-local shim: `node .presentation/framework-cli.mjs ...`

A scaffolded project contains:

- authored source at the project root
- deterministic package state in `.presentation/`
- scaffolded adapter files in `.claude/`

`project-agent/` is scaffold source only. It is not a separate runtime host.

## Working contexts

1. Repo maintainer context
- root `.claude/` plus this file
- use this for package/framework maintenance

2. Project authoring context
- a scaffolded project's `.claude/`
- authored source lives in the project root
- package truth lives under `.presentation/`

## Current repository shape

1. Runtime package surface: `framework/runtime/`
- CLI entrypoint
- runtime core
- package/state/status services
- preview/export/finalize services
- project scaffold service

2. Canvas and browser runtime: `framework/canvas/` and `framework/client/`
- canvas contract
- browser-side preview/runtime behavior
- CSS ownership boundary: `content < theme < canvas`

3. Scaffold assets: `framework/templates/` and `framework/shared/`
- authored starter files for new projects
- shared assembly for scaffolded `.claude/` contents

4. Claude scaffold source: `project-agent/`
- source material copied into project `.claude/`
- rules, hooks, skills, and settings for scaffolded projects

5. Maintainer docs: `docs/`
- package architecture
- call flows
- package/spec contracts

## Product contracts

- The repository ships a shell-less CLI-first package.
- `framework/runtime/presentation-cli.mjs` is the canonical source CLI implementation.
- `.presentation/framework-cli.mjs` is the only project-local command entrypoint.
- Project scaffolding must continue to create both `.presentation/` and `.claude/`.
- Deterministic package ownership is:
  - authored source + `.presentation/intent.json` are editable
  - `.presentation/package.generated.json` is deterministic structure
  - `.presentation/runtime/*.json` is deterministic runtime evidence
  - git is the history lane
- `project-agent/` remains scaffold source only.
- Keep the CSS ownership contract: `content < theme < canvas`.

## Dependency shape

Keep the active dependency flow simple:

- `presentation-cli` -> runtime core -> package/state/runtime services
- runtime scaffold service -> templates + shared scaffold package
- shared scaffold package -> `project-agent/` scaffold source
- preview/export/finalize flows may consume `framework/client/` and `framework/canvas/` assets

Do not add a separate host layer, alternate router, or hard-coded source-path control plane back into the product.

## Default edit lanes

- `framework/runtime/`
- `framework/canvas/`
- `framework/client/`
- `framework/templates/`
- `project-agent/`
- `docs/`

## Protected areas

Only change these with explicit intent:

- `framework/canvas/` structural contract and shared canvas CSS
- `framework/runtime/deck-policy.js` policy semantics and audit expectations
- `framework/runtime/presentation-package.js`, `framework/runtime/presentation-runtime-state.js`, and `framework/runtime/project-state.js` package/state contracts
- `framework/runtime/project-cli-shim.mjs` portability contract for scaffolded projects
- `framework/runtime/services/scaffold-service.mjs` project creation contract
- `framework/runtime/services/presentation-ops-service.mjs` and `framework/runtime/pdf-export.js` delivery/finalize behavior
- `framework/shared/project-claude-scaffold-package.mjs` plus `project-agent/project-dot-claude/` scaffolded adapter package contents

## Verification baseline

- `npm test`
- shell-less CLI smoke using both entrypoints:

```bash
TMP_ROOT="$(mktemp -d)"
TMP_PROJECT="$TMP_ROOT/demo"
mkdir -p "$TMP_ROOT/node_modules"
ln -s "$(pwd)" "$TMP_ROOT/node_modules/pitch-framework"

node framework/runtime/presentation-cli.mjs init --project "$TMP_PROJECT" --slides 1 --format json
node "$TMP_PROJECT/.presentation/framework-cli.mjs" inspect package --format json
node "$TMP_PROJECT/.presentation/framework-cli.mjs" status --format json
```

When you change preview/export/finalize behavior, extend the smoke with the closest project-local command that exercises that path.

## Source docs

Read the current repo docs before broad changes:

- `README.md`
- `START-HERE.md`
- `docs/repo-architecture-overview.md`
- `docs/repo-architecture-index.md`
- `docs/repo-call-flows.md`
- `docs/repo-trace-project-creation.md`
- `docs/base-canvas-contract.md`
- `docs/presentation-package-spec.md`
- `docs/prd-human-agent.md`
- `project-agent/project-agents-md.md`
- `project-agent/project-claude-md.md`
