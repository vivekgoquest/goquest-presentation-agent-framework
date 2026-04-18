---
name: apply-visual-review-changes
description: Read the canonical visual review issue file and implement the requested non-narrative visual changes. Use when the application invokes apply_visual_review_changes.
user-invocable: false
---

Read .claude/AGENTS.md first, then .claude/CLAUDE.md for Claude-specific workflow help.
If the launcher prompt includes application-prepared workflow context, treat it
as the canonical apply workflow and use this skill only as execution guidance.

Then:
- read the visual-review-issues.json file in full
- treat it as the single execution brief
- determine how to map artifact-space references into project-space edits
- implement only non-narrative visual changes
- do not rerun the visual review swarm
- do not invent new review issues unless required to complete an existing fix cleanly
- keep edits focused on visual execution: theme, design, layout, density, consistency, polish, media treatment, and structural visual changes
- run the normal deterministic validation flow after edits

When complete, report what changed and anything still unresolved.
