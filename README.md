# Goquest Presentation Framework

Goquest Presentation Framework is a shell-less presentation package for HTML/CSS deck projects.

The public product surface is:

- the installed `presentation` CLI
- the generated project-local shim at `.presentation/framework-cli.mjs`
- deterministic project state in `.presentation/`
- a scaffolded Claude adapter package in `.claude/`

## What the package does

It lets you:

- scaffold a new presentation project with `presentation init`
- inspect package structure with `presentation inspect package`
- read workflow state with `presentation status`
- run deterministic audits with `presentation audit`
- preview the assembled deck with `presentation preview serve|open`
- export artifacts with `presentation export`
- produce the canonical root PDF with `presentation finalize`

From a source checkout of this repository, run the same surface with:

```bash
node framework/runtime/presentation-cli.mjs ...
```

Inside a scaffolded project, use the local shim instead:

```bash
node .presentation/framework-cli.mjs ...
```

## Quickstart

### From this repository

```bash
npm run setup
node framework/runtime/presentation-cli.mjs init --project /abs/path/to/my-deck --slides 3
node framework/runtime/presentation-cli.mjs status --project /abs/path/to/my-deck --format json
node framework/runtime/presentation-cli.mjs audit all --project /abs/path/to/my-deck --format json
node framework/runtime/presentation-cli.mjs preview open --project /abs/path/to/my-deck
node framework/runtime/presentation-cli.mjs finalize --project /abs/path/to/my-deck --format json
```

If the project can resolve the installed `pitch-framework` package, you can switch to the local shim inside the project root:

```bash
node .presentation/framework-cli.mjs status --format json
node .presentation/framework-cli.mjs audit all --format json
node .presentation/framework-cli.mjs preview open
node .presentation/framework-cli.mjs finalize --format json
```

### As an installed package

```bash
presentation init --project /abs/path/to/my-deck --slides 3
presentation inspect package --project /abs/path/to/my-deck --format json
presentation status --project /abs/path/to/my-deck --format json
presentation audit all --project /abs/path/to/my-deck --format json
presentation preview serve --project /abs/path/to/my-deck
presentation export pdf --project /abs/path/to/my-deck
presentation finalize --project /abs/path/to/my-deck
```

## CLI guide

### `presentation init`

Creates a new project folder and writes:

- authored source at the project root
- hidden package state in `.presentation/`
- a project-local CLI shim at `.presentation/framework-cli.mjs`
- a scaffolded Claude adapter package in `.claude/`
- a git repository when `git` is available

Examples:

```bash
presentation init --project /abs/path/to/my-deck
presentation init --project /abs/path/to/my-deck --slides 5
presentation init --project /abs/path/to/my-deck --copy-framework
```

Notes:

- current v1 scaffolding supports `--slides 1` through `--slides 10`
- `--copy-framework` vendors framework files under `.presentation/framework/`

### `presentation inspect package`

Returns structured package facts, including the generated manifest plus current render and artifact state.

```bash
presentation inspect package --project /abs/path/to/my-deck --format json
```

Use this when you want raw package truth rather than interpreted workflow guidance.

### `presentation status`

Returns interpreted workflow state for the project.

Typical workflows are:

- `onboarding`
- `authoring`
- `blocked`
- `ready_for_finalize`
- `finalized`

```bash
presentation status --project /abs/path/to/my-deck --format json
```

Use this when you want next-step guidance such as `brief.md`, `slides/`, `presentation audit all`, or `presentation export`.

### `presentation audit`

Runs deterministic audits over authored content and package boundaries.

Supported families:

- `all`
- `theme`
- `canvas`
- `boundaries`

Examples:

```bash
presentation audit all --project /abs/path/to/my-deck --format json
presentation audit theme --project /abs/path/to/my-deck --format json
presentation audit all --project /abs/path/to/my-deck --slide intro --format json
```

### `presentation preview serve|open`

Serves the assembled deck from the runtime preview server.

```bash
presentation preview serve --project /abs/path/to/my-deck
presentation preview open --project /abs/path/to/my-deck
```

- `serve` starts the preview server and keeps it open until you stop it
- `open` starts the same server and opens the preview URL in the default browser

### `presentation export`

Exports explicit artifacts.

Examples:

```bash
presentation export pdf --project /abs/path/to/my-deck
presentation export pdf --project /abs/path/to/my-deck --output-dir outputs/manual-export --output-file deck.pdf
presentation export screenshots --project /abs/path/to/my-deck --output-dir outputs/manual-capture
```

Behavior:

- `export pdf` with no output path refreshes the canonical root PDF for the full deck
- `export pdf` with `--output-dir` or `--output-file` writes an extra PDF artifact inside the project
- `export screenshots` requires `--output-dir`

### `presentation finalize`

Runs the canonical delivery path for the full deck and refreshes runtime evidence.

```bash
presentation finalize --project /abs/path/to/my-deck --format json
```

Use `finalize` when you want the canonical project PDF at the root:

```text
<project-root>/<project-slug>.pdf
```

## Scaffolded project shape

A freshly initialized project contains authored source at the root plus hidden framework-owned state.

```text
my-deck/
├── brief.md
├── theme.css
├── slides/
│   ├── 010-intro/slide.html
│   ├── 020-slide-02/slide.html
│   └── 030-close/slide.html
├── assets/
├── my-deck.pdf                    # appears after export/finalize
├── .presentation/
│   ├── project.json
│   ├── intent.json
│   ├── package.generated.json
│   ├── runtime/
│   │   ├── render-state.json
│   │   └── artifacts.json
│   ├── framework/
│   │   ├── base/                 # only in copied-framework mode
│   │   └── overrides/            # only in copied-framework mode
│   └── framework-cli.mjs
├── .claude/
│   ├── AGENTS.md
│   ├── CLAUDE.md
│   ├── hooks/
│   ├── rules/
│   ├── skills/
│   └── settings.json
├── .gitignore
└── .git/                         # when git is available
```

Project ownership is:

- root files are the authored workspace
- `.presentation/intent.json` is authorable package intent
- `.presentation/package.generated.json` is deterministic structure
- `.presentation/runtime/*.json` is deterministic runtime evidence
- `.presentation/framework-cli.mjs` is the project-local entrypoint into the installed package
- `.claude/` is a scaffolded vendor adapter package, not structural deck truth

The CSS ownership contract stays:

```text
content < theme < canvas
```

## Repository source layout

```text
framework/canvas/                 # structural canvas contract and CSS
framework/client/                 # browser-side runtime behavior
framework/runtime/                # CLI, core, project state, preview, export, finalize
framework/shared/                 # shared scaffold helpers visible to runtime
framework/templates/              # authored template sources for new projects
project-agent/                    # source content for scaffolded .claude assets
docs/
.claude/                          # maintainer context for this repository
```

## Verification

```bash
npm test
```

## Contributor guidance

See `AGENTS.md` for maintainer rules, boundaries, and protected areas.
