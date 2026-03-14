# Autonomous User Testing

This framework should be tested the way a real operator uses it:

- through the operator console at `/`
- through the preview route shown in the iframe
- through the terminal pane
- through the preview Export PDF button

Do not treat direct file edits or direct runtime calls as user testing.

## Core Model

Use three roles:

1. **Outer simulator agent**
   - behaves like a human using the console
   - opens the operator console in a browser
   - launches the inner agent in the terminal pane
   - watches the preview and clicks Export PDF
   - never edits files directly

2. **Inner builder agent**
   - the real worker in the terminal
   - creates or revises the presentation
   - follows `START-HERE.md` and `AGENTS.md`

3. **Judge agent** (optional)
   - reviews the resulting preview, PDF, and screenshots
   - decides whether the result reads like a presentation
   - should not build the deck

## Non-Negotiable Constraint

The outer simulator must stay inside real user surfaces:

- operator console UI
- terminal pane
- preview iframe
- downloaded artifacts

The outer simulator must not:

- patch source files directly
- call runtime modules directly
- bypass the preview and export UI

If it uses those shortcuts, it is no longer a user test.

## Recommended Run Matrix

Run these scenarios repeatedly:

1. `new-linked`
   - new project
   - linked mode
   - 5-slide deck

2. `new-copied`
   - new project
   - copied mode
   - 5-slide deck

3. `long-deck`
   - new project
   - 20-slide deck
   - outline-first workflow

4. `revision`
   - existing project
   - revise via terminal and preview

5. `policy-failure`
   - intentionally invalid brief or asset path
   - confirm the preview shows the policy failure clearly

6. `export-only`
   - already-finished project
   - open console
   - click Export PDF without agent help

## What To Measure

For every run, record:

- time to first loaded console
- time to first live preview
- time to first successful check
- time to exported PDF
- whether the agent stalled
- whether preview showed a policy error
- whether outputs landed in the correct `outputs/` folder
- whether the final PDF reads like a presentation
- any user-facing confusion or friction

## Pass Criteria

A run passes only if:

- the outer simulator stayed inside the UI and terminal surfaces
- the inner agent completed without hidden filesystem shortcuts
- the preview hot reloaded during the run
- the preview Export PDF button worked
- outputs landed inside the project folder’s `outputs/`
- the final PDF is structurally a presentation
- any failures were visible through the product UI

## Baseline Harness

Use the built-in smoke script before agent-on-agent runs:

```bash
npm run ui-smoke -- --project /abs/path-to-project
```

What it verifies:

- the console loads
- the terminal pane becomes live
- the terminal is rooted to the project folder
- the preview iframe loads `/preview/`
- the Export PDF button downloads a PDF and writes `outputs/deck.pdf`

The smoke script saves artifacts under the project’s `outputs/ui-smoke-*` directory.

## Agent Prompting Strategy

Outer simulator prompt:

- use only the UI and terminal
- give the inner agent a plain-English request
- wait for preview changes
- click Export PDF
- record friction, failure points, and final artifacts

Inner builder prompt:

- use the normal project authoring workflow
- build or revise the deck
- finalize only after visual review

Judge prompt:

- inspect preview screenshots, PDF, and summary
- decide if the output reads like a presentation
- report only user-visible issues

## Reporting Format

Every autonomous run should produce:

- project path
- scenario name
- linked vs copied mode
- console artifact directory
- exported PDF path
- outputs path
- pass/fail
- user-facing failures
- remaining open risks
