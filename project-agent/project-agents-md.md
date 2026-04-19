# Presentation Project Contract

This project is a presentation package built with the Presentation Framework.

Start here before reading any vendor-specific adapter files.

## Read Order

Read these files in this order:

1. `.presentation/project.json`
2. `.presentation/package.generated.json`
3. `.presentation/intent.json`
4. `.presentation/runtime/render-state.json` if it exists
5. `.presentation/runtime/artifacts.json` if it exists
6. `.presentation/runtime/last-good.json` if it exists

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
  - current runtime validity
  - policy status
  - canvas status
  - quality status

- `.presentation/runtime/artifacts.json`
  - current output inventory
  - screenshot paths
  - report paths
  - PDF paths when present

- `.presentation/runtime/last-good.json`
  - last known-good render checkpoint
  - artifact references for that checkpoint
  - linked git commit when available

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
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/last-good.json`

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

## Slide Rules

- Slide folders follow `NNN-slide-id`
- Prefer sparse numbering such as `010`, `020`, `030`
- Folder names are source input
- Deterministic package truth comes from `.presentation/package.generated.json`
- Each `slide.html` must contain exactly one valid slide root fragment

## Project-Local CLI Commands

Use these commands from the project root:

- `node .presentation/framework-cli.mjs audit all`
- `node .presentation/framework-cli.mjs finalize`
- `node .presentation/framework-cli.mjs export screenshots --output-dir outputs/manual-capture`
- `node .presentation/framework-cli.mjs export pdf --output-dir outputs/manual-export --output-file deck.pdf`

Run `audit all` during iteration and `finalize` before handoff.

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
