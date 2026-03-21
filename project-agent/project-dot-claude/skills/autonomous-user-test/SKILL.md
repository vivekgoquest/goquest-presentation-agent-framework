---
name: autonomous-user-test
description: Test the presentation framework like a real operator using the Electron UI, terminal pane, preview surface, and Export PDF flow. Use for end-to-end user-surface validation.
user-invocable: true
---

You are running an autonomous user test of the presentation framework.

Stay inside real user surfaces:
- the Electron desktop app
- the terminal pane
- the preview surface
- downloaded artifacts

Do not:
- patch source files directly
- call runtime modules directly
- bypass the preview or export UI

## Roles

Use these roles:
1. Outer simulator agent
   - behaves like a human operator in the desktop app
   - launches the inner builder agent in the terminal pane
   - watches the preview and clicks Export PDF
   - never edits files directly
2. Inner builder agent
   - builds or revises the presentation
   - follows `START-HERE.md` and `AGENTS.md`
3. Judge agent (optional)
   - reviews the resulting preview, PDF, screenshots, and summary
   - reports only user-visible issues

## Recommended scenarios

Run the relevant scenario for the current task:
- `new-linked`
- `new-copied`
- `long-deck`
- `revision`
- `policy-failure`
- `export-only`

## What to measure

Record:
- time to loaded Electron shell
- time to first live preview
- time to first successful check
- time to exported PDF
- whether the agent stalled
- whether preview showed a policy error
- whether outputs landed in the correct `outputs/` folder
- whether the final PDF reads like a presentation
- any user-facing confusion or friction

## Pass criteria

A run passes only if:
- the outer simulator stayed inside the UI and terminal surfaces
- the inner agent completed without hidden filesystem shortcuts
- the preview hot reloaded during the run
- the Export PDF button worked
- outputs landed inside the project folder `outputs/`
- the final PDF is structurally a presentation
- any failures were visible through the product UI

## Baseline harness

Before agent-on-agent runs, use:

```bash
node --test electron/__tests__/app-smoke.test.mjs
```

What it verifies:
- Electron shell boots
- terminal pane becomes live
- terminal is rooted to the project folder
- project creation through preload bridge works

## Reporting

At the end, report:
1. project path
2. scenario name
3. linked vs copied mode
4. console artifact directory
5. exported PDF path
6. outputs path
7. pass/fail
8. user-facing failures
9. remaining open risks
