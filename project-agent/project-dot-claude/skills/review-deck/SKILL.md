---
name: review-deck
description: Inspect an existing presentation and prepare a revision plan. Use when the user wants to review a deck before making changes.
user-invocable: true
---

Read AGENTS.md first, then CLAUDE.md for Claude-specific workflow help.
If the launcher prompt includes application-prepared workflow context, treat it
as the canonical review workflow and use this skill only as execution guidance.
Run npm run setup only if dependencies are not installed yet.
Review the presentation project at /abs/path-to-project.

- follow AGENTS.md as the project contract and CLAUDE.md as the Claude adapter
- inspect the current theme, slide folders, brief, and latest outputs
- if the deck has more than 10 slides, inspect outline.md first and verify the slide sequence still matches it
- inspect the preview, screenshots, and downloaded PDF yourself and decide whether the deck already reads like a presentation or still needs CSS revision
- run node .presentation/framework-cli.mjs finalize if fresh outputs are needed
- summarize the deck quality, weak points, and revision opportunities
- if I asked for changes, provide the revision plan directly in your response

At the end, tell me:
1. the current project folder path
2. the current PDF path
3. the summary path
4. the top issues or opportunities
5. the exact revision plan you recommend
