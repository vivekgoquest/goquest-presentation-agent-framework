---
name: new-deck
description: Create a new presentation from a plain-English request. Use when the user wants to build a new deck from scratch.
user-invocable: true
---

Read CLAUDE.md for the deck contract.
Run npm run setup if dependencies are not installed yet.
Create a new presentation project for this request.
Choose a good absolute folder path and run:
npm run new -- --project /abs/path-to-project
If the deck needs more than 10 slides, run:
npm run new -- --project /abs/path-to-project --slides <count>
If the project needs a vendored framework snapshot, add:
--copy-framework

Then:
- follow CLAUDE.md as the detailed source of truth for the deck contract
- convert my request into /abs/path-to-project/brief.md
- for decks with more than 10 slides, replace every TODO marker in /abs/path-to-project/outline.md before building slides
- design the theme first: finalize /abs/path-to-project/theme.css with the full visual system (palette, typography, components) before writing any slide HTML
- design each slide: for every slide in the outline, decide how it will look — which primitives, how it differs from neighbors, whether it needs images; record design notes in the outline
- do not start building slide HTML until the theme is finalized and every slide in the outline has a design decision
- build the source slides in /abs/path-to-project/slides/<NNN-id>/slide.html following the per-slide design decisions
- for decks with more than 10 slides, build in batches of 5 and run npm run check -- --project /abs/path-to-project after each batch
- use optional /abs/path-to-project/slides/<NNN-id>/slide.css only when a slide needs local CSS
- keep assets either deck-shared in /abs/path-to-project/assets/ or slide-local in each slide folder
- keep framework changes out of scope unless truly necessary
- inspect the preview, screenshots, and downloaded PDF yourself; if it does not read like a presentation yet, revise theme.css or slide-local slide.css before finalizing
- run npm run finalize -- --project /abs/path-to-project

At the end, tell me:
1. the project folder path
2. whether the project is linked or copied mode
3. the PDF path
4. the screenshot path
5. the summary path
6. any open questions that still affect the deck
