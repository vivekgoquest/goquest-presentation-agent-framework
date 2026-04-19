# Start Here

This repository now ships a shell-less CLI-first presentation package.

Use either:

- the installed public command: `presentation ...`
- the repo-local source entrypoint: `node framework/runtime/presentation-cli.mjs ...`
- the project-local shim inside a scaffolded project: `node .presentation/framework-cli.mjs ...`

## 1) Install dependencies in this repository

```bash
npm run setup
```

## 2) Scaffold a project

From this repo checkout:

```bash
node framework/runtime/presentation-cli.mjs init --project /abs/path/to/my-deck --slides 3
```

Equivalent public command when the package is installed:

```bash
presentation init --project /abs/path/to/my-deck --slides 3
```

Current v1 scaffolding supports 1-10 slides.

## 3) Author the project root

After `init`, edit the authored workspace:

- `brief.md`
- `theme.css`
- `slides/<NNN-id>/slide.html`
- optional `slides/<NNN-id>/slide.css`
- `assets/`

Hidden package state lives in `.presentation/`.
Claude adapter files live in `.claude/`.

## 4) Use the project-local shim while working

If the project can resolve the installed `pitch-framework` package, change into the project root and use:

```bash
node .presentation/framework-cli.mjs inspect package --format json
node .presentation/framework-cli.mjs status --format json
node .presentation/framework-cli.mjs audit all --format json
```

If you are only working from this repository checkout and have not installed or linked the package for that project yet, keep using:

```bash
node framework/runtime/presentation-cli.mjs inspect package --project /abs/path/to/my-deck --format json
node framework/runtime/presentation-cli.mjs status --project /abs/path/to/my-deck --format json
node framework/runtime/presentation-cli.mjs audit all --project /abs/path/to/my-deck --format json
```

Use `inspect package` for raw manifest and runtime-state facts.
Use `status` for interpreted workflow guidance.
Use `audit all` for deterministic validation.

## 5) Preview the assembled deck

With the project-local shim:

```bash
node .presentation/framework-cli.mjs preview serve
node .presentation/framework-cli.mjs preview open
```

Or from the repo checkout surface:

```bash
node framework/runtime/presentation-cli.mjs preview serve --project /abs/path/to/my-deck
node framework/runtime/presentation-cli.mjs preview open --project /abs/path/to/my-deck
```

## 6) Export artifacts

With the project-local shim:

```bash
node .presentation/framework-cli.mjs finalize --format json
node .presentation/framework-cli.mjs export pdf --format json
node .presentation/framework-cli.mjs export pdf --output-dir outputs/manual-export --output-file deck.pdf
node .presentation/framework-cli.mjs export screenshots --output-dir outputs/manual-capture
```

Or from the repo checkout surface:

```bash
node framework/runtime/presentation-cli.mjs finalize --project /abs/path/to/my-deck --format json
node framework/runtime/presentation-cli.mjs export pdf --project /abs/path/to/my-deck --format json
```

## 7) Project layout to expect

```text
<project-root>/
  brief.md
  theme.css
  slides/
  assets/
  <project-slug>.pdf              # after export/finalize
  .presentation/
    project.json
    intent.json
    package.generated.json
    runtime/
      render-state.json
      artifacts.json
    framework-cli.mjs
  .claude/
    AGENTS.md
    CLAUDE.md
    hooks/
    rules/
    skills/
    settings.json
```

The important split is:

- authored source at the root
- deterministic package/runtime state in `.presentation/`
- project-local adapter helpers in `.claude/`
- local command entrypoint at `.presentation/framework-cli.mjs`

## 8) Verify the framework itself

From the repository root:

```bash
npm test
```
