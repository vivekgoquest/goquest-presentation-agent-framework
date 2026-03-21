---
name: review-deck
description: Inspect an existing presentation and prepare a revision plan. Use when the user wants to review a deck before making changes.
user-invocable: true
---

Read CLAUDE.md for the deck contract.
Run npm run setup only if dependencies are not installed yet.
Review the presentation project at /abs/path-to-project.

- follow CLAUDE.md as the detailed source of truth for the deck contract
- inspect the current theme, slide folders, brief, and latest outputs
- if the deck has more than 10 slides, inspect outline.md first and verify the slide sequence still matches it
- inspect the preview, screenshots, and downloaded PDF yourself and decide whether the deck already reads like a presentation or still needs CSS revision
- run npm run finalize -- --project /abs/path-to-project if fresh outputs are needed
- summarize the deck quality, weak points, and revision opportunities
- if I asked for changes, provide the revision plan directly in your response

At the end, tell me:
1. the current project folder path
2. the current PDF path
3. the summary path
4. the top issues or opportunities
5. the exact revision plan you recommend
