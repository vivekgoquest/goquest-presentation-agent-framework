# Claude Adapter

In a scaffolded project, read `../AGENTS.md` first.

This `.claude/` directory contains Claude-specific workflow helpers:

- `settings.json` for hook wiring
- `hooks/` for local wrapper entrypoints into application-owned hook workflows
- `skills/` for guided workflows such as new deck creation, deterministic validation repair, visual review, and narrative review

Presentation truth lives in:

- `.presentation/project.json`
- `.presentation/package.generated.json`
- `.presentation/intent.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/last-good.json`

Do not treat `.claude/` as the source of presentation structure or state.

Use `.claude/skills/*` only when a Claude-specific workflow has been invoked.

If the launcher includes application-prepared workflow context in the prompt,
follow that workflow context as the canonical action definition. Treat the skill
file as execution guidance beneath that workflow, not as a competing source of
truth.
