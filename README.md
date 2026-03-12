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

## Quick Start

The simplest way to use the framework is:

1. Copy [`template.html`](template.html) to a new deck file such as `my-deck.html`
2. Replace the placeholder copy with your actual presentation content
3. Add any deck-specific selectors inside a deck-local `@layer content` `<style>` block or in [`css/content.css`](css/content.css)
4. Preview the deck with `npm run start`
5. Validate it with `npm run check -- my-deck.html`
6. Export it with `npm run export -- my-deck.html /tmp/my-deck.pdf`

If you are using an AI agent, have the agent read [`AGENTS.md`](AGENTS.md) and the docs in [`specs/`](specs) before it starts editing.

## How To Use The Framework

### Typical authoring workflow

Use this when building or revising a deck by hand or with an agent:

1. Start from [`template.html`](template.html) or duplicate an existing deck
2. Keep the slide structure as `<section id="..." data-slide><div class="slide">...</div></section>`
3. Reuse the existing primitives:
   - `.slide`, `.slide-hero`, `.slide-wide`
   - `.g2`, `.g3`, `.g4`
   - `.icard`
   - `.tkwy`
   - `[data-count]`
4. Keep deck-specific styling in `@layer content`
5. Do not add inline styles
6. Run `check` before `export`

### Where to make changes

For normal deck work, prefer editing:

- the target deck HTML file
- [`css/content.css`](css/content.css)
- deck-local `@layer content` style blocks
- deck assets in [`assets/`](assets)

Avoid editing framework files unless you are intentionally changing the system:

- [`css/canvas.css`](css/canvas.css)
- [`css/theme-default.css`](css/theme-default.css)
- [`css/theme-alt.css`](css/theme-alt.css)
- [`lib/`](lib)
- [`server.mjs`](server.mjs)

## Commands

### Start the preview server

```bash
npm run start
```

This launches the local dev server and gives you:

- deck listing at `/`
- live reload for HTML/CSS/JS edits
- `POST /api/export` for PDF generation

Open the deck in the browser from the index page or directly via:

```bash
http://localhost:3000/demo.html
```

### Export a deck to PDF

```bash
npm run export -- demo.html /tmp/demo.pdf
```

You can also export from the browser UI:

1. run `npm run start`
2. open the deck in the browser
3. click `Export to PDF`

Use the CLI export in automation or agent harnesses. Use the browser export when iterating manually.

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

## Practical Usage Patterns

### Create a new deck

```bash
cp template.html investor-update.html
npm run start
npm run check -- investor-update.html
npm run export -- investor-update.html /tmp/investor-update.pdf
```

### Iterate with an agent

Use this loop:

1. tell the agent which deck file to edit
2. tell it to read [`AGENTS.md`](AGENTS.md)
3. tell it to stay in the default edit lane unless framework work is explicitly requested
4. require it to run:
   - `npm run check -- <deck.html>`
   - `npm run export -- <deck.html> /tmp/<deck>.pdf`

### Review what the agent produced

If the deck feels off, run:

```bash
npm run capture -- <deck.html> /tmp/<deck>-capture
```

Then inspect:

- `report.json`
- per-slide PNGs
- the exported PDF

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

## How To Steer Claude Code, Codex, Or Another Agent

The best steering is explicit and operational. Do not just say “make a deck.” Give the agent:

- the target deck file
- the audience
- the purpose of the deck
- the source material or constraints
- the output requirements
- the repo rules

### Good steering pattern

Use instructions shaped like this:

```text
Read AGENTS.md and specs/ first.
Edit only my-deck.html and css/content.css unless framework work is truly required.
Build a 6-slide deck for enterprise buyers.
Use the existing slide primitives and keep all deck-specific styling in @layer content.
Do not use inline styles.
When done, run:
- npm run check -- my-deck.html
- npm run export -- my-deck.html /tmp/my-deck.pdf
Summarize what changed and whether the checks passed.
```

### Prompt template for Codex

```text
Read AGENTS.md and specs/ before editing.
Update demo.html into a buyer pitch for [audience].
Preserve the framework contract: content < theme < canvas.
Do not edit canvas/theme/runtime files unless you must, and if you must, say why first.
Use existing slide primitives.
No inline styles.
Run npm run check -- demo.html and npm run export -- demo.html /tmp/demo.pdf before finishing.
```

### Prompt template for Claude Code

```text
Work inside this repository as an agent authoring a presentation deck.
Start by reading AGENTS.md and the specs docs.
Edit only the deck file and content-layer styles unless the task explicitly requires framework work.
Create or revise [deck.html] for [audience] with [goal].
Reuse the framework primitives rather than inventing new ones.
After editing, run npm run check -- [deck.html] and npm run export -- [deck.html] /tmp/[deck].pdf.
Report the final validation results and any framework-level concerns.
```

### Prompt template for other harnessed agents

```text
Repository contract:
- read AGENTS.md
- read specs/
- edit only deck-surface files by default
- no inline styles
- no unlayered style blocks
- preserve @layer content, theme, canvas

Task:
[describe the deck, audience, and purpose]

Required verification:
- npm run check -- [deck.html]
- npm run export -- [deck.html] /tmp/[deck].pdf
```

### What to tell the agent when you want framework work

If you actually want the system changed, say that explicitly. For example:

```text
This is framework work, not just deck work.
You may edit canvas/theme/runtime files if needed.
Please explain the invariant you are changing, update AGENTS.md/specs if needed, and rerun check/export on the example decks.
```

### What not to tell the agent

Avoid vague instructions like:

- “make it nicer”
- “redesign everything”
- “just do whatever is needed”

Those tend to encourage drift. Better prompts anchor the target file, audience, constraints, and required verification.

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
