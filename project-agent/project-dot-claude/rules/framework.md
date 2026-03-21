# Framework Spec

## Purpose

This repo is a constrained HTML presentation framework for building decks that:

- preview in the Electron desktop app
- export to PDF deterministically
- support automated Playwright capture and review
- keep agent edits inside clearly owned surfaces

## Ownership Model

The repo is organized around ownership:

- `framework/canvas/` owns structural CSS
- `framework/client/` owns browser behavior
- `framework/runtime/` owns preview assembly, validation, capture, export, setup, and finalize
- one project folder (created via `npm run new -- --project /abs/path`) owns deck source and outputs

## Layer Contract

The cascade order is:

`content < theme < canvas`

Interpretation:

- `canvas` defines structural primitives and must remain authoritative
- `theme` defines the reusable visual system for one deck and must not change canvas behavior
- `content` comes from slide fragments and optional slide-local CSS, and must stay local to that slide

## Deck Anatomy

A project workspace should usually live at:

- `<project>/theme.css`
- `<project>/brief.md`
- `<project>/outline.md` for decks with more than 10 slides
- `<project>/assets/`
- `<project>/slides/<NNN-slide-id>/slide.html`
- optional `<project>/slides/<NNN-slide-id>/slide.css`
- optional `<project>/slides/<NNN-slide-id>/assets/`
- preview target `/preview/`, assembled on demand from theme + slide sources

Generated review artifacts should usually live at:

- `<project>/outputs/deck.pdf`
- `<project>/outputs/report.json`
- `<project>/outputs/full-page.png`
- `<project>/outputs/slides/`
- `<project>/outputs/summary.md`

Folder naming is the manifest:

- folder pattern: `NNN-slide-id`
- order comes from the numeric prefix
- the stable slide id comes from the slug after the prefix
- prefer sparse numbering such as `010`, `020`, `030`

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
- `.dot-nav`
- `.export-bar`

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
- consume existing canvas utilities instead of redefining them

Deck work should not:
- bypass `/preview/` and edit hand-crafted HTML outside the slide folders
- change slide dimensions
- change grid semantics
- redefine protected canvas selectors from theme or slide-local CSS
- create standalone root-level HTML decks when a project workspace is the intended flow
