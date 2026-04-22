# Presentation Project Contract

This project is a presentation package built with the Presentation Framework.

Start here before reading any vendor-specific adapter files.

## Read Order

Read these files in this order:

1. `.presentation/runtime/design-state.json`
2. `.presentation/project.json`
3. `.presentation/intent.json`
4. `.presentation/package.generated.json`
5. `.presentation/runtime/render-state.json`
6. `.presentation/runtime/artifacts.json`

Then read authored source as needed:

7. `brief.md`
8. `outline.md` if it exists
9. `theme.css`
10. relevant `slides/<NNN-slide-id>/slide.html`
11. relevant `slides/<NNN-slide-id>/slide.css` if it exists

## What This Package Contains

The presentation is defined by six lanes:

1. authored source
2. stable package identity
3. editable authoring intent
4. deterministic generated structure
5. deterministic runtime evidence
6. git-backed history

## Package Truth

Use these files as the source of truth:

- `.presentation/runtime/design-state.json`
  - generated evidence and first orientation surface
  - pointers to current canvas, theme, content, intent, structure, and runtime evidence authorities
  - not authorable state

- `.presentation/project.json`
  - stable package identity
  - framework linkage
  - package-level policy

- `.presentation/package.generated.json`
  - deterministic structure generated from source
  - slide inventory
  - slide order
  - source file map

- `.presentation/intent.json`
  - authoring intent
  - audience
  - objective
  - tone
  - per-slide purpose

- `.presentation/runtime/render-state.json`
  - current render and validation status
  - policy findings
  - canvas/runtime evidence
  - latest checked source fingerprint

- `.presentation/runtime/artifacts.json`
  - latest export inventory
  - canonical finalized root PDF when current
  - manual PDF or screenshot artifact paths when present

## Editable Files

You may edit:

- `brief.md`
- `theme.css`
- `outline.md` when present and needed
- `slides/<NNN-slide-id>/slide.html`
- `slides/<NNN-slide-id>/slide.css` if present or needed
- `assets/`
- `slides/<NNN-slide-id>/assets/`
- `.presentation/intent.json`

## Read-Only Files

Do not edit these by hand:

- `.presentation/project.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/design-state.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`

These are system-owned or runtime-owned.

## Core Authoring Rules

- The cascade contract is: `content < theme < canvas`
- `theme.css` owns the deck visual system
- slide HTML owns local content structure
- slide-local CSS must stay local to its own slide
- do not use inline `style=""`
- do not use raw `<style>` blocks in slide fragments
- do not edit generated wrappers or rendered HTML directly
- do not edit framework internals during normal deck authoring
- do not treat runtime evidence files as authorable state
- `.presentation/runtime/design-state.json` is generated evidence and the first orientation surface
- use `.presentation/runtime/design-state.json` to find the current canvas/theme/content authorities
- do not edit `.presentation/runtime/design-state.json` by hand; rerun the project-local CLI if it is missing or stale

## Slide Rules

- Slide folders follow `NNN-slide-id`
- Prefer sparse numbering such as `010`, `020`, `030`
- Folder names are source input
- Deterministic package truth comes from `.presentation/package.generated.json`
- Each `slide.html` must contain exactly one valid slide root fragment

## Project-Local CLI Commands

Use these commands from the project root:

- `node .presentation/framework-cli.mjs inspect package --format json`
- `node .presentation/framework-cli.mjs audit all`
- `node .presentation/framework-cli.mjs finalize`
- `node .presentation/framework-cli.mjs export screenshots --output-dir outputs/manual-capture`
- `node .presentation/framework-cli.mjs export pdf --output-dir outputs/manual-export --output-file deck.pdf`

Run `audit all` during iteration and `finalize` before handoff.
Use `inspect package` when you need raw package or runtime-state facts.

## Expected Handoff

When you finish a task, report:

1. changed source files
2. changed intent fields if any
3. output artifact paths
4. unresolved decisions or risks

## Vendor Adapters

This project may contain vendor-specific agent adapters such as:

- `.claude/`

Those adapter directories are not the source of presentation truth.
Read them only after reading this file and the `.presentation/` files above.

Adapter hooks are thin local entrypoints that call the project-local CLI from
this project root. They do not resolve framework source paths, import framework
services, or perform git checkpointing.

Treat adapter docs and skills as helper guidance beneath this project contract,
not as alternate sources of package state or workflow ownership.
