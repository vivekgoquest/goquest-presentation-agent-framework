# Plan: Project Folder Mode With Optional Copied Framework

**Generated**: 2026-03-14
**Estimated Complexity**: High

## Overview

Move the product from a repo-centric `decks/<slug>/` model toward a VS Code-style "open folder" model where one folder equals one presentation project. Keep the current framework flexibility by supporting two project modes:

- `linked`: the project uses the shared installed framework/runtime
- `copied`: the project contains its own snapshot of the mutable framework files

This keeps the user experience simple while preserving flexibility during framework evolution. The operator console opens one project folder, starts the terminal inside that folder, and serves one preview for that folder. The framework-copy option gives each project a vendored snapshot so agents can change project-local framework behavior without mutating the shared install.

## Product Goals

- One opened folder should feel like a complete presentation project.
- A non-technical user should not need to understand `decks/`, `examples/`, or repo-wide workspace browsing.
- The system must still support fast framework evolution.
- Existing flexibility must remain available for advanced or experimental projects.
- Canvas should remain the most protected layer even if copied locally.

## Key Design Decision

The project folder becomes the unit of work. The shared installation becomes a launcher/editor/runtime, not the place where presentation source lives.

### Recommended Project Contract

```text
<project-root>/
  brief.md
  outline.md
  revisions.md
  theme.css
  assets/
  slides/
    010-hero/
      slide.html
      slide.css
      assets/
    020-story/
      slide.html
    030-close/
      slide.html
  outputs/
    deck.pdf
    report.json
    summary.md
    slides/
  .presentation/
    project.json
    framework/         # present only in copied mode
      client/
      runtime/
      templates/
      prompts/
      specs/
      canvas/          # copied but policy-protected
```

### Why This Shape

- The root stays presentation-first and understandable.
- Hidden implementation details live in `.presentation/`.
- The copied framework is local to the project, making the folder portable and reproducible.
- Canvas can still be copied for completeness while remaining policy-protected and harder to edit.

## Recommended Mode Split

### Mode A: Linked Framework

The project folder stores only presentation files. The console/runtime resolves framework files from the shared installation.

Use when:

- the project should track framework upgrades quickly
- the user wants the simplest, least duplicated setup
- the deck is normal authoring work, not framework experimentation

### Mode B: Copied Framework

The project folder includes a snapshot of mutable framework files under `.presentation/framework/`.

Use when:

- the project needs to diverge locally
- the deck should remain reproducible against the exact framework snapshot it started with
- the agent may need to patch runtime/client/templates/prompts/specs for this one project
- the framework is evolving quickly and per-project isolation matters

### Recommendation

Ship both modes, but make the UI default clear:

- default new project mode: `linked`
- advanced option: `copied`

For the next phase, add an explicit "Copy framework into project" option rather than forcing one model globally. That preserves current flexibility while giving the user a simpler "open folder" interface.

## Deep Architectural Implications

### 0. Trusted Host Core Must Stay Separate From The Copied Snapshot

This is the most important rule in the whole design.

If a copied project snapshot is allowed to provide its own validator, policy engine, or finalization authority, then an agent can edit the copied framework and make the project approve itself. That would destroy the guardrail model.

So even in copied mode, the system should split into:

- **Trusted host core** in the shared installation
  - operator console
  - project loader
  - policy validator
  - finalize/export/capture authority
  - project metadata parsing
- **Project-local snapshot** in `.presentation/framework/`
  - client behavior
  - runtime presentation helpers that affect rendering
  - templates
  - prompts
  - specs
  - copied canvas files for reproducibility, but not as an unconstrained default edit lane

Rule:

- the host may render with project-local assets and project-local framework surfaces
- the host must validate and finalize with its own trusted policy code

This preserves flexibility while keeping the enforcement boundary real.

### 1. Path Model Must Split Cleanly

Current structure assumes repo-root workspaces in `decks/<slug>/` and shared outputs in `outputs/<slug>/`.

The new model needs two separate roots:

- `FRAMEWORK_ROOT`: installed operator console/runtime/canvas
- `PROJECT_ROOT`: currently opened presentation project

Every runtime path helper should resolve against these two roots instead of a single `REPO_ROOT`.

### 2. One Opened Project Replaces Multi-Workspace Browsing

The operator console should serve exactly one current project:

- preview route: `/preview/`
- terminal cwd: `PROJECT_ROOT`
- export target: `PROJECT_ROOT/outputs/deck.pdf`
- no deck/example selector in project mode

The old multi-workspace browser can remain as a legacy or framework-developer mode, but not as the primary user experience.

### 3. Project Metadata Must Be Explicit

Add `.presentation/project.json` with fields such as:

```json
{
  "projectMode": "linked",
  "projectName": "City After Dark",
  "projectSlug": "city-after-dark",
  "frameworkMode": "linked",
  "frameworkVersion": "2026-03-14",
  "frameworkSource": "/abs/path/to/shared/framework",
  "canvasPolicy": "protected"
}
```

For copied mode:

```json
{
  "projectMode": "copied",
  "frameworkMode": "copied",
  "frameworkVersion": "2026-03-14",
  "frameworkCopiedAt": "2026-03-14T06:12:00+05:30",
  "frameworkSourceVersion": "git-sha-or-release-tag",
  "canvasPolicy": "protected"
}
```

This metadata is essential for:

- update/sync flows
- debugging
- validator behavior
- future migrations

### 4. Canvas Protection Needs To Survive Copying

If framework files are copied, policy must not rely only on file location. It should rely on role and metadata.

The validator should continue to treat copied `canvas/` as protected core unless the user explicitly unlocks framework editing for that project.

Recommended rule:

- `theme.css` and `slides/` remain the default edit lane
- copied `.presentation/framework/canvas/` is visible but locked by default
- other copied framework folders may be editable in advanced mode
- even when copied framework files are editable, trusted validation/finalize logic must still come from the shared host core, not the copied snapshot

That preserves flexibility without turning every project into unrestricted framework drift.

### 5. Upgrade Story Must Exist From Day One

Copied mode introduces version drift by design. That is acceptable only if the product exposes a clear update path.

Need three future operations:

- `compare framework`
- `refresh framework snapshot`
- `rebase project onto latest framework`

For v1, the minimum acceptable behavior is:

- record the copied framework version in `project.json`
- show whether a project is linked or copied
- make no silent upgrades

## Proposed User Experience

### Open Project

1. User chooses a folder.
2. Tool checks for `.presentation/project.json`.
3. If missing, offer:
   - "Create presentation project"
   - mode: linked or copied framework
4. Tool scaffolds the folder.
5. Terminal launches in that folder.
6. Preview loads `/preview/` for that folder.

### New Project Scaffold

Prompt only for:

- folder location
- project name / slug
- expected slide count
- framework mode:
  - linked
  - copied

Everything else is created automatically.

### Project Editing

- agent works entirely inside the opened folder
- outputs are local to that folder
- preview/export/finalize all apply to that folder only

## Migration Strategy

### Migration Principle

Do not break the current repo-centric flow immediately. Add project-folder mode first, then migrate the UI to prefer it.

### Compatibility Layers

Support both during transition:

- legacy repo mode:
  - `decks/<slug>/`
  - `/decks/<slug>/`
- project-folder mode:
  - arbitrary folder
  - `/preview/`

### How To Convert Existing Decks

Provide a migration path:

- source: `decks/<slug>/`
- target: `<chosen-folder>/`

Copy:

- `brief.md`
- `outline.md`
- `revisions.md`
- `theme.css`
- `assets/`
- `slides/`
- optionally `outputs/`
- optionally copied framework snapshot into `.presentation/framework/`

## Sprint 1: Introduce Project-Root Awareness

**Goal**: Make runtime capable of working from an arbitrary project root without changing the UI yet.

**Demo/Validation**:

- run preview/check/export/finalize against a folder outside `decks/`
- outputs land inside that folder’s `outputs/`

### Task 1.1: Add Project Metadata Contract

- **Location**: `framework/runtime/`, `templates/`
- **Description**: Define `.presentation/project.json` schema and scaffold template.
- **Complexity**: 5
- **Dependencies**: none
- **Acceptance Criteria**:
  - project metadata can represent linked vs copied framework mode
  - metadata records enough information for future upgrades
- **Validation**:
  - create sample metadata files and load them in runtime tests

### Task 1.2: Split Framework Root From Project Root

- **Location**: `framework/runtime/deck-paths.js`, related runtime helpers
- **Description**: Replace single-root assumptions with `FRAMEWORK_ROOT` and `PROJECT_ROOT` aware path resolution.
- **Complexity**: 8
- **Dependencies**: Task 1.1
- **Acceptance Criteria**:
  - runtime can resolve current project files from arbitrary folders
  - outputs write to project-local `outputs/`
- **Validation**:
  - run `check`, `export`, and `finalize` against a sample external project folder

### Task 1.3: Add Project-Mode Commands

- **Location**: `framework/runtime/new-deck.mjs`, `check-deck.mjs`, `export-pdf.mjs`, `finalize-deck.mjs`, `deck-capture.mjs`
- **Description**: Add command support for project-path mode, likely via `--project /abs/path`.
- **Complexity**: 7
- **Dependencies**: Task 1.2
- **Acceptance Criteria**:
  - commands can operate on explicit project folders
  - existing deck/example flags still work during transition
- **Validation**:
  - smoke test both legacy and project-path flows

## Sprint 2: Add Copied Framework Mode

**Goal**: Let a project vendor its own framework snapshot safely.

**Demo/Validation**:

- create two projects, one linked and one copied
- verify copied project uses local framework files

### Task 2.1: Define Copy Scope

- **Location**: `templates/`, `framework/`, docs
- **Description**: Decide exactly which files copy into `.presentation/framework/` and which remain shared.
- **Complexity**: 6
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - copied mode includes mutable framework surfaces
  - canvas policy is explicitly defined
- **Validation**:
  - dry-run inventory and confirm no accidental omissions

### Task 2.2: Add `--copy-framework` Scaffold Option

- **Location**: `framework/runtime/new-deck.mjs`
- **Description**: Extend project creation to optionally copy the framework snapshot into the project.
- **Complexity**: 7
- **Dependencies**: Task 2.1
- **Acceptance Criteria**:
  - linked mode creates only project source files
  - copied mode creates `.presentation/framework/`
  - metadata records which mode was used
- **Validation**:
  - create one project in each mode and verify layout

### Task 2.3: Resolve Runtime Assets Against Local Snapshot When Present

- **Location**: `framework/runtime/runtime-app.js`, `deck-assemble.js`, server helpers
- **Description**: If project metadata says copied mode, serve framework/client/runtime assets from the project snapshot instead of the shared install.
- **Complexity**: 8
- **Dependencies**: Task 2.2
- **Acceptance Criteria**:
  - copied projects preview using their own local framework files
  - linked projects still use the shared framework
- **Validation**:
  - edit a copied project’s local framework file and confirm preview behavior changes only for that project

### Task 2.4: Preserve Trusted Validation And Finalize Authority

- **Location**: `framework/runtime/`, policy/finalize/export entrypoints
- **Description**: Ensure copied projects cannot override the host’s validation, capture, export, or finalize authority by editing local framework snapshot files.
- **Complexity**: 9
- **Dependencies**: Task 2.3
- **Acceptance Criteria**:
  - policy checks still come from the shared host install
  - finalize/export cannot be bypassed by editing project-local copied runtime files
  - copied framework affects rendering surfaces, not the trust boundary
- **Validation**:
  - intentionally modify copied project policy/runtime files and confirm the host still blocks invalid decks

## Sprint 3: Convert The Operator Console To Open-Folder Mode

**Goal**: Make the UI feel like VS Code for one project at a time.

**Demo/Validation**:

- launch console for one project folder
- terminal cwd and preview both point to that folder

### Task 3.1: Replace Workspace Selector With Open-Project State

- **Location**: `framework/console/`, `framework/runtime/server.mjs`
- **Description**: Remove the deck/example selector in project mode and replace it with a single opened project context.
- **Complexity**: 7
- **Dependencies**: Sprint 1
- **Acceptance Criteria**:
  - top bar shows current project path/name
  - preview points at `/preview/`
  - no multi-workspace browsing in primary mode
- **Validation**:
  - open two different projects in separate runs and confirm each console is scoped correctly

### Task 3.2: Root Terminal To Project Folder

- **Location**: `framework/runtime/terminal-session.js`
- **Description**: Make the terminal session start in `PROJECT_ROOT` instead of shared repo root.
- **Complexity**: 4
- **Dependencies**: Sprint 3.1
- **Acceptance Criteria**:
  - `pwd` equals opened project folder
  - shell session survives reloads
- **Validation**:
  - PTY smoke test from the console

### Task 3.3: Add “Open Folder / New Project” Flow

- **Location**: console UI + launch path
- **Description**: Add minimal project chooser/new-project UI for the operator console.
- **Complexity**: 7
- **Dependencies**: Sprint 3.1
- **Acceptance Criteria**:
  - users can create or open a folder without touching raw CLI flags
  - chosen folder determines project root for the session
- **Validation**:
  - create a project through the UI and confirm the preview/terminal bind to it

## Sprint 4: Add Project Upgrade And Maintenance Hooks

**Goal**: Keep copied mode sustainable while the framework evolves.

**Demo/Validation**:

- copied projects show framework version
- linked vs copied distinction is visible in the UI and metadata

### Task 4.1: Add Framework Version Recording

- **Location**: `new-deck.mjs`, metadata helpers
- **Description**: Record framework version, copy timestamp, and source revision in project metadata.
- **Complexity**: 4
- **Dependencies**: Sprint 2
- **Acceptance Criteria**:
  - copied projects can be traced back to the framework version they started from
- **Validation**:
  - inspect `project.json` after scaffold

### Task 4.2: Add Framework Drift Warnings

- **Location**: console UI, runtime metadata endpoints
- **Description**: Show whether a copied project is behind the current shared framework version.
- **Complexity**: 5
- **Dependencies**: Task 4.1
- **Acceptance Criteria**:
  - UI clearly distinguishes linked vs copied
  - copied projects can surface “framework snapshot differs from current install”
- **Validation**:
  - simulate a version mismatch and verify the warning

## Testing Strategy

- Unit-test metadata and path resolution for both linked and copied project modes.
- Smoke-test preview/export/finalize on:
  - legacy deck workspace
  - linked project folder
  - copied-framework project folder
- Verify copied mode isolates changes:
  - edit copied local framework file
  - confirm only that project changes
- Verify canvas remains protected even when copied locally.
- Verify operator console starts terminal in `PROJECT_ROOT`, not framework root.

## Potential Risks & Gotchas

- Copied mode can create long-term drift if no upgrade story exists.
- If canvas is copied and not protected, per-project divergence may destroy the shared visual contract.
- Supporting both legacy deck mode and project-folder mode temporarily will add complexity.
- The operator console will need a project-open UX; a browser-only UI cannot truly browse local folders without help from the launcher.
- Project-local framework snapshots may make debugging harder unless metadata is very explicit.

## Rollback Plan

- Keep legacy `decks/<slug>/` mode working until project-folder mode is stable.
- Gate copied-framework mode behind an explicit option instead of making it the only path immediately.
- If copied-mode routing causes instability, keep copied files on disk but continue resolving framework assets from the shared install until the snapshot path is solid.
