# Electron Operator CLI

A local full-trust automation harness for the Electron shell app.

For the best agent-facing usage guidance, read:

- `docs/electron-operator-agent-playbook.md`

For the full reference, examples, lane descriptions, native menu coverage, dialog overrides, multi-window controls, and macOS desktop fallback, read:

- `docs/electron-operator-guide.md`

Use it through normal shell commands:

```bash
npm run operator -- launch
npm run operator -- state
npm run operator -- create-project /tmp/my-presentation 3
npm run operator -- wait-for-text "Shell open" 15000
npm run operator -- terminal-focus
npm run operator -- terminal-type "claude --help"
npm run operator -- terminal-press Enter
npm run operator -- wait-for-terminal-text "Commands:" 20000
npm run operator -- click '#terminal-find'
npm run operator -- wait-for-selector '#terminal-search[data-open="true"]' 15000
npm run operator -- screenshot /tmp/app.png
npm run operator -- shutdown
```

## Command lanes

### User lane
Use these when you want the harness to behave like a visible user journey through the app.

**Pointer and keyboard**
- `launch`
- `close`
- `restart`
- `shutdown`
- `click <selector>`
- `double-click <selector>`
- `right-click <selector>`
- `hover <selector>`
- `type <selector> <text>`
- `press <key>`
- `key-down <key>`
- `key-up <key>`

**Mouse movement and dragging**
- `mouse-move <selector>`
- `mouse-move-coords <x> <y>`
- `mouse-down [button]`
- `mouse-up [button]`
- `drag <fromSelector> <toSelector>`
- `drag-coords <x1> <y1> <x2> <y2>`
- `scroll <selector> <deltaX> <deltaY>`
- `scroll-page <deltaX> <deltaY>`

**Perception and capture**
- `wait-for-text <text> [timeoutMs]`
- `wait-for-selector <selector> [timeoutMs]`
- `is-visible <selector>`
- `is-enabled <selector>`
- `bounds <selector>`
- `focused-element`
- `visible-text [selector]`
- `screenshot <outputPath>`
- `screenshot-element <selector> <outputPath>`
- `screenshot-region <x> <y> <width> <height> <outputPath>`

**Terminal surface**
- `terminal-focus`
- `terminal-type <text>`
- `terminal-press <key>`
- `terminal-text`
- `wait-for-terminal-text <text> [timeoutMs]`

**Preview surface**
- `preview-click <selector>`
- `preview-type <selector> <text>`
- `preview-visible-text [selector]`
- `preview-wait-for-selector <selector> [timeoutMs]`

Example strict visible flow:

```bash
npm run operator -- launch
npm run operator -- click '#create-project'
npm run operator -- wait-for-selector '#project-launcher-modal[data-open="true"]' 15000
npm run operator -- type '#project-launcher-path-input' /tmp/my-presentation
npm run operator -- type '#project-launcher-slides-input' 3
npm run operator -- click '#project-launcher-submit'
npm run operator -- wait-for-text 'Shell open' 20000
npm run operator -- terminal-focus
npm run operator -- terminal-type 'echo __USER_LANE__'
npm run operator -- terminal-press Enter
npm run operator -- wait-for-terminal-text '__USER_LANE__' 15000
```

### Hybrid semantic lane
Use these when you need deterministic setup, internal state inspection, or faster agent control than visible-only clicks can provide.

- `state`
- `create-project <projectRoot> [slideCount]`
- `open-project <projectRoot>`
- `project-meta`
- `preview-meta`
- `terminal-meta`
- `terminal-send <text>`
- `actions-list`
- `action-invoke <actionId> [jsonArgs]`
- `windows-list`
- `create-window`
- `focus-window <windowId>`
- `resize-window <width> <height> [windowId]`
- `close-window [windowId]`
- `wait-for-window-count <count> [timeoutMs]`
- `menu-list`
- `menu-click <pathOrId>`
- `dialog-state`
- `dialog-clear`
- `dialog-set-open-directory <path>`
- `dialog-set-save-path <path>`
- `os-file-dialog-available`
- `os-file-dialog-state [appName]`
- `os-file-dialog-wait-open [appName] [timeoutMs]`
- `os-file-dialog-wait-closed [appName] [timeoutMs]`
- `os-file-dialog-choose-folder <path> [appName]`
- `os-file-dialog-cancel [appName]`
- `os-available`
- `os-activate-app <appName>`
- `os-menu-click <appName> <menuPath>`
- `os-move <x> <y>`
- `os-click <x> <y> [button]`
- `os-double-click <x> <y> [button]`
- `os-type <text>`
- `os-press <key>`
- `os-screenshot <outputPath>`

## Notes

- The operator runs as a persistent local server behind the CLI.
- The CLI prints JSON so agents can parse results easily.
- The harness now has two distinct lanes:
  - **user lane** for visible regression journeys
  - **hybrid semantic lane** for setup, diagnostics, and deterministic control
- Set `PRESENTATION_OPERATOR_SESSION=<id>` to isolate concurrent operator runs. The CLI and server use a session-specific state file under the operator temp directory.
- `terminal-type` simulates a user typing in the integrated terminal.
- `terminal-send` writes directly through the app terminal bridge when a deterministic input path is preferable.
- `terminal-text` and `wait-for-terminal-text` use terminal select-all/copy behavior so the text reflects a user-visible terminal surface instead of scraping xterm DOM styles.
