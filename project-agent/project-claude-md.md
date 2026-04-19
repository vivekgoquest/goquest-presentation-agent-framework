# Claude Adapter

In a scaffolded project, read AGENTS.md in this directory first.

This `.claude/` directory contains Claude-specific, project-local helpers:

- `settings.json` for hook wiring
- `hooks/` for thin local adapters that call `node .presentation/framework-cli.mjs ...`
- `skills/` for guided workflows such as new deck creation, deterministic validation repair, visual review, and narrative review

Presentation truth lives in:

- `.presentation/project.json`
- `.presentation/package.generated.json`
- `.presentation/intent.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/last-good.json`

Do not treat `.claude/` as the source of presentation structure or state.

Use `.claude/skills/*` only when the matching task is needed.

Keep this adapter shell-less and CLI-first:

- prefer project-local commands such as `node .presentation/framework-cli.mjs audit all`
- keep hooks thin and local to this project
- do not add framework-service imports or git workflow logic here
