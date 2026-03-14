# Revise Deck Prompt

Use this when a deck workspace already exists and needs changes.

```text
Read START-HERE.md and AGENTS.md.
Run npm run setup only if dependencies are not installed yet.
Update the existing presentation project at /abs/path-to-project.

Then:
- follow AGENTS.md as the detailed source of truth for the deck contract
- convert my latest feedback into /abs/path-to-project/revisions.md
- if the deck has more than 10 slides, refresh /abs/path-to-project/outline.md first so the story still matches the slide sequence
- if the revision affects more than 5 slides, re-evaluate the per-slide design plan in the outline — check that slide patterns still vary and the variety rules from specs/slide-patterns.md are met
- revise /abs/path-to-project/theme.css plus the source slide folders under /abs/path-to-project/slides/
- add or rename slide folders with sparse numbering if a new slide belongs between two existing slides
- for decks with more than 10 slides, revise in batches of 5 and run npm run check -- --project /abs/path-to-project between batches
- use optional slide-local slide.css files only for local styling
- keep assets either deck-shared in /abs/path-to-project/assets/ or slide-local in each slide folder
- preview /preview/ and click the Export PDF button to get an updated download before finalizing
- inspect the regenerated preview, screenshots, and downloaded PDF yourself; if it still does not look presentation-ready, revise theme.css or slide-local slide.css before finalizing
- run npm run finalize -- --project /abs/path-to-project

At the end, tell me:
1. the project folder path
2. the PDF path
3. the screenshot path
4. the summary path
5. what changed
6. what still needs my decision
```
