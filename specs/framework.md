# Framework Spec

## Purpose

This repo is a constrained HTML presentation framework for building decks that:

- preview in a local browser
- export to PDF deterministically
- support automated Playwright capture and review

## Layer Contract

The cascade order is:

`content < theme < canvas`

Interpretation:

- `canvas` defines structural primitives and must remain authoritative
- `theme` defines the visual system and must not change canvas behavior
- `content` defines deck-specific composition and must not redefine framework primitives

## Deck Anatomy

A valid deck should contain:

- one or more `<section data-slide>` wrappers
- a slide root inside each section using one of:
  - `.slide`
  - `.slide.slide-hero`
  - `.slide-wide`
- stable `id` attributes on slide sections for capture and navigation

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

- deck policy validation passes before preview/export/capture
- slide discovery happens via `[data-slide]`
- counters finalize through `[data-count]`
- animations can be disabled for stable capture/export

## Editing Guidance

Deck work should usually:

- add new content within existing primitives
- add deck-specific selectors in `@layer content`
- consume theme tokens instead of redefining them

Deck work should not:

- change slide dimensions
- change grid semantics
- override theme classes from content
