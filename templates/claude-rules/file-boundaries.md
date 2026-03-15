# File Boundaries

## Default Editable Files

Agents should assume these are safe to edit for deck work:

- `decks/<slug>/theme.css`
- `decks/<slug>/slides/<NNN-slide-id>/slide.html`
- optional `decks/<slug>/slides/<NNN-slide-id>/slide.css`
- `decks/<slug>/brief.md`
- `decks/<slug>/outline.md` for decks with more than 10 slides
- `decks/<slug>/revisions.md`
- shared images and other assets inside `decks/<slug>/assets/`
- slide-local assets inside `decks/<slug>/slides/<NNN-slide-id>/assets/`

When `slides/` exists, treat `/decks/<slug>/` as the source preview/export route and never try to edit a rendered HTML output directly.

The built-in examples in `examples/` are reference workspaces. They are editable only when the task explicitly targets those examples.

## Shared Framework Files

These affect every deck and should be treated as protected unless the task is explicitly framework-level:

- [`framework/canvas/`](../framework/canvas)
- [`framework/client/`](../framework/client)
- [`framework/runtime/`](../framework/runtime)
- [`templates/`](../templates)

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
