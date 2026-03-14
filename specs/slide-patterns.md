# Slide Patterns

## Source Model

In the slide-folder workflow, each slide lives in its own source folder:

- `slides/<NNN-slide-id>/slide.html`
- optional `slides/<NNN-slide-id>/slide.css`
- optional `slides/<NNN-slide-id>/assets/`

Rules:

- `slide.html` contains exactly one slide root fragment
- do not include outer `<section data-slide>` wrappers; runtime generates them
- the stable slide id comes from the folder slug after the numeric prefix
- if local CSS is needed, scope it to the generated `#<slide-id>`

## Slide Modes

There are two slide modes. Design decisions happen within these constraints.

**`.slide`** — light background, dark text. Used for most content.

**`.slide.slide-hero`** — dark background, light text. Used for opening, closing, and narrative punctuation slides that break the rhythm.

## Available Structural Primitives

The agent composes slides using these canvas primitives. The design challenge is choosing the right combination for each slide — not repeating the same combination on every slide.

- `.g2`, `.g3`, `.g4` — column grids
- `.flex`, `.flex-col`, `.flex-center`, `.flex-between` — flex layouts
- `table` — structured data comparisons
- `.icard` — information card container
- `.stat-card` + `.stat-value` + `.stat-label` — numeric metric display
- `.badge` variants — category labels
- `.tkwy` — callout / takeaway block
- `.img-round`, `.img-circle` — image utilities
- `.max-w-550`, `.max-w-600`, `.max-w-650` — text width constraints
- spacing: `.mt-*`, `.mb-*`, `.gap-*`

## Design Responsibility

The framework provides structure. The agent provides design. Before writing slide HTML:

1. The agent must finalize the theme — the complete visual system in `theme.css`.
2. The agent must decide how each slide will look — which primitives to combine, what visual rhythm to create across the deck, and where images are needed.

These are creative decisions, not template selections. The agent should design each slide to serve its content, not stamp the same layout on every slide.

## Design Quality Rules

- vary the primary content block across slides — a deck of 20 slides using `.g3` of `.icard` on every content slide has failed as a design
- `.stat-card` is for numbers — do not use it for names, roles, or text labels
- team slides should show people, not stat-cards with job titles
- use images (`.img-round`, `.img-circle`, assets) where they serve the content — team headshots, product screenshots, diagrams
- tables, takeaway blocks, narrative text, and grids are all valid primary content — use the one that fits the slide's message
- if a deck has 20 slides, the agent should be able to explain why each slide looks different from its neighbors

## Pattern Rules

- one main idea per slide
- avoid crowded mixed layouts
- prefer existing primitives over custom structures
- if a layout pattern repeats across decks, promote it intentionally instead of improvising it repeatedly
- prefer sparse folder numbering so new slides can be inserted without renumbering the whole deck
