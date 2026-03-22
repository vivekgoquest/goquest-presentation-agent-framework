# Presentation Framework Maintainer Contract

This contract is for maintaining the repository itself.

Use project-local `.claude/CLAUDE.md` when authoring a specific deck inside a scaffolded project.

## Mission

Keep the product reliable across:

- Electron desktop UX
- project-folder scaffolding
- runtime policy/check/capture/export/finalize flows
- project `.claude` scaffolding via `project-agent/`

## Core separation

1. Repo-maintainer context
- root `.claude/` + this file
- for framework/electron maintenance work

2. Project-authoring context
- scaffolded project `.claude/`
- source lives in:
  - `project-agent/project-dot-claude/`
  - `project-agent/project-claude-md.md`

## Product contracts

- Interactive UX is Electron-only (`npm run start` / `npm run desktop:start`).
- Runtime CLI targets are project-only (`--project /abs/path`).
- Legacy `--deck`, `--example`, browser operator UI, and `/workspaces` routes are removed.
- CSS ownership stays `content < theme < canvas`.
- Scaffolding must continue producing independent project `.claude` rules/skills/hooks/settings.

## Module boundaries

Keep the repo split into four domains:

1. Electron shell (`electron/`)
- owns UI/UX only
- may render product actions such as Build, Export, and Review
- must call named actions through the application layer
- must not import project-agent skills, prompt text, or runtime service implementations directly

2. Application layer (`framework/application/`)
- owns deterministic product action definitions, routing, and lifecycle events
- owns Electron-facing project queries and project creation
- is the only Electron-facing execution layer for presentation and agent actions

3. Presentation runtime (`framework/runtime/`, `framework/client/`, `framework/templates/`)
- owns project state, preview assembly, policy, capture, export, and finalize flows
- must not depend on Electron widgets or project-agent skills

4. Agent layer (`project-agent/`)
- owns skills, rules, dependencies, and agent-specific execution details
- must not depend on Electron UI structure

Allowed dependency direction:
- `electron -> framework/application`
- `framework/application -> framework/runtime`
- `framework/application -> project-agent` (through agent launcher, capability manifest, and scaffold package exports only)
- `electron/worker/terminal-service -> framework/runtime/terminal-core`

Forbidden dependency direction:
- `electron -> framework/runtime/services/*`
- `electron -> project-agent/*`
- `framework/runtime -> electron`
- `framework/runtime -> project-agent`
- `framework/runtime/terminal-core -> claude/codex vendor launch logic`

## Default edit lanes

- `framework/runtime/`
- `framework/client/`
- `framework/templates/` (deck content scaffold assets)
- `electron/`
- `project-agent/`
- `docs/`

## Protected areas

Only change with explicit intent:

- `framework/canvas/` structural contracts
- deck policy semantics in `framework/runtime/deck-policy.js`
- terminal lifecycle guarantees across `framework/runtime/terminal-core.mjs` and `electron/worker/terminal-service.mjs`

## Verification baseline

- `npm test`
- project lifecycle smoke via:
  - `npm run new -- --project /abs/path`
  - `npm run check -- --project /abs/path`
  - `npm run finalize -- --project /abs/path`

## Source docs

- `README.md`
- `START-HERE.md`
- `project-agent/project-dot-claude/rules/framework.md`
- `project-agent/project-dot-claude/rules/authoring-rules.md`
- `project-agent/project-dot-claude/rules/file-boundaries.md`
- `project-agent/project-dot-claude/rules/slide-patterns.md`
- `project-agent/project-dot-claude/rules/tokens.md`
- `docs/base-canvas-contract.md`
- `docs/presentation-package-spec.md`
- `docs/prd-human-agent.md`
