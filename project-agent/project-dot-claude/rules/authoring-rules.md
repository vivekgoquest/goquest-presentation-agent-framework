# Authoring Rules

## Allowed

- edit slide source HTML in `slides/<NNN-slide-id>/slide.html`
- set deck-local reusable styling in `theme.css`
- add slide-scoped selectors in optional `slides/<NNN-slide-id>/slide.css`
- add `outline.md` for decks with more than 10 slides
- update `.presentation/intent.json` with audience, objective, narrative notes, and per-slide purpose
- use existing canvas utility classes
- add deck-shared assets in `assets/` or slide-local assets in `slides/<NNN-slide-id>/assets/`

## Not Allowed

- bypassing `/preview/` and editing hand-written HTML outside the slide folders
- inline `style=""`
- raw `<style>` blocks inside slide fragments
- outer `<html>`, `<head>`, `<body>`, or `<section data-slide>` wrappers inside `slide.html`
- changing `@layer content, theme, canvas`
- `!important` in deck `theme.css` or slide-local `slide.css`
- theme rules that redefine protected canvas selectors
- slide CSS that is not scoped to its generated `#<slide-id>`
- slide CSS that escapes its own slide or targets another slide
- slide CSS that redefine theme primitives with colors, typography, borders, or shadows
- root-relative, sibling-slide, or cross-workspace asset references
- editing `.presentation/package.generated.json` directly
- editing `.presentation/runtime/*.json` directly

## Verification Workflow

After meaningful deck changes, prefer:

1. `node .presentation/framework-cli.mjs finalize`

Optional lower-level commands:

- `node .presentation/framework-cli.mjs check`
- `node .presentation/framework-cli.mjs capture /tmp/<capture-dir>`
- `node .presentation/framework-cli.mjs export /tmp/<deck-name>.pdf`

## What `check` Enforces

The repo check currently fails on:

- policy violations across slide source files, `theme.css`, optional `slide.css`, and the rendered HTML
- browser console errors during capture
- page runtime errors during capture
- overflow detected on slides
- decks with zero discovered slides

## Authoring Heuristics For Agents

- generated structure is deterministic: the hook regenerates `.presentation/package.generated.json` from source on every clean stop
- runtime evidence is read-only: `.presentation/runtime/*.json` is owned by the framework, not by deck edits
- prefer deck-local theme variables over one-off visual hacks
- for decks with more than 10 slides, lock the story in `outline.md` before slide-by-slide buildout
- for decks with more than 10 slides, build in batches of 5 and run `node .presentation/framework-cli.mjs check` after each batch
- prefer optional `slide.css` only when markup plus theme primitives are not enough
- keep slide-local selectors scoped to the generated slide id
- prefer semantic copy structure over visual hacks
- if a change seems to require editing `framework/canvas/`, stop and confirm it is framework work
- default new work to a project folder path (`/abs/path`) instead of inventing new top-level structures
