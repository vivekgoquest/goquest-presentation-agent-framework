---
name: fix-validation-issues
description: Fix deterministic validation failures in a presentation project. Use when npm run check reports validation failures that need resolving.
user-invocable: true
---

Read AGENTS.md first, then CLAUDE.md for Claude-specific workflow help.
If the launcher prompt includes application-prepared workflow context, treat it
as the canonical fix-validation workflow and use this skill only as execution guidance.

Run node .presentation/framework-cli.mjs check

Read the validation failures carefully. For each failure:
1. Identify the specific source file or rendered contract issue involved.
2. Edit the affected slide.html, slide.css, theme.css, or other deck source to resolve it.
3. Stay within the deck contract: no inline styles, no !important, content < theme < canvas.

After fixing the current failures, run node .presentation/framework-cli.mjs check again.

If new validation failures appear, fix those too. Repeat until the check passes cleanly.

Do not skip failures. Resolve every deterministic validation issue.

At the end, tell me:
1. how many validation failures were found
2. what you changed for each one
3. whether the check now passes clean
