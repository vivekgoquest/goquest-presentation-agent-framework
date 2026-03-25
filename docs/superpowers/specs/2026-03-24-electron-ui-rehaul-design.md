# Electron UI Rehaul Design

**Date:** 2026-03-24
**Audience:** repository maintainers and AI agents
**Status:** approved for autonomous implementation

## Goal

Rework the Electron shell to feel closer to a premium editor workflow, with terminal behavior and shell responsiveness prioritized over broad feature expansion.

## Problem statement

The current Electron UI is architecturally clean but does not yet feel like a high-quality terminal-first desktop workspace.

The biggest issues are:

1. terminal input is routed through request/response IPC, which is the wrong transport shape for interactive shell feel
2. terminal output handling in the renderer does too much per chunk, which can make streaming output feel choppy
3. the shell is visually and conceptually framed as an assistant pane rather than a first-class terminal
4. preview refresh performs full iframe reloads plus expensive panel refreshes on file changes
5. the shell layout lacks pane resizing and stronger visual hierarchy

## Product direction

Adopt a terminal-first Electron shell.

This means:
- the terminal should feel like a real shell first
- Electron should treat PTY traffic as a high-frequency stream, not as normal request/response application RPC
- the UI should explicitly present the pane as a terminal
- preview should remain functional but should no longer drive avoidable UI churn

## Chosen implementation approach

Use a staged version of the previously approved terminal-first redesign.

### Stage 1
- move terminal input off `ipcRenderer.invoke` onto fire-and-forget IPC
- keep control-plane terminal requests on request/response IPC
- batch renderer-side terminal output flushes
- separate PTY terminal output from system/app terminal output in the event model
- tighten terminal lifecycle sequencing around startup readiness

### Stage 2
- update Electron shell framing to make the terminal primary
- rename the pane from Assistant to Terminal
- add draggable split resizing between terminal and preview panes
- keep responsive behavior intact

### Stage 3
- reduce unnecessary UI work during preview refreshes
- stop coupling every preview reload to a full panel refresh cycle
- keep current preview shell architecture for now unless a small safe reduction is obvious

## Architecture changes

### Terminal transport split

#### Control plane
Stays on request/response IPC:
- start
- stop
- clear
- resize
- reveal
- get meta

#### Data plane
Moves to dedicated fire-and-forget IPC / streaming event path:
- terminal input from xterm to PTY
- terminal output events from PTY to xterm

## Terminal event model

Terminal output events should gain a source identity:
- `pty`
- `system`

This preserves future options for differentiated rendering or filtering without forcing UI complexity into the first implementation.

## UI model changes

The shell should move from an assistant framing to a terminal/workbench framing.

Key changes:
- terminal pane title becomes `Terminal`
- the split becomes user-resizable
- the terminal should no longer feel like a passive secondary pane
- desktop and narrower-width behaviors should still remain responsive

## Risks

1. terminal lifecycle races while changing IPC shape
2. renderer/output buffering bugs causing lost or duplicated text
3. pane resize logic fighting xterm fit logic
4. preview refresh state becoming stale if panel refreshes are reduced too aggressively

## Risk controls

- add tests around terminal event semantics and shell startup behavior
- keep the existing control-plane request paths intact
- batch output conservatively in the renderer without changing PTY semantics
- preserve current preview rendering path while only reducing redundant UI refresh behavior

## Success criteria

The implementation is successful if:

1. terminal input no longer depends on request/response invoke IPC
2. interactive CLI behavior feels more immediate and less wrapped
3. the terminal pane is framed as Terminal in the UI
4. the shell supports pane resizing
5. preview refresh no longer forces unnecessary full panel refreshes on every change
6. existing Electron and terminal tests still pass after updates
