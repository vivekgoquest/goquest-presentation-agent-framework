# Goquest Presentation Agent Framework

An agent-first presentation framework for non-technical users and coding agents. The user describes the deck in plain English, the agent builds a local project folder, and the framework handles preview, validation, capture, and PDF export.

## Start Here

If you are non-technical, start with [`START-HERE.md`](START-HERE.md).

That file gives you:

- one copy-paste prompt for any agent
- the expected review loop
- the exact files and outputs the agent should hand back

## The Core Idea

This repo is organized by ownership, not just by CSS theory:

```text
framework/
  canvas/
  client/
  runtime/
decks/
  <slug>/
examples/
  template/
  demo/
templates/
outputs/
prompts/
specs/
```

- `framework/canvas/` owns the structural slide layer and is protected
- `framework/client/` owns browser behavior such as reveals, nav, counters, and export
- `framework/runtime/` owns preview, validation, capture, export, setup, finalize, and deck assembly
- each deck in `decks/<slug>/` owns its deck-wide theme, slide source folders, local assets, and notes
- `examples/` mirrors real workspace shape so agents can inspect and copy from it safely

## Talk To Your Agent

The default workflow is:

1. Have the agent run `npm run setup` once initially, or again only if dependencies are missing.
2. Tell the agent what the deck is for in plain English.
3. Give it a deck slug, or let it propose one.
4. Let it create or update a project folder with `npm run new -- --project /abs/path`.
5. Have it run `npm run finalize -- --project /abs/path`.
6. Review the PDF, screenshots, and summary inside that project's `outputs/`.

The user should not need to think about CSS layers, Playwright, assembly, or export internals.

## Project Model

New work lives in a self-contained presentation project:

```text
<project-root>/
  theme.css
  brief.md
  outline.md
  revisions.md
  assets/
  slides/
    010-hero/
      slide.html
      slide.css
      assets/
    020-story/
      slide.html
    030-close/
      slide.html
  outputs/
  deck.pdf
  report.json
  full-page.png
  slides/
  summary.md
  .presentation/
    project.json
    framework/
      base/
      overrides/
```

Notes:

- `theme.css` is the deck-wide visual authority
- `outline.md` is required for decks with more than 10 slides
- `slides/<NNN-id>/slide.html` is the source of truth for slide content
- `slides/<NNN-id>/slide.css` is optional and only for that slide
- assets must stay deck-shared in `assets/` or slide-local in `slides/<NNN-id>/assets/`
- `/preview/` is the canonical route for project-folder mode
- `.presentation/project.json` stores project metadata
- `.presentation/framework/base/` is the copied framework snapshot in copied mode
- `.presentation/framework/overrides/` is the advanced lane for project-local framework changes

Legacy workspaces under `decks/<slug>/` and `examples/<name>/` remain supported during transition.

Note for technical users:

- all new work should use the slide-folder model

## Layer Contract

The enforced cascade order is:

`content < theme < canvas`

Interpretation:

- `canvas` is structural and authoritative
- `theme` inherits canvas and defines the reusable visual system for one deck
- `content` comes from slide fragments plus optional slide-local `slide.css`, and stays local to that slide

The validator checks deck-authored surfaces together:

- `theme.css`
- `slides/*/slide.html`
- optional `slides/*/slide.css`
- the assembled HTML that runtime serves for preview/export

Validation fails on:

- missing `@layer content, theme, canvas`
- inline `style=""`
- raw `<style>` blocks inside slide fragments
- `!important` in deck `theme.css` or slide-local `slide.css`
- theme overrides of protected canvas selectors
- slide CSS that is not scoped to its generated `#<slide-id>`
- slide CSS that restyles theme primitives with colors, typography, borders, or shadows
- authoring slide fragments with outer `<section>`, `<body>`, or full-document wrappers

## Install

```bash
npm run setup
```

This installs npm packages and ensures the Playwright Chromium browser used by capture and export is available. The setup script is idempotent: it skips work when dependencies are already present.

## Quick Start

Create a new project:

```bash
npm run setup
npm run new -- --project /abs/path/to/acme-pitch
```

For long decks, scaffold the full slide count up front:

```bash
npm run new -- --project /abs/path/to/city-after-dark --slides 20
```

If the project needs a vendored framework snapshot:

```bash
npm run new -- --project /abs/path/to/city-after-dark --slides 20 --copy-framework
```

Start the workspace server:

```bash
npm run start
```

Open the operator console:

- `http://127.0.0.1:3000/`

From there:

- use `Open Folder` to open an existing project or `Create Presentation` to initialize a new one
- keep the current project in one browser workspace instead of bouncing between terminal and preview tabs

Once a project is open, the console gives you:

- a left workspace column with project files on top and an agent launcher / terminal panel below
- a live preview pane on the right pointed at `/preview/` for the opened project
- explicit `Launch Codex`, `Launch Claude`, and `Open Shell` actions instead of an auto-started raw shell
- a task composer that can send the first prompt straight to Claude or Codex
- project progress and outputs status above the preview
- the same hot reload and Export PDF flow as the raw preview routes

The raw routes remain available if you want them directly:

- `http://localhost:3000/preview/`
- `http://localhost:3000/examples/template/`
- `http://localhost:3000/examples/demo/`
- `http://localhost:3000/workspaces/` for the old bare workspace browser

Finalize the deck:

```bash
npm run finalize -- --project /abs/path/to/acme-pitch
```

Review the outputs:

- `/abs/path/to/acme-pitch/outputs/deck.pdf`
- `/abs/path/to/acme-pitch/outputs/slides/`
- `/abs/path/to/acme-pitch/outputs/report.json`
- `/abs/path/to/acme-pitch/outputs/summary.md`

## Commands

### `npm run new -- --deck <slug> [--slides <count>]`

Scaffolds a new workspace using the repo templates.

Creates:

- `decks/<slug>/theme.css`
- `decks/<slug>/brief.md`
- `decks/<slug>/outline.md` for decks with more than 10 slides
- `decks/<slug>/revisions.md`
- `decks/<slug>/assets/`
- `decks/<slug>/slides/010-hero/slide.html`
- additional slide folders based on the requested slide count
- preview `/decks/<slug>/` to see the assembled HTML once theme and slides are ready

For decks with more than 10 slides:

- replace `brief.md` first
- replace every `[[TODO_...]]` marker in `outline.md`
- build the slides in batches of 5
- run `npm run check -- --deck <slug>` after each batch

### `npm run finalize -- --deck <slug>`

Runs the end-to-end deck workflow:

- deck assembly
- policy validation
- Playwright capture
- PDF export
- summary generation

Outputs:

- `outputs/<slug>/deck.pdf`
- `outputs/<slug>/report.json`
- `outputs/<slug>/full-page.png`
- `outputs/<slug>/slides/`
- `outputs/<slug>/summary.md`

Notes:

- finalize clears the old output directory first, so reruns are deterministic
- `summary.md` is rendered from `templates/summary.md`
- finalize exits non-zero when the deck still needs review

### Low-level commands

These remain available for agents and technical users:

```bash
npm run check -- --deck acme-pitch
npm run capture -- --deck acme-pitch /tmp/acme-capture
npm run export -- --deck acme-pitch /tmp/acme.pdf
```

Even in slide-folder mode, those commands talk to workspace slugs because the runtime assembles the HTML on demand.

You can also export or inspect examples directly:

```bash
npm run check -- --example demo
npm run export -- --example template /tmp/template.pdf
```

Operator-console baseline smoke:

```bash
npm run ui-smoke -- --project /abs/path/to/acme-pitch
```

That opens the real project workspace through Playwright, launches a shell from the Agent panel, verifies the terminal and preview are live, clicks the top-bar Export PDF action, runs finalize, and saves proof artifacts under the project's `outputs/ui-smoke-*` directory.

## Preview Server

Run:

```bash
npm run start
```

The server provides:

- an operator console at `/`
- a raw workspace browser at `/workspaces/`
- example previews at `/examples/template/` and `/examples/demo/`
- deck workspace previews at `/decks/<slug>/`
- live reload
- browser-triggered PDF export through `POST /api/export`

The operator console is the default human entrypoint:

1. start the server
2. open `/`
3. browse the project files in the left column
4. launch `codex`, `claude`, or a shell from the Agent panel
5. watch the live preview update on the right

The export endpoint accepts workspace references such as:

- `{ "ownerType": "deck", "ownerName": "acme-pitch" }`
- `{ "ownerType": "example", "ownerName": "demo" }`

When a workspace uses slide folders, preview regenerates the deck automatically when `theme.css` or any file under `slides/` changes.

## How To Use With Agents

The operator console is the main human UI, and the terminal inside it is where the agent runs.

The user should describe:

- goal
- audience
- tone
- must-include facts
- any documents or assets to use

The agent should normalize that into:

- `brief.md` for initial direction
- `revisions.md` for later changes

Suggested prompt files live in [`prompts/`](prompts).

## Steering Codex, Claude Code, Or Another Agent

Use this pattern:

1. Tell the agent to read [`START-HERE.md`](START-HERE.md) and [`AGENTS.md`](AGENTS.md).
2. Ask it to create or update a deck workspace.
3. Ask it to finalize the deck before handing it back.

The agent should return:

- the deck workspace path
- the PDF path
- the screenshot path
- the summary path
- what changed
- anything that still needs your decision

## Repo Structure

```text
framework/
  canvas/
    canvas.css
  client/
    animations.js
    nav.js
    counter.js
    export.js
  runtime/
    server.mjs
    deck-policy.js
    deck-capture.mjs
    pdf-export.js
    finalize-deck.mjs
    new-deck.mjs
    setup.mjs
decks/
examples/
templates/
outputs/
prompts/
specs/
```

## Protected Core

Agents should treat these as framework-level files:

- `framework/canvas/`
- `framework/client/`
- `framework/runtime/`
- `templates/`
- `prompts/`
- `specs/`

Normal deck work should stay inside `decks/<slug>/`.
