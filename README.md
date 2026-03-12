# Goquest Presentation Agent Framework

A constrained HTML/CSS presentation framework for AI-assisted deck creation.

This repo is built for an agent harness workflow:

- agents can edit deck content quickly
- the framework protects structural and visual primitives
- preview, capture, export, and validation all run through stable Node + Playwright tooling

The goal is not just to generate slides. The goal is to let agents produce decks repeatedly without slowly breaking the framework.

## Why This Exists

Most agent-generated presentation repos drift over time because:

- inline styles bypass the design system
- every deck invents new layout primitives
- export and screenshot logic diverge
- preview works, but capture/export break
- agents do not know which files are safe to edit

This framework addresses that by combining:

- a strict cascade contract
- a policy validator
- shared Playwright runtime helpers
- agent-facing repo docs
- a single `check` command that catches structural regressions early

## Core Design Contract

The framework enforces this CSS layer order:

`content < theme < canvas`

Meaning:

- `canvas` is structural and highest-priority
- `theme` inherits canvas and defines the visual system
- `content` adds deck-specific composition

The intent is:

- `canvas` is sacrosanct
- `theme` cannot redefine canvas primitives
- `content` cannot redefine canvas or theme primitives

## What Is In The Repo

### Framework layers

- [`css/canvas.css`](css/canvas.css): structural primitives, slide sizing, grids, utilities, responsive behavior
- [`css/theme-default.css`](css/theme-default.css): default visual system, colors, typography, cards, badges
- [`css/theme-alt.css`](css/theme-alt.css): alternate theme implementation
- [`css/content.css`](css/content.css): deck-specific additions layer

### Runtime and validation

- [`server.mjs`](server.mjs): local preview server with live reload and PDF export endpoint
- [`lib/deck-policy.js`](lib/deck-policy.js): hard validation for deck source rules
- [`lib/deck-runtime.js`](lib/deck-runtime.js): shared Playwright page-prep and slide discovery helpers
- [`lib/deck-capture.mjs`](lib/deck-capture.mjs): screenshot + structured deck capture
- [`lib/pdf-export.js`](lib/pdf-export.js): deterministic PDF export from slide screenshots
- [`lib/check-deck.mjs`](lib/check-deck.mjs): validation-oriented capture check

### Authoring examples

- [`template.html`](template.html): starter deck
- [`demo.html`](demo.html): richer example deck
- [`verify-deck.md`](verify-deck.md): multi-agent verification workflow prompt

### Agent guidance

- [`AGENTS.md`](AGENTS.md): editing contract for AI harnesses
- [`specs/`](specs): repo-local source-of-truth docs for structure, tokens, patterns, and boundaries

## Policy Rules

Decks are rejected if they violate the authoring contract.

Current hard checks include:

- required layer declaration must be `@layer content, theme, canvas;`
- no inline `style=""` attributes
- no unlayered `<style>` blocks

These checks run in:

- preview
- capture
- export

That means an invalid deck fails early instead of producing brittle downstream behavior.

## Install

```bash
npm install
```

## Commands

### Start the preview server

```bash
npm run start
```

This launches the local dev server and gives you:

- deck listing at `/`
- live reload for HTML/CSS/JS edits
- `POST /api/export` for PDF generation

### Export a deck to PDF

```bash
npm run export -- demo.html /tmp/demo.pdf
```

### Capture screenshots and a structured report

```bash
npm run capture -- demo.html /tmp/demo-capture
```

Outputs include:

- `report.json`
- per-slide PNG screenshots
- one full-page PNG

### Run the framework check

```bash
npm run check -- demo.html
```

This currently fails on:

- policy violations
- browser console errors during capture
- slide overflow
- zero discovered slides

## Deck Authoring Model

Each slide should be authored as:

```html
<section id="intro" data-slide>
  <div class="slide">
    ...
  </div>
</section>
```

Supported slide roots:

- `.slide`
- `.slide.slide-hero`
- `.slide-wide`

Preferred composition primitives:

- `.g2`
- `.g3`
- `.g4`
- `.icard`
- `.tkwy`
- `[data-count]` stat counters

## How Agents Should Work In This Repo

Default edit lane:

- target deck `*.html`
- `css/content.css`
- deck-local `@layer content` style blocks
- assets used by the deck

Protected by default:

- `css/canvas.css`
- `css/theme-default.css`
- `css/theme-alt.css`
- `lib/`
- `server.mjs`
- framework JS files

If an agent needs to edit protected files, that should be treated as framework work, not ordinary deck work.

## Recommended Harness Workflow

For an agent harness, the most reliable loop is:

1. Read [`AGENTS.md`](AGENTS.md)
2. Read the docs in [`specs/`](specs)
3. Edit only deck-surface files unless the task explicitly requires framework work
4. Run `npm run check -- <deck.html>`
5. Run `npm run export -- <deck.html> /tmp/<deck>.pdf`

That gives you prompt guidance plus code-level enforcement.

## Why This Is Better Than Skill-Only Guidance

A skill or system prompt is useful, but not sufficient by itself.

This repo keeps the source of truth in code and repo-local docs:

- prompts tell agents what to do
- validators reject invalid patterns
- shared runtime helpers keep export/capture behavior aligned

That combination is more stable than relying on prompt discipline alone.

## Verification Workflow

For deeper QA, use the capture output directly or follow the review flow in [`verify-deck.md`](verify-deck.md).

The framework is designed so multi-agent review can analyze:

- screenshots
- layout integrity
- copy quality
- consistency
- overflow
- structured extracted data

## Public Repo Notes

This repository is intended to be safe for public sharing:

- machine-specific paths are not required for normal usage
- runtime entrypoints are standard Node scripts
- `node_modules` and generated PDFs are ignored

## Next Good Additions

If you want to extend this framework further, the highest-leverage next steps are:

- move decks into `decks/<name>/`
- add screenshot snapshots for regression testing
- add stricter selector protection in the policy validator
- add a deck manifest format for richer harness automation
