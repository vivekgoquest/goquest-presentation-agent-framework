# Authoring Rules

## Allowed

- edit deck HTML content
- add deck-specific selectors in `@layer content`
- use existing canvas utility classes
- use existing theme classes and tokens
- add assets referenced by the deck

## Not Allowed

- inline `style=""`
- unlayered `<style>` blocks
- changing `@layer content, theme, canvas`
- content rules that redefine canvas primitives
- content rules that redefine theme primitives

## Verification Workflow

After meaningful changes, run:

1. `npm run check -- <deck.html>`
2. `npm run export -- <deck.html> /tmp/<deck-name>.pdf`

Optional:

- `npm run capture -- <deck.html> /tmp/<capture-dir>`

## What `check` Enforces

The repo check currently fails on:

- policy violations
- browser console errors during capture
- overflow detected on slides
- decks with zero discovered slides

## Authoring Heuristics For Agents

- prefer adding classes over adding new primitives
- prefer semantic copy structure over visual hacks
- if a change seems to require editing `canvas.css`, stop and confirm it is framework work
- if a change seems to require editing `theme-*.css`, treat it as shared visual-system work, not deck-only work
