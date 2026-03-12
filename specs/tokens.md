# Tokens Spec

## Principle

Deck authors should consume framework tokens and utility classes, not redefine them ad hoc.

## Theme-Owned Tokens

The theme layer owns the visual token system, including:

- accent and semantic colors
- card/background colors
- text colors
- shadows
- radii
- font family
- logo slots

Examples live in:

- [`css/theme-default.css`](../css/theme-default.css)
- [`css/theme-alt.css`](../css/theme-alt.css)

## Canvas-Owned Tokens

The canvas layer owns structural tokens, including:

- `--slide-max-w`
- `--slide-ratio`
- `--slide-gap`
- grid gaps
- padding tokens

These are structural and should not be changed during normal deck authoring.

## Preferred Consumption Pattern

Use:

- existing utility classes from canvas
- semantic classes from theme
- CSS variables already defined by theme/canvas

Avoid:

- hard-coded inline values
- redefining token names in content
- creating one-off layout behavior that conflicts with framework primitives

## If A New Token Is Needed

Use this escalation path:

1. check whether an existing utility or token already solves it
2. if it is deck-specific, add a deck-specific selector in `@layer content`
3. if it is reusable across decks, propose a framework/theme update explicitly
