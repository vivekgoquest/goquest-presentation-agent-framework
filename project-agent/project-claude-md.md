# Presentation Project Agent Contract

This project is a presentation built with the Presentation Framework. Follow these rules when editing deck content.

## Default Workflow

1. Read the rules in `.claude/rules/` for framework architecture and authoring constraints.
2. Prefer `npm run new -- --project /abs/path` if the project does not exist. Use `--copy-framework` only when the project needs a vendored framework snapshot.
3. Normalize the user's request into `brief.md`.
4. If the deck needs more than 10 slides, scaffold with `npm run new -- --project /abs/path --slides <count>` and lock the story in `outline.md` before slide buildout.
5. **Design the theme first.** Finalize `theme.css` with the full visual system — palette, typography, component styles — before writing any slide HTML.
6. **Design each slide.** For every slide in the outline, decide how it will look — which structural primitives to use, how it differs from its neighbors, and whether images are needed. Do not start building slide HTML until every slide has a design decision.
7. Build or revise source slides in `slides/<NNN-id>/slide.html`.
8. Keep reusable deck styling in `theme.css`.
9. Keep slide-specific CSS in optional `slides/<NNN-id>/slide.css`.
10. Keep assets deck-shared in `assets/` or slide-local in `slides/<NNN-id>/assets/`.
11. For decks with more than 10 slides, build in batches of 5 and run `npm run check -- --project .` after each batch.
12. Inspect the preview yourself. If it does not read like a presentation yet, revise `theme.css` and optional slide-local `slide.css` before finalizing.
13. Run `npm run finalize -- --project .`
14. Report the exact output paths in `outputs/`.

## Core Rule

The cascade is enforced as: `content < theme < canvas`

- `framework/canvas/` is structural and highest-priority
- deck-local `theme.css` inherits canvas and defines the visual system
- slide content plus optional slide-local `slide.css` add only local composition

Do not use patterns that bypass this contract.

## Default Edit Lane

Edit these first:
- `theme.css`
- `outline.md` for decks with more than 10 slides
- `slides/<NNN-id>/slide.html`
- optional `slides/<NNN-id>/slide.css`
- `brief.md`
- shared assets inside `assets/`
- slide-local assets inside `slides/<NNN-id>/assets/`

Use sparse numbering such as `010`, `020`, `030` so a later insertion can become `025-case-study` without renumbering.

## Banned Authoring Patterns

- no inline `style=""` attributes
- no raw `<style>` blocks inside slide fragments
- no changing `@layer content, theme, canvas`
- no `!important` in deck `theme.css` or slide-local `slide.css`
- no theme overrides of protected canvas selectors
- no slide CSS selectors that are not scoped to the generated `#<slide-id>`
- no slide CSS that styles another slide's root or escapes its own slide scope
- no slide CSS that restyles theme primitives with colors, typography, borders, or shadows
- no full-document wrappers, `<section data-slide>`, or outer `<body>` tags inside `slide.html`
- no root-relative or cross-workspace asset paths

## Required Commands

- `npm run check -- --project .`
- `npm run finalize -- --project .`
- `npm run capture -- --project . /tmp/<capture-dir>`
- `npm run export -- --project . /tmp/<deck-name>.pdf`

## What The Agent Must Hand Back

1. the project folder path
2. the PDF path
3. the screenshot directory
4. the summary path
5. what changed
6. any issues that still need the user's decision

## Available Skills

Type `/new-deck`, `/revise-deck`, `/review-deck`, `/review-deck-swarm`, or `/fix-warnings` for guided workflows.
