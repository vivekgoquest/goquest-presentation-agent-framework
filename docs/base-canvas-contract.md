# Base Canvas Contract

## Purpose

This document defines the base canvas contract for the presentation framework.

It answers four questions:

1. What the base canvas structurally defines
2. What theme is allowed to customize
3. What deck content is allowed to change
4. How the repo enforces those boundaries at runtime

This is a maintainer-facing contract. It is not a deck-authoring tutorial.

## Ownership Model

The framework uses a strict cascade and ownership model:

`content < theme < canvas`

Interpretation:

- `canvas` owns structural layout, stage behavior, and protected primitives
- `theme` owns deck-level visual direction and semantic visual primitives
- `content` owns slide-local markup and optional slide-scoped CSS

The source contract is defined in:

- [framework/canvas/canvas-contract.mjs](/Users/vivek/Goquest%20Media%20Dropbox/Vivek%20Lath/Tech%20and%20Code/presentation-framework/framework/canvas/canvas-contract.mjs)
- [framework/canvas/canvas.css](/Users/vivek/Goquest%20Media%20Dropbox/Vivek%20Lath/Tech%20and%20Code/presentation-framework/framework/canvas/canvas.css)
- [framework/runtime/runtime-chrome.css](/Users/vivek/Goquest%20Media%20Dropbox/Vivek%20Lath/Tech%20and%20Code/presentation-framework/framework/runtime/runtime-chrome.css)
- [project-agent/project-dot-claude/rules/framework.md](/Users/vivek/Goquest%20Media%20Dropbox/Vivek%20Lath/Tech%20and%20Code/presentation-framework/project-agent/project-dot-claude/rules/framework.md)
- [project-agent/project-dot-claude/rules/authoring-rules.md](/Users/vivek/Goquest%20Media%20Dropbox/Vivek%20Lath/Tech%20and%20Code/presentation-framework/project-agent/project-dot-claude/rules/authoring-rules.md)
- [project-agent/project-dot-claude/rules/file-boundaries.md](/Users/vivek/Goquest%20Media%20Dropbox/Vivek%20Lath/Tech%20and%20Code/presentation-framework/project-agent/project-dot-claude/rules/file-boundaries.md)
- [project-agent/project-dot-claude/rules/tokens.md](/Users/vivek/Goquest%20Media%20Dropbox/Vivek%20Lath/Tech%20and%20Code/presentation-framework/project-agent/project-dot-claude/rules/tokens.md)
- [framework/runtime/deck-policy.js](/Users/vivek/Goquest%20Media%20Dropbox/Vivek%20Lath/Tech%20and%20Code/presentation-framework/framework/runtime/deck-policy.js)

## Base Stage Definition

The base canvas defines the presentation stage in `@layer canvas`.

Structural stage tokens:

- `--slide-max-w: 1200px`
- `--slide-wide-max-w: 1300px`
- `--slide-ratio: 16 / 9`
- `--slide-gap`
- `--grid-gap`
- `--grid-gap-lg`
- `--pad-x`
- `--pad-y`

Outer page behavior:

- `html` and `body` own the page background and stacked-slide page flow
- `body` centers slides vertically in a single-column page
- `section[data-slide]` is the generated slide wrapper used by runtime discovery and navigation

Core stage primitive:

- `.slide`
  - max width constrained by `--slide-max-w`
  - fixed aspect ratio from `--slide-ratio`
  - protected padding, overflow, border, radius, and shadow
  - relative positioning for logos and local content

Stage variants:

- `.slide-wide`
  - widened version of the base stage
- `.slide-hero`
  - hero stage mode with centered content and dark/light inversion

## Structural Primitives

The canvas owns these structural primitives and they should be treated as protected:

- Stage: `.slide`, `.slide-wide`, `.slide-hero`
- Grids: `.g2`, `.g3`, `.g4`
- Flex utilities: `.flex`, `.flex-col`, `.flex-wrap`, `.flex-1`, `.flex-center`, `.items-center`, `.justify-center`, `.flex-between`
- Width/text helpers: `.text-center`, `.w-full`, `.max-w-550`, `.max-w-600`, `.max-w-650`
- Spacing helpers: `.gap-*`, `.mt-*`, `.mb-*`, `.mt-auto`
- Reveal helpers: `.rv`, `.rv-l`, `.rv-r`, `.rv-s`

These primitives define layout semantics, not deck identity.

Runtime chrome is intentionally outside the sacred canvas contract:

- `.runtime-dot-nav`

## Theme-Owned Surface

Theme is allowed to define deck-specific visual direction without changing structure.

Theme-owned responsibilities:

- color system
- semantic text colors
- surface colors
- shadows
- radii
- deck font family
- canvas visual variables exposed for deck customization

Theme is expected to override approved visual variables such as:

- `--canvas-font-family`
- `--canvas-page-bg`
- `--canvas-body-text`
- `--canvas-slide-bg`
- `--canvas-slide-shadow`
- `--canvas-slide-border`
- `--canvas-slide-radius`
- `--canvas-hero-bg`
- `--canvas-hero-text`
- `--canvas-hero-muted`
- `--canvas-hero-eyebrow`
- `--canvas-logo-*`

Runtime chrome variables live outside the canvas contract and use the `--runtime-*` prefix.

Theme also owns semantic visual primitives defined in the scaffolded theme template, such as:

- `.hero-title`
- `.sect-title`
- `.eyebrow`
- `.body-lg`
- `.body-text`
- `.small-text`
- `.icard`
- `.stat-card`
- `.badge-*`
- `.tkwy`
- `table`, `th`, `td`
- `.img-round`, `.img-circle`
- `.divider`

The important rule is:

- theme may change how the deck looks
- theme must not change how the canvas behaves

## Content-Owned Surface

Content lives in project workspaces:

- `<project>/theme.css`
- `<project>/slides/<NNN-slide-id>/slide.html`
- optional `<project>/slides/<NNN-slide-id>/slide.css`
- optional `<project>/slides/<NNN-slide-id>/assets/`

Content rules:

- `slide.html` contains exactly one slide root fragment
- runtime generates the outer `<section id="<slide-id>" data-slide>` wrapper
- optional `slide.css` must stay scoped to the generated `#<slide-id>`
- content should compose existing canvas and theme primitives instead of redefining them

## Forbidden Deck-Level Changes

Normal deck authoring must not:

- change slide dimensions
- change the `16 / 9` stage ratio
- change grid semantics
- change responsive stage behavior
- redefine protected canvas selectors from `theme.css`
- use inline `style=""`
- use raw `<style>` blocks inside `slide.html`
- add outer `<html>`, `<head>`, `<body>`, or `<section data-slide>` wrappers to `slide.html`
- use `!important`
- let slide-local CSS escape its own generated slide root
- target another slide from `slide.css`
- use root-relative or cross-workspace asset references

If a requested change needs any of those, it is framework work, not normal deck work.

## Runtime and Policy Enforcement

The canvas contract is enforced by runtime policy, not only by authoring guidance.

`framework/runtime/deck-policy.js` currently enforces:

- required layer usage in deck CSS
- no `!important`
- no inline styles
- no raw `<style>` blocks in slide fragments
- no forbidden outer HTML tags in slide fragments
- no unresolved scaffold TODO markers in `brief.md` and `outline.md`
- no invalid asset references
- no theme overrides for protected canvas selectors
- no theme overrides for structural canvas tokens such as `--slide-max-w` or `--slide-ratio`
- no slide CSS that escapes its own slide
- no slide CSS that targets runtime chrome selectors

Protected canvas selectors come from the shared canvas contract module, including:

- `html`
- `body`
- `img`
- `section[data-slide]`
- `.slide`
- `.slide-wide`
- `.slide-hero`
- layout utilities
- spacing utilities
- reveal helpers

The practical effect is:

- canvas is structurally authoritative
- theme can style the surface the canvas exposes
- content cannot quietly redefine the stage

## Base Canvas Assumptions

The rest of the runtime assumes:

- slides are discovered via generated `[data-slide]`
- counters finalize via `[data-count]`
- the assembled deck is deterministic for preview, check, capture, export, and finalize
- animations can be disabled for stable capture/export
- decks should be authored through the project workspace and rendered via the assembled preview route, not by editing output HTML directly

## Known Tensions and Cleanup Opportunities

The base canvas contract is stronger now, but there are still a few places where the shape can improve further.

1. Visual canvas variables and structural canvas variables live in adjacent namespaces
- this is functional, but conceptually mixed
- structural tokens like `--slide-ratio` and visual tokens like `--canvas-hero-bg` currently sit side by side
- a future cleanup could separate structural stage tokens from deck-facing visual canvas variables more explicitly

2. Hero mode is partly structural and partly visual
- `.slide-hero` is a real stage mode and belongs in canvas
- its exact visual inversion is still driven by theme-exposed variables
- this is acceptable, but it is worth keeping intentional because it sits on the structural/visual boundary

## Maintainer Rule of Thumb

Use this question before changing anything:

- If the change alters slide size, stage layout, wrapper behavior, grid semantics, or protected primitives, it is canvas/framework work.
- If the change alters deck identity, visual tone, color, type, or reusable presentation style, it is theme work.
- If the change only affects one slide's content or one-off styling scoped to that slide, it is content work.

That is the current base canvas contract.
