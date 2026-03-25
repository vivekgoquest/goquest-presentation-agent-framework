# Electron Operator Agent Playbook

A practical guide for agents that need to act like real users inside the Electron app.

This playbook is for **agent operators**, not framework maintainers. It explains how to use the Electron operator in a way that looks and behaves like a human user while still staying reliable.

For the full raw command reference, see:
- `docs/electron-operator-guide.md`
- `docs/electron-operator-cli.md`

---

# 1. What this is for

Use this playbook when another agent needs to:
- open the Electron app
- click buttons and menu items
- type into visible inputs
- work in the integrated terminal
- inspect the preview
- take screenshots
- handle the real macOS folder picker
- recover from flaky UI timing safely

The operator is designed to support two very different behaviors:

1. **Strict real-user behavior**
   - click visible controls
   - type into visible fields
   - wait for visible UI changes
   - interact with the native folder picker when needed

2. **Hybrid helper behavior**
   - use semantic shortcuts for setup, diagnostics, and recovery
   - faster, but less “human”

If the instruction is “act like a real user”, prefer the first mode.

---

# 2. Core rule: pick the right lane

## Strict user lane
Use this when the agent should behave like a visible user.

Prefer these commands:
- `launch`
- `click`
- `double-click`
- `right-click`
- `hover`
- `type`
- `press`
- `key-down`
- `key-up`
- `mouse-move`
- `mouse-move-coords`
- `mouse-down`
- `mouse-up`
- `drag`
- `drag-coords`
- `scroll`
- `scroll-page`
- `wait-for-text`
- `wait-for-selector`
- `is-visible`
- `is-enabled`
- `bounds`
- `focused-element`
- `value`
- `wait-for-value`
- `visible-text`
- `screenshot`
- `screenshot-element`
- `screenshot-region`
- `terminal-focus`
- `terminal-type`
- `terminal-press`
- `terminal-text`
- `wait-for-terminal-text`
- `preview-click`
- `preview-type`
- `preview-visible-text`
- `preview-wait-for-selector`
- `menu-click`
- `os-file-dialog-*` when the real native picker appears

## Hybrid helper lane
Use this only when:
- setting up faster matters more than realism
- you need internal state or deterministic control
- the user did not explicitly ask for human-like behavior

These include:
- `create-project`
- `open-project`
- `terminal-send`
- `state`
- `project-meta`
- `preview-meta`
- `terminal-meta`
- `action-invoke`
- dialog override commands

## Practical rule
If another agent is supposed to “use the app like a person”, default to:
- visible clicks
- visible typing
- visible waits
- screenshots
- native picker automation only when the picker really appears

Do **not** default to semantic shortcuts unless there is a concrete reason.

---

# 3. Session discipline

Always isolate runs with a unique operator session.

```bash
export PRESENTATION_OPERATOR_SESSION=agent-run-001
```

This prevents one run from stomping another.

Use a fresh session for:
- every independent agent task
- every test case
- every debugging run where state may be stale

Always shut the session down at the end:

```bash
npm run operator -- shutdown
```

## Recommended lifecycle

```bash
export PRESENTATION_OPERATOR_SESSION=agent-example-001
npm run operator -- launch
# ...do work...
npm run operator -- shutdown
```

---

# 4. How agents should think while using this

## Do
- wait for visible UI before acting
- confirm focus before typing
- prefer selector waits over arbitrary sleeps
- use screenshots to capture evidence
- use terminal waits for terminal assertions
- use `wait-for-value` for picker-driven field changes
- assume the app can take a beat to update after native OS interactions

## Do not
- spam clicks because something did not update instantly
- assume a path field updated synchronously after a picker closes
- use `create-project` if you are explicitly testing the visible create flow
- use `terminal-send` if you are explicitly testing user typing
- mix multiple operators in the same session id

---

# 5. Minimal startup checklist for agents

Before doing anything important:

1. set a unique session id
2. launch the app
3. confirm the app shell is present
4. only then start interacting

Example:

```bash
export PRESENTATION_OPERATOR_SESSION=agent-checklist-001
npm run operator -- launch
npm run operator -- wait-for-selector '#app-shell' 15000
```

---

# 6. Common real-user flows

## A. Create a new project like a real user

```bash
export PRESENTATION_OPERATOR_SESSION=user-create-001
npm run operator -- launch
npm run operator -- click '#create-project'
npm run operator -- wait-for-selector '#project-launcher-modal[data-open="true"]' 15000
npm run operator -- type '#project-launcher-path-input' /tmp/my-project
npm run operator -- type '#project-launcher-slides-input' 3
npm run operator -- click '#project-launcher-submit'
npm run operator -- wait-for-text 'Shell open' 20000
```

Use this when you want to test the visible launcher flow.

---

## B. Open a project via the visible launcher

```bash
export PRESENTATION_OPERATOR_SESSION=user-open-001
npm run operator -- launch
npm run operator -- click '#choose-path'
npm run operator -- wait-for-selector '#project-launcher-modal[data-open="true"]' 15000
npm run operator -- type '#project-launcher-path-input' /absolute/path/to/project
npm run operator -- click '#project-launcher-submit'
npm run operator -- wait-for-text 'Shell open' 20000
```

---

## C. Use the integrated terminal like a person

```bash
npm run operator -- terminal-focus
npm run operator -- terminal-type 'pwd'
npm run operator -- terminal-press Enter
npm run operator -- wait-for-terminal-text '/absolute/path/to/project' 15000
```

If you want to test terminal search:

```bash
npm run operator -- click '#terminal-find'
npm run operator -- wait-for-selector '#terminal-search[data-open="true"]' 15000
```

---

## D. Inspect the preview like a person

```bash
npm run operator -- preview-wait-for-selector 'body' 15000
npm run operator -- preview-visible-text 'body'
npm run operator -- screenshot /tmp/preview.png
```

Use `preview-*` commands instead of trying to reason about nested iframes yourself.

---

## E. Use the More menu or native app menu

### DOM menu button

```bash
npm run operator -- click '#more-actions'
npm run operator -- wait-for-selector '#more-menu' 5000
```

### Native application menu

```bash
npm run operator -- menu-list
npm run operator -- menu-click file.newProject
```

Prefer menu ids over menu label paths when possible.

---

# 7. How to handle the real macOS folder picker

This is the most important section for your use case.

There are **two** ways to handle folder dialogs.

## Option 1: deterministic app-level override
Use when you want reliability and do **not** need to prove the real OS picker itself worked.

```bash
npm run operator -- dialog-clear
npm run operator -- dialog-set-open-directory /tmp/my-project
npm run operator -- click '#project-launcher-browse'
npm run operator -- wait-for-value '#project-launcher-path-input' /tmp/my-project 15000
```

This does **not** drive the macOS picker UI. It supplies the result at the app boundary.

## Option 2: real native macOS picker automation
Use when you **must** act through the actual OS dialog.

### Availability check

```bash
npm run operator -- os-file-dialog-available
```

This tells you whether:
- the platform supports it
- Accessibility UI scripting is enabled

### Real native picker flow

```bash
npm run operator -- click '#project-launcher-browse'
npm run operator -- os-file-dialog-wait-open Electron 15000
npm run operator -- os-file-dialog-choose-folder /tmp/my-project Electron
npm run operator -- os-file-dialog-wait-closed Electron 15000
npm run operator -- wait-for-value '#project-launcher-path-input' /private/tmp/my-project 20000
```

### Important note about `/tmp`
macOS often canonicalizes:
- `/tmp/foo`
into:
- `/private/tmp/foo`

So after real picker automation, assert against the canonical path, not necessarily the original literal input string.

If you created the directory yourself, canonicalize it first in your own script before asserting.

### Cancel the picker

```bash
npm run operator -- os-file-dialog-cancel Electron
```

---

# 8. Recommended real-user script patterns for agents

## Pattern: create through visible UI, but handle picker natively

Use this when the app really should go through the native folder dialog.

```bash
export PRESENTATION_OPERATOR_SESSION=real-picker-001
npm run operator -- launch
npm run operator -- click '#create-project'
npm run operator -- wait-for-selector '#project-launcher-modal[data-open="true"]' 15000
npm run operator -- click '#project-launcher-browse'
npm run operator -- os-file-dialog-wait-open Electron 15000
npm run operator -- os-file-dialog-choose-folder /tmp/my-project Electron
npm run operator -- os-file-dialog-wait-closed Electron 15000
npm run operator -- type '#project-launcher-slides-input' 3
npm run operator -- click '#project-launcher-submit'
npm run operator -- wait-for-text 'Shell open' 20000
npm run operator -- screenshot /tmp/real-picker-create.png
npm run operator -- shutdown
```

---

## Pattern: strict UX regression

Use only visible controls plus screenshots.

```bash
export PRESENTATION_OPERATOR_SESSION=ux-regression-001
npm run operator -- launch
npm run operator -- click '#create-project'
npm run operator -- wait-for-selector '#project-launcher-modal[data-open="true"]' 15000
npm run operator -- screenshot /tmp/launcher-open.png
```

Then continue only with visible UI actions.

---

## Pattern: setup fast, assert visibly

If realism is not the main thing being tested:

```bash
export PRESENTATION_OPERATOR_SESSION=hybrid-fast-001
npm run operator -- launch
npm run operator -- create-project /tmp/my-project 3
npm run operator -- wait-for-text 'Shell open' 20000
npm run operator -- click '#terminal-find'
npm run operator -- wait-for-selector '#terminal-search[data-open="true"]' 15000
npm run operator -- screenshot /tmp/terminal-find.png
```

---

# 9. Recovery patterns

## If a selector did not appear
Do not immediately spam more clicks.

Instead:
1. take a screenshot
2. read visible text
3. check whether a modal or picker is already open
4. only then retry

Example:

```bash
npm run operator -- screenshot /tmp/failure.png
npm run operator -- visible-text body
npm run operator -- os-file-dialog-state Electron
```

## If native picker automation is unavailable
Fallback to deterministic app-level overrides:

```bash
npm run operator -- dialog-set-open-directory /tmp/my-project
npm run operator -- click '#project-launcher-browse'
```

## If the operator session gets weird
Shut it down and start fresh:

```bash
npm run operator -- shutdown
export PRESENTATION_OPERATOR_SESSION=new-session-id
npm run operator -- launch
```

---

# 10. Screenshots and evidence

Agents should produce screenshots at meaningful checkpoints.

Recommended points:
- launcher opened
- picker opened
- project created
- terminal ready
- preview visible
- failure state

Useful commands:

```bash
npm run operator -- screenshot /tmp/full.png
npm run operator -- screenshot-element '#preview-pane' /tmp/preview-pane.png
npm run operator -- screenshot-region 100 100 800 500 /tmp/clip.png
```

---

# 11. What to use for assertions

## Best assertion types
### Visible UI
- `wait-for-selector`
- `wait-for-text`
- `is-visible`
- `is-enabled`
- `value`
- `wait-for-value`
- `visible-text`

### Terminal
- `wait-for-terminal-text`
- `terminal-text`

### Native picker
- `os-file-dialog-state`
- `os-file-dialog-wait-open`
- `os-file-dialog-wait-closed`

### Evidence capture
- `screenshot`
- `screenshot-element`
- `screenshot-region`

## Avoid relying only on
- one `click` succeeding
- assumptions about timing
- a silent command result without checking visible consequences

---

# 12. Anti-patterns for agents

## Bad
- click browse, then immediately type into the path field without waiting
- use semantic project creation when validating the visible create flow
- type into the terminal without focusing it first
- assume the native picker uses the exact raw path string you provided
- reuse the same operator session for multiple independent agents

## Good
- click, then wait
- use real picker automation only when the real picker is part of the test
- canonicalize paths before asserting after real picker interaction
- take screenshots around ambiguous OS-level transitions

---

# 13. Suggested checklist for other agents

Before starting:
- [ ] set a unique `PRESENTATION_OPERATOR_SESSION`
- [ ] launch the app
- [ ] confirm `#app-shell` is present

When acting like a user:
- [ ] prefer visible UI commands
- [ ] prefer `terminal-type` over `terminal-send`
- [ ] prefer `click` over semantic action invocation
- [ ] use native picker commands only when the real picker is open
- [ ] wait for visible confirmation after every significant action

Before finishing:
- [ ] take a screenshot
- [ ] capture any final visible/terminal assertions
- [ ] shut down the operator session

---

# 14. Short cheat sheet

## Launch

```bash
export PRESENTATION_OPERATOR_SESSION=my-agent-001
npm run operator -- launch
```

## Create through visible UI

```bash
npm run operator -- click '#create-project'
npm run operator -- wait-for-selector '#project-launcher-modal[data-open="true"]' 15000
```

## Real native folder picker

```bash
npm run operator -- click '#project-launcher-browse'
npm run operator -- os-file-dialog-wait-open Electron 15000
npm run operator -- os-file-dialog-choose-folder /tmp/my-project Electron
npm run operator -- os-file-dialog-wait-closed Electron 15000
```

## Terminal

```bash
npm run operator -- terminal-focus
npm run operator -- terminal-type 'pwd'
npm run operator -- terminal-press Enter
npm run operator -- wait-for-terminal-text '/private/tmp/my-project' 15000
```

## Screenshot

```bash
npm run operator -- screenshot /tmp/current-state.png
```

## Shutdown

```bash
npm run operator -- shutdown
```

---

# 15. Final recommendation for other agents

If you want another agent to behave like a real user, tell it explicitly:

> Use the Electron operator in strict user mode. Prefer visible clicks, visible typing, waits, screenshots, and native macOS picker automation when the folder dialog appears. Avoid semantic shortcuts unless recovery or setup speed is the actual goal.

That instruction will keep agents from taking the “easy but less human” path.
