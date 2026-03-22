# Framework Spec

Read the project-root `AGENTS.md` first.

This file is a Claude-specific helper layer. The presentation package itself is
the source of truth.

## Purpose

This project uses a constrained HTML presentation framework for building decks that:

- preview in the Electron desktop app
- export to PDF deterministically
- support automated Playwright capture and review
- keep agent edits inside clearly owned surfaces

## Ownership Model

The overall repo is organized around ownership:

- `framework/canvas/` owns structural CSS
- `framework/client/` owns browser behavior
- `framework/runtime/` owns preview assembly, validation, capture, export, setup, and finalize
- one project folder (created via `npm run new -- --project /abs/path`) owns deck source, package state, and outputs

## Layer Contract

The cascade order is:

`content < theme < canvas`

Interpretation:

- `canvas` defines structural primitives and must remain authoritative
- `theme` defines the reusable visual system for one deck and must not change canvas behavior
- `content` comes from slide fragments and optional slide-local CSS, and must stay local to that slide

## Presentation Package

Use `AGENTS.md` plus `.presentation/*` for presentation package truth:

- `AGENTS.md` defines universal startup order, edit lanes, and required commands
- `.presentation/project.json` is stable system identity
- `.presentation/intent.json` is editable authoring intent
- `.presentation/package.generated.json` is deterministic structure generated from source
- `.presentation/runtime/` contains deterministic runtime evidence

Folder naming is source input, not package truth. Prefer sparse numbering such as `010`, `020`, `030`.

In slide-folder mode:

- `slide.html` must contain exactly one slide root fragment
- runtime generates the outer `<section id="<slide-id>" data-slide>` wrapper
- the assembled HTML is served on demand for preview/check/export/finalize
- decks with more than 10 slides must carry a completed `outline.md` before validation passes

## Structural Primitives

These classes are framework primitives and should be treated as protected:

- `.slide`
- `.slide-hero`
- `.slide-wide`
- `.g2`
- `.g3`
- `.g4`
- `.rv`, `.rv-l`, `.rv-r`, `.rv-s`

Runtime chrome is separate from the sacred canvas:

- `.runtime-dot-nav`

## Runtime Contract

The runtime assumes:

- deck policy validation passes before preview, export, capture, or finalize
- slide discovery happens via generated `[data-slide]`
- counters finalize through `[data-count]`
- animations can be disabled for stable capture and export
- `slides/` workspaces assemble deterministically into an in-memory HTML document that every runtime command serves or exports

## Editing Guidance

Deck work should usually:

- add or revise content within the local slide folders
- set reusable deck visuals in `theme.css`
- keep local layout or one-off styling in optional `slides/<NNN-slide-id>/slide.css`
- edit `.presentation/intent.json` when audience, purpose, or per-slide intent needs to change
- consume existing canvas utilities instead of redefining them
- treat `AGENTS.md` as the first project contract before using Claude-specific helpers

Deck work should not:
- bypass `/preview/` and edit hand-crafted HTML outside the slide folders
- change slide dimensions
- change grid semantics
- redefine protected canvas selectors from theme or slide-local CSS
- restyle runtime chrome selectors from slide-local CSS
- hand-edit `.presentation/package.generated.json`
- hand-edit `.presentation/runtime/*.json`
- create standalone root-level HTML decks when a project workspace is the intended flow
