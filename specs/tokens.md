# Tokens Spec

## Principle

Deck authors should consume framework primitives and deck-local tokens instead of inventing ad hoc global styles.

## Theme-Owned Tokens

Each deck's `theme.css` owns the visual token system, including:

- accent and semantic colors
- card and background colors
- text colors
- shadows
- radii
- font family
- canvas visual variables such as hero backgrounds, export colors, and logo assets

See:

- [`templates/theme.css`](../templates/theme.css)
- [`examples/template/theme.css`](../examples/template/theme.css)
- [`examples/demo/theme.css`](../examples/demo/theme.css)

## Canvas-Owned Tokens

The canvas layer owns structural tokens and protected selectors, including:

- `--slide-max-w`
- `--slide-wide-max-w`
- `--slide-ratio`
- `--slide-gap`
- grid gaps
- padding tokens

These are structural and should not be changed during normal deck authoring.

## Preferred Consumption Pattern

Use:

- existing utility classes from canvas
- semantic classes from the deck's theme
- deck-local CSS variables already defined by `theme.css`

Avoid:

- hard-coded inline values
- redefining canvas selectors from theme or slide-local CSS
- creating one-off layout behavior that conflicts with framework primitives

## If A New Token Is Needed

Use this escalation path:

1. check whether an existing canvas utility or theme token already solves it
2. if it is deck-specific and reusable within one deck, add it to that deck's `theme.css`
3. if it is slide-specific, keep it in optional `slides/<NNN-slide-id>/slide.css` and scope it to that slide's generated `#<slide-id>`
4. if it should be shared across many decks, propose a framework update explicitly
