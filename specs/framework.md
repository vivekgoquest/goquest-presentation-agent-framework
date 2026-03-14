# Framework Spec

## Purpose

This repo is a constrained HTML presentation framework for building decks that:

- preview in a local browser
- export to PDF deterministically
- support automated Playwright capture and review
- keep agent edits inside clearly owned surfaces

## Ownership Model

The repo is organized around ownership:

- `framework/canvas/` owns structural CSS
- `framework/client/` owns browser behavior
- `framework/runtime/` owns preview, validation, capture, export, setup, finalize, and deck assembly
- `decks/<slug>/` owns one user deck workspace
- `examples/<name>/` owns one example workspace with the same shape as a real deck

## Layer Contract

The cascade order is:

`content < theme < canvas`

Interpretation:

- `canvas` defines structural primitives and must remain authoritative
- `theme` defines the reusable visual system for one deck and must not change canvas behavior
- `content` comes from slide fragments and optional slide-local CSS, and must stay local to that slide

## Deck Anatomy

A deck workspace should usually live at:

- `decks/<slug>/theme.css`
- `decks/<slug>/brief.md`
- `decks/<slug>/outline.md` for decks with more than 10 slides
- `decks/<slug>/revisions.md`
- `decks/<slug>/assets/`
- `decks/<slug>/slides/<NNN-slide-id>/slide.html`
- optional `decks/<slug>/slides/<NNN-slide-id>/slide.css`
- optional `decks/<slug>/slides/<NNN-slide-id>/assets/`
- preview and/or export targets `/decks/<slug>/` and are always assembled from theme + slide sources

Generated review artifacts should usually live at:

- `outputs/<slug>/deck.pdf`
- `outputs/<slug>/report.json`
- `outputs/<slug>/full-page.png`
- `outputs/<slug>/slides/`
- `outputs/<slug>/summary.md`

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

-Deck work should not:
- bypass `/decks/<slug>/` and edit hand-crafted HTML outside the slide folders
- change slide dimensions
- change grid semantics
- redefine protected canvas selectors from theme or slide-local CSS
- create new root-level HTML decks when a workspace in `decks/<slug>/` is the intended flow
