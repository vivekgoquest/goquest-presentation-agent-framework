# Electron Operator Guide

A full-trust automation guide for driving the Electron shell app like a real user.

This operator has two layers:

1. **In-app control** — Playwright Electron drives the app window directly.
2. **Optional desktop fallback** — macOS-only OS automation commands can drive menus, clicks, typing, and screenshots outside the app window when needed.

Use it through the checked-in CLI:

```bash
npm run operator -- <command> [args...]
```

The CLI always prints JSON.

---

## Mental model

The operator exposes four control lanes:

### 1. User lane
Visible user-style control of the Electron app window.

Use this for:
- clicks
- typing
- keyboard shortcuts
- dragging
- scrolling
- screenshots
- preview interaction
- terminal interaction

### 2. Hybrid semantic lane
App-aware shortcuts for setup and deterministic control.

Use this for:
- project creation/opening without driving the launcher UI
- internal state inspection
- direct action invocation
- direct terminal send

### 3. System lane
Native app integration that is not purely DOM-driven.

Use this for:
- native menu inspection and invocation
- dialog override queues
- multi-window management

### 4. Desktop fallback lane
Optional macOS-only OS automation for outside-the-window control.

Use this for:
- native menu bar clicks through System Events
- real macOS file-picker automation
- desktop-level typing / keypresses
- screen screenshots
- coordinate-based desktop mouse control

---

## Sessions

The operator runs as a persistent local server behind the CLI.

By default it uses a shared session. For repeatable automation or concurrent runs, always set a session id:

```bash
export PRESENTATION_OPERATOR_SESSION=my-run-01
```

The CLI and server will use a session-specific state file in the operator temp directory.

Recommended:
- one session per test
- one session per agent task
- always call `shutdown` at the end

Example:

```bash
export PRESENTATION_OPERATOR_SESSION=demo-123
npm run operator -- launch
npm run operator -- state
npm run operator -- shutdown
```

---

## Quick start

### Launch the app

```bash
npm run operator -- launch
```

### Inspect current state

```bash
npm run operator -- state
```

### Strict visible project flow

```bash
export PRESENTATION_OPERATOR_SESSION=user-flow-01
npm run operator -- launch
npm run operator -- click '#create-project'
npm run operator -- wait-for-selector '#project-launcher-modal[data-open="true"]' 15000
npm run operator -- type '#project-launcher-path-input' /tmp/my-presentation
npm run operator -- type '#project-launcher-slides-input' 3
npm run operator -- click '#project-launcher-submit'
npm run operator -- wait-for-text 'Shell open' 20000
npm run operator -- terminal-focus
npm run operator -- terminal-type 'echo __READY__'
npm run operator -- terminal-press Enter
npm run operator -- wait-for-terminal-text '__READY__' 15000
npm run operator -- screenshot /tmp/my-presentation-window.png
npm run operator -- shutdown
```

### Hybrid fast setup flow

```bash
export PRESENTATION_OPERATOR_SESSION=hybrid-flow-01
npm run operator -- launch
npm run operator -- create-project /tmp/my-presentation 3
npm run operator -- wait-for-text 'Shell open' 20000
npm run operator -- terminal-send 'pwd\n'
npm run operator -- wait-for-terminal-text '/tmp/my-presentation' 15000
npm run operator -- state
npm run operator -- shutdown
```

---

# Command reference

## App lifecycle

### `launch`
Launch the Electron app if it is not already running.

### `close`
Close the current Electron app instance for this operator session.

### `restart`
Restart the app and return current state.

### `shutdown`
Stop the operator server for the current session.

### `state`
Return a summarized app snapshot, including:
- project metadata
- preview metadata
- terminal metadata
- toolbar labels
- terminal labels
- preview labels
- recent page errors
- recent console messages

---

## User lane: pointer and keyboard

### `click <selector>`
Click a visible element.

```bash
npm run operator -- click '#primary-action'
```

### `double-click <selector>`
Double-click a visible element.

### `right-click <selector>`
Right-click a visible element.

### `hover <selector>`
Move the pointer over a visible element.

### `type <selector> <text>`
Fill an input or textarea.

```bash
npm run operator -- type '#project-launcher-path-input' /tmp/demo
```

### `press <key>`
Press a key with Playwright semantics.

Examples:

```bash
npm run operator -- press Enter
npm run operator -- press Escape
npm run operator -- press Meta+F
npm run operator -- press Control+A
```

### `key-down <key>`
Hold a key down.

### `key-up <key>`
Release a held key.

Useful for custom modifier sequences.

---

## User lane: mouse movement, drag, and scroll

### `mouse-move <selector>`
Move the mouse to the center of an element.

### `mouse-move-coords <x> <y>`
Move the mouse to absolute window coordinates.

### `mouse-down [button]`
Mouse down at the current pointer location.

Buttons:
- `left`
- `middle`
- `right`

### `mouse-up [button]`
Mouse up at the current pointer location.

### `drag <fromSelector> <toSelector>`
Drag from one element center to another.

### `drag-coords <x1> <y1> <x2> <y2>`
Drag between absolute coordinates.

This is useful for split handles and precise pointer work.

### `scroll <selector> <deltaX> <deltaY>`
Hover the selector and send a mouse wheel event.

### `scroll-page <deltaX> <deltaY>`
Scroll the current page surface without a selector target.

---

## User lane: perception and capture

### `wait-for-text <text> [timeoutMs]`
Wait until visible page text contains a string.

### `wait-for-selector <selector> [timeoutMs]`
Wait for a selector to appear.

### `is-visible <selector>`
Return whether a selector is visible.

### `is-enabled <selector>`
Return whether a selector is enabled.

### `bounds <selector>`
Return element bounds:
- `x`
- `y`
- `width`
- `height`

Useful for drag and region screenshots.

### `focused-element`
Return the current active element:
- tag
- id
- className
- name
- text

### `value <selector>`
Read the `value` of an input or textarea.

### `wait-for-value <selector> <value> [timeoutMs]`
Wait for an input value to equal an expected string.

### `visible-text [selector]`
Return visible inner text from a selector. Defaults to `body`.

### `screenshot <outputPath>`
Full-window screenshot.

### `screenshot-element <selector> <outputPath>`
Capture a specific element.

### `screenshot-region <x> <y> <width> <height> <outputPath>`
Capture a clip rectangle from the app window.

---

## Terminal surface

### `terminal-focus`
Focus the terminal pane.

### `terminal-type <text>`
Type into the terminal like a user.

### `terminal-press <key>`
Press a key while working in the terminal.

### `terminal-send <text>`
Hybrid command: send directly through the app terminal bridge.

Use when you want deterministic input rather than user-style typing.

### `terminal-meta`
Return terminal runtime metadata.

### `terminal-text`
Read visible terminal text.

This uses select-all/copy behavior rather than scraping xterm DOM.

### `wait-for-terminal-text <text> [timeoutMs]`
Wait for visible terminal text to contain a string.

---

## Preview surface

The preview lives inside an iframe and may itself contain a nested stage iframe for slide decks. The operator handles this for you.

### `preview-click <selector>`
Click inside the preview surface.

### `preview-type <selector> <text>`
Type into an input inside the preview surface.

### `preview-visible-text [selector]`
Read visible text from the preview surface.

### `preview-wait-for-selector <selector> [timeoutMs]`
Wait for a selector inside the preview surface.

### `preview-meta`
Return preview metadata.

---

## Hybrid semantic lane

### `create-project <projectRoot> [slideCount]`
Create a project directly without using the visible launcher sheet.

### `open-project <projectRoot>`
Open a project directly.

### `project-meta`
Return current project metadata.

### `actions-list`
List current runtime action descriptors.

### `action-invoke <actionId> [jsonArgs]`
Invoke a product action directly.

Example:

```bash
npm run operator -- action-invoke validate_presentation '{}'
```

---

## Native menu controls

The app now installs a real application menu.

Useful menu ids include:
- `file.newProject`
- `file.openProject`
- `file.closeWindow`
- `view.reloadWindow`
- `view.toggleDevTools`
- `view.toggleFullScreen`
- `window.newWindow`
- `window.minimize`
- `window.zoom`

### `menu-list`
Return the current application menu tree.

### `menu-click <pathOrId>`
Invoke a menu item by id or by label path.

Examples:

```bash
npm run operator -- menu-click file.newProject
npm run operator -- menu-click 'File > New Project…'
npm run operator -- menu-click 'File > Open Project…'
```

Notes:
- id-based invocation is more stable than label-path invocation
- role-only items are supported for a limited set of window roles

---

## Dialog override controls

These are app-level primitives for deterministic control of native dialogs.

They do **not** try to click OS file picker UI.
Instead, they queue the next dialog response so the app receives the exact result you want.

This is the preferred approach for repeatable automation.

### `dialog-state`
Return queued dialog overrides and recent dialog history.

### `dialog-clear`
Clear all queued dialog overrides and dialog history.

### `dialog-set-open-directory <path>`
Queue the next directory-picker result.

Example:

```bash
npm run operator -- dialog-set-open-directory /tmp/my-project
npm run operator -- click '#project-launcher-browse'
npm run operator -- wait-for-value '#project-launcher-path-input' /tmp/my-project 15000
```

### `dialog-set-save-path <path>`
Queue the next save-dialog result.

This is useful when app flows call `saveDialog()`.

---

## Multi-window controls

### `windows-list`
Return all open Electron windows with:
- `id`
- `title`
- `focused`
- `bounds`

### `create-window`
Create a new Electron app window.

### `focus-window <windowId>`
Focus a specific window.

### `resize-window <width> <height> [windowId]`
Resize a target window.

### `close-window [windowId]`
Close the focused window, or a specific window id.

### `wait-for-window-count <count> [timeoutMs]`
Wait until the app has the expected number of windows.

Example:

```bash
npm run operator -- create-window
npm run operator -- wait-for-window-count 2 15000
npm run operator -- windows-list
```

---

## Desktop fallback lane (macOS only)

These commands are optional.
They are for control **outside** the app window.

This layer currently targets macOS and requires Accessibility permission.

### `os-available`
Return whether desktop fallback is supported on the current platform.

### `os-file-dialog-available`
Return whether native macOS file-dialog automation is supported and whether Accessibility UI scripting is enabled.

### `os-file-dialog-state [appName]`
Inspect whether a real native file dialog is currently open for the target app process.

Returns:
- `processName`
- `open`
- `confirmLabel`

### `os-file-dialog-wait-open [appName] [timeoutMs]`
Wait until a real native file dialog is open.

### `os-file-dialog-wait-closed [appName] [timeoutMs]`
Wait until a real native file dialog is closed.

### `os-file-dialog-choose-folder <path> [appName]`
Drive the real macOS choose-folder dialog.

Current flow:
1. target the app process
2. send `Cmd+Shift+G`
3. fill the `Go to Folder` sheet
4. confirm with keyboard
5. wait for the dialog to close

Example:

```bash
npm run operator -- click '#project-launcher-browse'
npm run operator -- os-file-dialog-state Electron
npm run operator -- os-file-dialog-choose-folder /tmp/my-project Electron
npm run operator -- wait-for-value '#project-launcher-path-input' /private/tmp/my-project 20000
```

### `os-file-dialog-cancel [appName]`
Cancel the currently open native file dialog.

### `os-activate-app <appName>`
Bring a macOS app to the foreground.

### `os-menu-click <appName> <menuPath>`
Click a native macOS menu bar item through System Events.

Example:

```bash
npm run operator -- os-menu-click 'Electron' 'File > New Project…'
```

### `os-move <x> <y>`
Move the desktop pointer using a macOS Swift/CoreGraphics helper.

### `os-click <x> <y> [button]`
Click the desktop at screen coordinates.

### `os-double-click <x> <y> [button]`
Double-click the desktop at screen coordinates.

### `os-type <text>`
Type text through System Events.

### `os-press <key>`
Press a key through System Events.

Special keys currently include:
- `Enter`
- `Tab`
- `Escape`
- `Space`
- arrow keys
- delete/backspace

### `os-screenshot <outputPath>`
Take a desktop screenshot using `screencapture`.

Example:

```bash
npm run operator -- os-available
npm run operator -- os-file-dialog-available
npm run operator -- os-activate-app 'Electron'
npm run operator -- os-screenshot /tmp/desktop.png
```

### Important caveats for desktop fallback
- macOS Accessibility permissions are required
- desktop coordinates are screen coordinates, not app-window coordinates
- this fallback is intentionally separate from the in-app operator lane
- prefer in-app controls whenever possible; use desktop fallback only when the app surface is insufficient
- native file dialogs may canonicalize paths such as `/tmp/...` to `/private/tmp/...`; use the canonical path when asserting field values after a real picker interaction

---

## Recommended usage patterns

## Pattern 1: strict visible regression flow
Use only user-lane commands.

Best for:
- UX regression checks
- screenshots
- terminal behavior checks
- user-facing workflow coverage

## Pattern 2: hybrid setup + visible assertions
Use semantic setup, then visible assertions.

Best for:
- fast project preparation
- deterministic action setup
- follow-up screenshots and UI verification

Example:

```bash
npm run operator -- create-project /tmp/demo 3
npm run operator -- wait-for-text 'Shell open' 20000
npm run operator -- click '#terminal-find'
npm run operator -- wait-for-selector '#terminal-search[data-open="true"]' 15000
npm run operator -- screenshot /tmp/demo-ui.png
```

## Pattern 3: dialog-safe automation
Prefer dialog overrides over trying to automate native pickers.

Best for:
- repeatable file/folder chooser flows
- CI-safe deterministic tests
- agent automation without OS picker complexity

## Pattern 4: desktop fallback only when necessary
Use OS commands only when something is outside the app window.

Examples:
- macOS menu bar interactions beyond app DOM reach
- desktop screenshots
- future app flows that open external native surfaces

---

## Tips

- Use unique `PRESENTATION_OPERATOR_SESSION` values for parallel runs.
- Shut down the session when done.
- Prefer id-based menu clicks over label paths.
- Prefer dialog overrides over trying to automate file pickers.
- Prefer `terminal-type` for user realism and `terminal-send` for deterministic setup.
- Prefer `preview-*` commands instead of manually reasoning about nested iframes.
- Use `bounds` + `drag-coords` when a UI control needs precise pointer movement.

---

## Known limits

Even with the desktop fallback, this is still not a full general-purpose OS automation suite.

Current limits:
- desktop fallback is macOS-only
- full native dialog UI clicking is not the preferred path; queued overrides are preferred
- app-specific multi-window support is present, but the product itself still mostly uses one primary window
- the known preview smoke flake in `electron/__tests__/app-smoke.test.mjs` remains separate from the operator harness

---

## Verification references

Relevant tests:
- `electron/__tests__/operator-cli.test.mjs`
- `electron/__tests__/operator-user-cli.test.mjs`
- `electron/__tests__/operator-controls.test.mjs`
- `electron/__tests__/operator-system-controls.test.mjs`
- `electron/__tests__/operator-native-dialog.test.mjs`
- `electron/operator/__tests__/terminal-capture.test.mjs`
- `electron/operator/__tests__/os-automation.test.mjs`

These cover:
- hybrid terminal flow
- strict visible user flow
- broad pointer/keyboard/preview coverage
- menu/dialog/window coverage
- live macOS native choose-folder automation
- terminal clipboard capture hardening
- OS-automation helper generation
