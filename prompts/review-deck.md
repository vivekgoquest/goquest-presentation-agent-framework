# Review Deck Prompt

Use this when you want the agent to inspect an existing deck and prepare a revision plan.

```text
Read START-HERE.md and AGENTS.md.
Run npm run setup only if dependencies are not installed yet.
Review the presentation project at /abs/path-to-project.

- follow AGENTS.md as the detailed source of truth for the deck contract
- inspect the current theme, slide folders, brief, revisions, and latest outputs
- if the deck has more than 10 slides, inspect outline.md first and verify the slide sequence still matches it
- preview /preview/ to see the regenerated deck and use the Export PDF button if you need a quick download
- inspect the preview, screenshots, and downloaded PDF yourself and decide whether the deck already reads like a presentation or still needs CSS revision
- run npm run finalize -- --project /abs/path-to-project if fresh outputs are needed
- summarize the deck quality, weak points, and revision opportunities
- if I asked for changes, convert them into /abs/path-to-project/revisions.md

At the end, tell me:
1. the current project folder path
2. the current PDF path
3. the summary path
4. the top issues or opportunities
5. the exact revision plan you recommend
```
