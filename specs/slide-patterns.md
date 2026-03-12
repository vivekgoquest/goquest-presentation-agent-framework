# Slide Patterns

## Hero Slide

Use when opening or closing a deck.

Pattern:

- section with `data-slide` and stable `id`
- root element: `.slide.slide-hero`
- eyebrow
- hero title
- supporting paragraph
- optional stat row or CTA row

## Standard Content Slide

Use for one main message with supporting content.

Pattern:

- root element: `.slide`
- eyebrow
- section title
- one primary content block beneath the title

Good content blocks:

- `.g2`
- `.g3`
- `.g4`
- `table`
- `.tkwy`
- one supporting image or chart area

## Grid Feature Slide

Use for grouped concepts or categories.

Pattern:

- `.g3` for three parallel concepts
- `.g2` for paired explanation + visual
- `.icard` for each grouped item

## Data / Overview Slide

Use for specs, metrics, or comparisons.

Pattern:

- `table` for compact facts
- optional `.tkwy` for the one takeaway that matters
- optional stat cards if a few metrics need emphasis

## Closing Slide

Use for next steps.

Pattern:

- `.slide.slide-hero`
- simple CTA
- contact or handoff detail
- optional badge / metadata row

## Pattern Rules

- one main idea per slide
- avoid crowded mixed layouts
- prefer existing primitives over custom structures
- if a layout pattern repeats across decks, promote it intentionally instead of improvising it repeatedly
