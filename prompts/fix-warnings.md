# Fix Quality Warnings

Use this when quality warnings need to be resolved in a presentation project.

```text
Read AGENTS.md for the edit contract.

Run npm run check -- --project /abs/path-to-project

Read the QUALITY WARNINGS section of the output. For each warning:
1. Read the fix instruction carefully.
2. Edit the affected slide.html or theme.css following the fix instruction.
3. Stay within the deck contract: no inline styles, no !important, content < theme < canvas.

After fixing all warnings, run npm run check -- --project /abs/path-to-project again.

If new warnings appear, fix those too. Repeat until the check reports 0 quality warnings.

Do not skip warnings. Fix every one.

At the end, tell me:
1. how many warnings were found
2. what you changed for each one
3. whether the check now passes clean
```
