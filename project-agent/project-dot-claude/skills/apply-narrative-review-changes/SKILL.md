---
name: apply-narrative-review-changes
description: Read the canonical narrative review issue file and implement the requested message and content changes. Use when the application invokes apply_narrative_review_changes.
user-invocable: false
---

Read .claude/AGENTS.md first, then .claude/CLAUDE.md for Claude-specific workflow help.
If the launcher prompt includes application-prepared workflow context, treat it
as the canonical apply workflow and use this skill only as execution guidance.

Then:
- read the narrative-review-issues.json file in full
- treat it as the single execution brief
- determine how to map artifact-space references into project-space edits
- implement only narrative and message changes
- do not rerun the narrative review swarm
- do not invent new review issues unless required to complete an existing fix cleanly
- keep edits focused on thesis clarity, audience fit, claim framing, evidence framing, sequencing, transitions, objection handling, and the close or ask
- keep visual and layout changes minimal and only when needed to support revised narrative content
- run the normal deterministic validation flow after edits

When complete, report what changed and anything still unresolved.
