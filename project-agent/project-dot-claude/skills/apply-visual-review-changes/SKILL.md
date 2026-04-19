---
name: apply-visual-review-changes
description: Read the canonical visual review issue file and implement the requested non-narrative visual changes. Use when visual review issues need to be applied.
user-invocable: false
---

Read `.claude/AGENTS.md` first, then `.claude/CLAUDE.md` for Claude-specific helper guidance.

Then:
- read the visual-review-issues.json file in full
- treat it as the single execution brief
- determine how to map artifact-space references into project-space edits
- implement only non-narrative visual changes
- do not rerun the visual review swarm
- do not invent new review issues unless required to complete an existing fix cleanly
- keep edits focused on visual execution: theme, design, layout, density, consistency, polish, media treatment, and structural visual changes
- run `node .presentation/framework-cli.mjs audit all` after edits

When complete, report what changed and anything still unresolved.
