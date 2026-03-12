# File Boundaries

## Default Editable Files

Agents should assume these are safe to edit for deck work:

- target deck `*.html`
- [`css/content.css`](../css/content.css)
- images and other assets used by the deck

## Shared Framework Files

These affect every deck and should be treated as protected unless the task is explicitly framework-level:

- [`css/canvas.css`](../css/canvas.css)
- [`css/theme-default.css`](../css/theme-default.css)
- [`css/theme-alt.css`](../css/theme-alt.css)
- [`js/`](../js)
- [`lib/`](../lib)
- [`server.mjs`](../server.mjs)

## Escalation Examples

These are framework tasks, not normal deck edits:

- changing slide dimensions or responsive behavior
- changing grid semantics
- changing how export or capture prepares the page
- changing the deck validation policy
- changing default badge/card/type primitives

## Safe Deck-Level Examples

These are normal deck edits:

- replacing copy in a slide
- adding a new slide section using existing primitives
- adding deck-specific selectors in `@layer content`
- swapping assets referenced by the deck
