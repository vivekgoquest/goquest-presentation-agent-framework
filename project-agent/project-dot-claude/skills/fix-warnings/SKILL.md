---
name: fix-warnings
description: Fix quality warnings in a presentation project. Use when npm run check reports warnings that need resolving.
user-invocable: true
---

Read AGENTS.md first, then CLAUDE.md for Claude-specific workflow help.
If the launcher prompt includes application-prepared workflow context, treat it
as the canonical fix-warnings workflow and use this skill only as execution guidance.

Run node .presentation/framework-cli.mjs check

Read the QUALITY WARNINGS section of the output. For each warning:
1. Read the fix instruction carefully.
2. Edit the affected slide.html or theme.css following the fix instruction.
3. Stay within the deck contract: no inline styles, no !important, content < theme < canvas.

After fixing all warnings, run node .presentation/framework-cli.mjs check again.

If new warnings appear, fix those too. Repeat until the check reports 0 quality warnings.

Do not skip warnings. Fix every one.

At the end, tell me:
1. how many warnings were found
2. what you changed for each one
3. whether the check now passes clean
