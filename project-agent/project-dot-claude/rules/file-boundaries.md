# File Boundaries

Read `.claude/AGENTS.md` first.

This file is a Claude-specific restatement of the editable and read-only lanes
defined by the project contract.

## Default Editable Files

Agents should assume these are safe to edit for deck work:

- `<project>/theme.css`
- `<project>/slides/<NNN-slide-id>/slide.html`
- optional `<project>/slides/<NNN-slide-id>/slide.css`
- `<project>/brief.md`
- `<project>/outline.md` for decks with more than 10 slides
- `<project>/.presentation/intent.json`
- shared images and other assets inside `<project>/assets/`
- slide-local assets inside `<project>/slides/<NNN-slide-id>/assets/`

When `slides/` exists, treat `/preview/` as the source preview/export route and never try to edit a rendered HTML output directly.

Generated package and runtime truth are read-only:

- `<project>/.presentation/project.json`
- `<project>/.presentation/package.generated.json`
- `<project>/.presentation/runtime/render-state.json`
- `<project>/.presentation/runtime/artifacts.json`
- `<project>/.presentation/runtime/last-good.json`

## Shared Framework Files

These affect every deck and should be treated as protected unless the task is explicitly framework-level:

- [`framework/canvas/`](../framework/canvas)
- [`framework/client/`](../framework/client)
- [`framework/runtime/`](../framework/runtime)
- [`framework/templates/`](../../../framework/templates)

## Escalation Examples

These are framework tasks, not normal deck edits:

- changing slide dimensions or responsive behavior
- changing grid semantics
- changing how assembly, export, or capture prepares the page
- changing the deck validation policy
- changing the workspace templates or finalize flow
- changing default badge, card, or type primitives that multiple decks rely on

## Safe Deck-Level Examples

These are normal deck edits:

- replacing copy in a slide source fragment
- adding a new slide folder using sparse numbering
- changing deck-local theme tokens and reusable primitives in `theme.css`
- adding slide-scoped selectors in an optional `slide.css`
- swapping assets referenced by the deck workspace
