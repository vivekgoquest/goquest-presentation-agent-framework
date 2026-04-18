# {{DECK_TITLE}} Outline

Long decks must lock the story before slide-by-slide buildout.

Replace every `[[TODO_...]]` marker below before preview, audit, export, or finalize.

## Story Arc

- Opening: [[TODO_OUTLINE_OPENING]]
- Middle: [[TODO_OUTLINE_MIDDLE]]
- Close: [[TODO_OUTLINE_CLOSE]]

## Build Plan

- Total slides: {{SLIDE_COUNT}}
- Batch size: {{SLIDE_BATCH_SIZE}}
- Build the deck in batches of {{SLIDE_BATCH_SIZE}} slides and run `node .presentation/framework-cli.mjs audit all` after each batch.

## Slide Plan

Each slide must include a design note describing how it will look — which structural primitives it will use and why it differs from its neighbors. Do not start writing slide HTML until every row has a design decision.

{{SLIDE_PLAN}}
