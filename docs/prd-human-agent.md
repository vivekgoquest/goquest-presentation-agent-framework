# PRD: Human + Agent for the Shell-less Presentation Package

This document describes the current product requirements for the human operator and the scaffolded Claude agent package.

The current product is a shell-less CLI-first presentation package.

---

## 1. Product summary

The human works in a normal project folder with a normal editor and terminal.

The framework provides:

- the `presentation` CLI
- a project-local shim at `.presentation/framework-cli.mjs`
- deterministic package state in `.presentation/`
- a scaffolded Claude adapter package in `.claude/`
- canonical PDF delivery at the project root

The human may author files directly or delegate deck work to Claude through the scaffolded `.claude/` package.

## 2. Persona and role

The human is the creative owner of the presentation.

They care about:

- story
- audience fit
- clarity
- visual quality
- delivery confidence

They are not required to understand framework internals. Their working surface is the project folder plus the CLI.

The agent is an execution partner. It can edit the authored workspace, run project-local commands, and follow the rules scaffolded into `.claude/`.

The human keeps final authority.

## 3. Primary goals

### Human goals

- create a presentation project quickly
- author or revise slides in plain files
- preview the assembled deck in a browser
- run deterministic audits before delivery
- export the canonical root PDF when ready
- keep project structure understandable and portable

### Agent goals

- read package truth from `.presentation/`
- read project rules from `.claude/AGENTS.md` and `.claude/CLAUDE.md`
- edit only the authored workspace and authorable intent
- use project-local CLI commands for status, audit, preview, export, and finalize
- avoid mutating generated structure or runtime evidence by hand

## 4. Supported workflow

### 4.1 Create a project

The human can scaffold a project with:

```bash
presentation init --project /abs/path/to/my-deck --slides 3
```

Or, from a source checkout of this repository:

```bash
node framework/runtime/presentation-cli.mjs init --project /abs/path/to/my-deck --slides 3
```

Current v1 scaffolding supports 1-10 slides.

### 4.2 Author the root workspace

The main authored files are:

- `brief.md`
- `theme.css`
- `slides/<NNN-id>/slide.html`
- optional `slides/<NNN-id>/slide.css`
- `assets/`
- optional `slides/<NNN-id>/assets/`
- `.presentation/intent.json`

These files are where story, layout, and design intent live.

### 4.3 Check package truth

The human or agent can inspect package facts with:

```bash
node .presentation/framework-cli.mjs inspect package --format json
```

This should expose:

- the generated package manifest
- render-state facts
- artifact-state facts
- interpreted status context

### 4.4 Read workflow guidance

The human or agent can ask for workflow state with:

```bash
node .presentation/framework-cli.mjs status --format json
```

Expected workflow classes are:

- `onboarding`
- `authoring`
- `blocked`
- `ready_for_finalize`
- `finalized`

### 4.5 Run deterministic audit

The deterministic quality gate is:

```bash
node .presentation/framework-cli.mjs audit all --format json
```

The product may also expose narrower audit families such as `theme`, `canvas`, and `boundaries`.

Audit must:

- inspect source deterministically
- report hard violations clearly
- avoid silently rewriting authored files
- exit non-zero on hard failures

### 4.6 Preview the deck

The preview path is browser-based through the runtime server:

```bash
node .presentation/framework-cli.mjs preview serve
```

Or:

```bash
node .presentation/framework-cli.mjs preview open
```

Preview must render the same assembled deck model used by delivery flows.

### 4.7 Deliver artifacts

The canonical delivery action is:

```bash
node .presentation/framework-cli.mjs finalize --format json
```

This must:

- render the full deck
- produce the canonical root PDF
- refresh `.presentation/runtime/render-state.json`
- refresh `.presentation/runtime/artifacts.json`
- return pass/fail status and issues

Explicit extra artifacts are created with `export`.

Examples:

```bash
node .presentation/framework-cli.mjs export pdf --output-dir outputs/manual-export --output-file deck.pdf
node .presentation/framework-cli.mjs export screenshots --output-dir outputs/manual-capture
```

## 5. Project structure requirements

A scaffolded project must contain four recognizable zones.

### 5.1 Authored root workspace

At minimum:

- `brief.md`
- `theme.css`
- `slides/`
- `assets/`

After delivery, the root may also contain:

- `<project-slug>.pdf`

### 5.2 Hidden package state

Under `.presentation/`:

- `project.json`
- `intent.json`
- `package.generated.json`
- `runtime/render-state.json`
- `runtime/artifacts.json`
- `framework-cli.mjs`

### 5.3 Project-local Claude adapter package

Under `.claude/`:

- `AGENTS.md`
- `CLAUDE.md`
- `settings.json`
- `hooks/`
- `rules/`
- `skills/`

### 5.4 Optional copied-framework snapshot

When `--copy-framework` is used, the project may also contain:

- `.presentation/framework/base/`
- `.presentation/framework/overrides/`

## 6. Ownership and mutation rules

### 6.1 Human/agent editable

The human and agent may edit:

- root authored files
- optional slide-local assets
- `.presentation/intent.json`

### 6.2 System-owned

The system owns:

- `.presentation/project.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/framework-cli.mjs`
- scaffolded `.claude/` helper files
- the canonical root PDF emitted by finalize/export

These files may be regenerated or refreshed by commands, not hand-edited as authored source.

## 7. Guardrails

The current product guardrails are:

- authored source stays at the project root, not inside `.presentation/`
- `.claude/` is helper scaffolding, not structural package truth
- `content < theme < canvas` remains the CSS ownership contract
- audits, preview, export, and finalize must not silently repair authored content
- the project-local shim must stay portable and resolve the installed package normally
- delivery commands must operate on the same assembled deck used by preview

## 8. Human-agent interaction model

### 8.1 Start from package truth

When working in a scaffolded project, the agent should begin with:

1. `.presentation/project.json`
2. `.presentation/package.generated.json`
3. `.presentation/intent.json`
4. `.presentation/runtime/render-state.json`
5. `.presentation/runtime/artifacts.json`
6. `.claude/AGENTS.md`
7. `.claude/CLAUDE.md`

### 8.2 Use project-local commands

Inside a project, the agent should prefer:

- `node .presentation/framework-cli.mjs inspect package --format json`
- `node .presentation/framework-cli.mjs status --format json`
- `node .presentation/framework-cli.mjs audit all --format json`
- `node .presentation/framework-cli.mjs preview serve`
- `node .presentation/framework-cli.mjs finalize --format json`

### 8.3 Keep authorship boundaries clear

The agent may revise authored files, but it should not:

- hand-edit generated package structure
- hand-edit runtime evidence
- replace the local shim with machine-specific framework paths
- treat `.claude/` files as the source of slide structure

### 8.4 Human override always wins

The human may always:

- edit source files directly
- revise the brief
- change the theme
- add, rename, or remove slide folders
- rerun audit, preview, export, or finalize

The framework should not block direct authored-file edits.

## 9. Supported commands and expected outcomes

| Command | Expected outcome |
| --- | --- |
| `presentation init --project /abs/path --slides N` | Creates a new project with authored files, hidden package state, local shim, `.claude/`, and git when available |
| `presentation inspect package --project /abs/path --format json` | Returns manifest, render-state, artifacts, and package-level facts |
| `presentation status --project /abs/path --format json` | Returns workflow state, blockers, facets, and next focus |
| `presentation audit all --project /abs/path --format json` | Returns deterministic validation findings and exits non-zero on hard failure |
| `presentation preview serve --project /abs/path` | Starts the preview server and keeps it running |
| `presentation preview open --project /abs/path` | Starts the preview server and opens the browser |
| `presentation export pdf --project /abs/path` | Refreshes the canonical full-deck PDF at the project root |
| `presentation export pdf --project /abs/path --output-dir <dir> --output-file <file>` | Writes an extra PDF artifact inside the project |
| `presentation export screenshots --project /abs/path --output-dir <dir>` | Writes slide PNGs to the requested directory |
| `presentation finalize --project /abs/path --format json` | Runs canonical delivery, updates evidence, and returns pass/fail |

## 10. Success criteria

A project is ready for handoff when all of the following are true:

- authored source is complete enough to leave `onboarding`
- `presentation status` is no longer `blocked`
- `presentation audit all` passes cleanly
- preview renders the expected deck
- `presentation finalize` produces the canonical root PDF
- `.presentation/runtime/render-state.json` reflects the latest finalized check
- `.presentation/runtime/artifacts.json` points at the current delivered artifact state

## 11. Non-goals for the current product statement

This PRD does not assume:

- a separate host shell
- a split operator/runtime control plane
- direct authoring inside generated package files

The current product is the package, the project-local shim, and the project folder it scaffolds.
