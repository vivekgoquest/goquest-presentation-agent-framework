# Presentation Framework Agent Contract

This repo is designed to be edited by AI agents, but only within a strict framework contract.

## Mission

Build and revise HTML presentation decks without breaking preview, export, capture, or the underlying design system.

## Core Rule

The cascade is enforced as:

`content < theme < canvas`

Meaning:

- `canvas` is structural and highest-priority
- `theme` inherits canvas and defines the visual system
- `content` adds deck-specific selectors and composition

Agents must not use patterns that bypass this contract.

## Default Edit Lane

When working on a deck, edit these first:

- the target `*.html` deck file
- [`css/content.css`](css/content.css)
- assets referenced by that deck
- a deck-local `@layer content` `<style>` block inside the deck HTML

## Protected Core

Do not edit these unless the task is explicitly about framework/runtime work:

- [`css/canvas.css`](css/canvas.css)
- [`css/theme-default.css`](css/theme-default.css)
- [`css/theme-alt.css`](css/theme-alt.css)
- [`js/animations.js`](js/animations.js)
- [`js/nav.js`](js/nav.js)
- [`js/counter.js`](js/counter.js)
- [`lib/`](lib)
- [`server.mjs`](server.mjs)

## Banned Authoring Patterns

- No inline `style=""` attributes
- No unlayered `<style>` blocks
- No changing `@layer content, theme, canvas`
- No redefining canvas primitives from content
- No redefining theme primitives from content

The policy validator enforces these rules during preview, capture, and export.

## Required Commands

Run these after deck edits:

1. `npm run check -- <deck.html>`
2. `npm run export -- <deck.html> /tmp/<deck-name>.pdf`

Useful inspection command:

- `npm run capture -- <deck.html> /tmp/<capture-dir>`

## Source Of Truth Docs

Read these before making non-trivial edits:

- [`specs/framework.md`](specs/framework.md)
- [`specs/tokens.md`](specs/tokens.md)
- [`specs/slide-patterns.md`](specs/slide-patterns.md)
- [`specs/authoring-rules.md`](specs/authoring-rules.md)
- [`specs/file-boundaries.md`](specs/file-boundaries.md)

## Escalation Rule

If the requested change requires editing `canvas`, `theme`, runtime code, or the validation policy, treat it as framework work and say so explicitly before making the change.
