# Presentation Framework Agent Contract

This repo is designed for AI agents, but it has a strict edit contract. The default job is to build or revise a deck workspace without breaking the framework.

## Mission

Turn a plain-English presentation request into:

- a presentation project folder
- a finalized PDF and screenshot set in that folder's `outputs/`
- a summary the user can review without reading logs

## Default Workflow

For new work:

1. Run `npm run setup` once initially, or again only if dependencies are missing.
2. Read `START-HERE.md` and the relevant docs in `specs/`.
3. Prefer `npm run new -- --project /abs/path` if the project does not exist. Use `--copy-framework` only when the project needs a vendored framework snapshot.
4. Normalize the user's request into `/abs/path/brief.md`.
5. If the deck needs more than 10 slides, scaffold it with `npm run new -- --project /abs/path --slides <count>` and lock the story in `/abs/path/outline.md` before slide buildout.
6. **Design the theme first.** Finalize `/abs/path/theme.css` with the full visual system — palette, typography, component styles — before writing any slide HTML. The theme is the design foundation; slides consume it.
7. **Design each slide.** For every slide in the outline, decide how it will look — which structural primitives to use, how it differs from its neighbors, and whether images are needed. Record these design notes in the outline's slide plan. Do not start building slide HTML until every slide has a design decision. Check the design quality rules in `specs/slide-patterns.md` before proceeding.
8. Build or revise source slides in `/abs/path/slides/<NNN-id>/slide.html`, following the per-slide design choices from the outline.
9. Keep reusable deck styling in `/abs/path/theme.css`.
10. Keep slide-specific CSS in optional `/abs/path/slides/<NNN-id>/slide.css`.
11. Keep assets deck-shared in `/abs/path/assets/` or slide-local in `/abs/path/slides/<NNN-id>/assets/`; do not reach into sibling slides or other workspaces.
12. When a human is supervising the work, prefer the operator console at `/` so the agent terminal and preview stay visible side by side.
13. In project mode, open `/preview/` in preview. In legacy workspace mode, open `/decks/<slug>/`. Use the Export PDF button for downloads and let runtime serve the assembled HTML.
14. Inspect the preview, screenshots, and downloaded PDF yourself. If it does not read like a presentation yet, revise `theme.css` and optional slide-local `slide.css` before finalizing.
15. Run `npm run finalize -- --project /abs/path` for project mode or `npm run finalize -- --deck <slug>` for legacy workspace mode.
16. Report the exact output paths in `outputs/`.

For revisions:

1. Update `revisions.md` in the opened project folder, or `decks/<slug>/revisions.md` in legacy mode.
2. Edit `theme.css`, source slide folders, and local slide assets as needed.
3. Reopen preview, inspect the updated PDF/screenshots, revise CSS if needed, and rerun finalize.

## Long Deck Rule

For decks with more than 10 slides:

1. Scaffold with `npm run new -- --project /abs/path --slides <count>` for project mode, or `npm run new -- --deck <slug> --slides <count>` in legacy mode.
2. Replace every `[[TODO_...]]` marker in `brief.md`.
3. Replace every `[[TODO_...]]` marker in `outline.md` and lock the full story before slide-by-slide buildout.
4. Finalize `theme.css` — the complete visual system — before writing any slide HTML.
5. Design each slide — decide how it will look and record the design notes in the outline. Check the design quality rules in `specs/slide-patterns.md`. Do not proceed to slide buildout until every slide has a design decision.
6. Build the slides in batches of 5 and run `npm run check -- --project /abs/path` after each batch in project mode, or `npm run check -- --deck <slug>` in legacy mode.
7. Do not jump straight from a fresh scaffold to finalize.

## Core Rule

The cascade is enforced as:

`content < theme < canvas`

Meaning:

- `framework/canvas/` is structural and highest-priority
- deck-local `theme.css` inherits canvas and defines the visual system
- slide content plus optional slide-local `slide.css` add only local composition

Do not use patterns that bypass this contract.

## Preview and Export Rule

When a project or workspace has `slides/`, treat the runtime route as canonical:

- `/preview/` for project-folder mode
- `/decks/<slug>/` for legacy deck workspaces

- when the preview server is running, `/` is the operator console and `/workspaces/` is the old raw workspace list
- do not hand-edit a generated HTML artifact—work through the slide folders and theme instead
- runtime assembles the full HTML on-demand for start, check, capture, export, and finalize
- folder names are the manifest: `NNN-slide-id`

Use sparse numbering such as `010`, `020`, `030` so a later insertion can become `025-case-study` without renumbering the whole deck.

## Default Edit Lane

When working on a deck, edit these first:

- `<project>/theme.css`
- `<project>/outline.md` for decks with more than 10 slides
- `<project>/slides/<NNN-id>/slide.html`
- optional `<project>/slides/<NNN-id>/slide.css`
- `<project>/brief.md`
- `<project>/revisions.md`
- shared assets inside `<project>/assets/`
- slide-local assets inside `<project>/slides/<NNN-id>/assets/`

Advanced project mode:

- `.presentation/framework/base/` is a copied snapshot and should usually not be edited
- `.presentation/framework/overrides/` is the only lane for project-local framework customization
- copied canvas files remain protected even when they exist under `.presentation/`

Legacy `decks/<slug>/` workspaces and `examples/` are still safe to inspect and use during transition.

## Protected Core

Do not edit these unless the task is explicitly framework/runtime work:

- `framework/canvas/`
- `framework/client/`
- `framework/runtime/`
- `templates/`
- `prompts/`
- `specs/`

## Banned Authoring Patterns

- no inline `style=""` attributes
- no raw `<style>` blocks inside slide fragments
- no changing `@layer content, theme, canvas`
- no `!important` in deck `theme.css` or slide-local `slide.css`
- no theme overrides of protected canvas selectors
- no slide CSS selectors that are not scoped to the generated `#<slide-id>`
- no slide CSS that styles another slide's root or escapes its own slide scope
- no slide CSS that restyles theme primitives with colors, typography, borders, or shadows
- no full-document wrappers, `<section data-slide>`, or outer `<body>` tags inside `slide.html`
- no root-relative or cross-workspace asset paths; use only slide-local assets or the deck's shared `assets/` folder
- no bypassing `/decks/<slug>/` preview and hand-editing a generated HTML artifact

The deck policy validator enforces these rules during preview, capture, export, and finalize.

## Required Commands

Default proof command:

1. `npm run finalize -- --project /abs/path`

Useful lower-level commands:

- `npm run setup`
- `npm run check -- --project /abs/path`
- `npm run capture -- --project /abs/path /tmp/<capture-dir>`
- `npm run export -- --project /abs/path /tmp/<deck-name>.pdf`
- `npm run check -- --deck <slug>`
- `npm run capture -- --deck <slug> /tmp/<capture-dir>`
- `npm run export -- --deck <slug> /tmp/<deck-name>.pdf`
- `npm run check -- --example <name>`
- `npm run export -- --example <name> /tmp/<capture-name>.pdf`
- `npm run start`

In slide-folder mode, these commands target workspace slugs because runtime assembles the HTML on demand.

When you run `npm run start`, the expected human flow is:

1. open `/`
2. use `Open Folder` to open an existing project or `Create Presentation` to initialize a new one
3. in project mode, browse the project files in the left column
4. launch `codex`, `claude`, or `Open Shell` from the Agent panel
5. optionally use the task composer to send the first prompt directly to Claude or Codex
6. keep the live preview visible on the right while you work
7. in legacy mode, `/workspaces/` still exposes the old raw workspace browser

## What The Agent Must Hand Back

At the end of a deck task, report:

1. the project folder path or legacy deck workspace path
2. the PDF path
3. the screenshot directory
4. the summary path
5. what changed
6. any issues that still need the user's decision

## Source Of Truth Docs

Read these before non-trivial edits:

- `START-HERE.md`
- `prompts/new-deck.md`
- `prompts/revise-deck.md`
- `prompts/review-deck.md`
- `prompts/review-deck-swarm.md`
- `prompts/fix-warnings.md`
- `prompts/operator-console-user-test.md`
- `prompts/operator-console-judge.md`
- `specs/framework.md`
- `specs/tokens.md`
- `specs/slide-patterns.md`
- `specs/authoring-rules.md`
- `specs/file-boundaries.md`
- `specs/autonomous-user-testing.md`

## Escalation Rule

If the requested change requires editing canvas, shared client/runtime code, templates, or validation policy, treat it as framework work and say so explicitly before making the change.
