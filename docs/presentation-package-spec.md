# Presentation Package Spec

## Purpose

This document defines the canonical **v1 shell-less presentation project**.

The first shipped product is:
- one **installed system**
- containing the **core** and **CLI**
- with **no shell required**
- and a **Claude-first** project scaffold

A presentation project is created by `init` and then used primarily by Claude as the main agent.

The package separates five concerns cleanly:

1. **installed system** — shared sacred logic
2. **authored presentation workspace** — mutable project files
3. **hidden package machinery** — `.presentation/` state and shim
4. **hidden Claude adapter layer** — `/.claude/`
5. **user-facing deliverable** — exported PDF at the project root

The shell may be added later, but the core product must already work without it.

---

## Core Principle

The agent should author:
- presentation content
- deck-specific theme expression
- optional structured intent

The system should author:
- hidden project metadata
- deterministic generated structure
- runtime evidence
- local shim/wrapper files created by `init`
- protected Claude scaffold files under `/.claude/`
- final exported PDF artifacts produced by explicit commands

The package should not require a shell to function.

---

## Installed System Model

The installed system is the shared sacred layer.

It provides:
- the **core**
- the **CLI**
- `init`
- `inspect`
- `status`
- `audit`
- `preview`
- `export`
- `finalize` as a thin compatibility alias to `export`

The installed system owns:
- package semantics
- validators and audits
- preview assembly
- export orchestration
- deterministic issue language
- default project scaffolding templates

It does **not** own one presentation’s mutable authored content.

---

## Mutation Boundary

The rebuilt core enforces a hard authorship boundary.

### Only the agent may mutate authored content

After project creation/scaffolding, only the agent may change authored presentation content such as:
- `brief.md`
- `theme.css`
- `slides/<NNN-id>/slide.html`
- optional `slides/<NNN-id>/slide.css`
- author-managed assets under `assets/` and `slides/<NNN-id>/assets/`

Validators, audits, preview, export, finalize, hooks, and shells may inspect this content, render it, diagnose it, and report issues against it, but they must not silently repair or rewrite it.

### What the system may mutate

The headless core may still create or update system-owned files such as:
- `.presentation/project.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/design-state.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/framework-cli.mjs`
- scaffolded protected Claude adapter files under `/.claude/`
- the exported PDF at the project root

These are hidden project machinery or produced deliverables. They are not authored presentation content.

### Intent boundary

`/.presentation/intent.json` is authorable intent, but it is not allowed to define structural truth such as slide existence, slide ids, or slide order.

In normal authoring, the agent owns meaningful intent edits. The core may bootstrap an initial `intent.json` when scaffolding a project or repairing missing hidden project machinery, but that bootstrap behavior does not weaken the authored-content rule above.

### Validator and shell rule

Validators and reviewers may:
- inspect source
- classify issues
- produce deterministic findings
- block workflows
- route feedback into agent workflows

They may not:
- patch authored content directly
- auto-fix authored content
- bypass the agent by mutating source from the shell

A shell should show state and invoke operations. It should not become a second authoring authority.

---

## Operational Surface

The canonical core surface for the shell-less v1 product is:
- `presentation init ...`
- `presentation inspect ...`
- `presentation status ...`
- `presentation audit ...`
- `presentation preview ...`
- `presentation export ...`
- `presentation finalize ...` as a thin alias to `export`

Use them this way:
- `init` to scaffold a new project
- `inspect` for inventory and package facts
- `status` for interpreted workflow state
- `audit` for deterministic diagnostics
- `preview` for core-owned preview generation/serving
- `export` for explicit artifact emission of the root-level PDF
- `finalize` only as a compatibility alias in v1

The shell may later wrap these operations, but it does not define them.

---

## Package Layout

```text
<project-root>/
  brief.md
  theme.css
  slides/
    010-intro/
      slide.html
      slide.css                       # optional
      assets/                         # optional
    020-slide-02/
      slide.html
    030-close/
      slide.html
  assets/

  <project-slug>.pdf                  # appears after export/finalize

  .presentation/
    project.json
    intent.json
    package.generated.json
    runtime/
      design-state.json
      render-state.json
      artifacts.json
    framework-cli.mjs

  .claude/
    settings.json
    AGENTS.md
    CLAUDE.md
    hooks/
      run-presentation-stop-workflow.mjs
    rules/

  .git/
  .gitignore
```

### Root-level rule

The project root is the visible workspace.

It should contain:
- authored presentation files
- the final exported PDF

It should **not** contain hidden package machinery beyond `.presentation/` and `/.claude/`.

### Hidden-folder rule

`.presentation/` is hidden package machinery.

It should contain:
- metadata
- intent
- generated structure
- runtime evidence
- local shim/entrypoint

It should **not** be the main authored workspace.

### Claude-folder rule

`/.claude/` is the protected Claude adapter layer.

It should contain:
- Claude settings
- Claude guidance files
- Claude hooks
- Claude rules/support files

It is scaffolded by `init` and is not part of the mutable presentation layer.

---

## File Roles

### Authored presentation source

These files are the editable presentation source:
- `brief.md`
- `theme.css`
- `slides/<NNN-name>/slide.html`
- optional `slides/<NNN-name>/slide.css`
- `assets/`
- `slides/<NNN-name>/assets/`

They define the deck as humans and agents intentionally author it.

### Hidden project metadata

`/.presentation/project.json`

This is stable hidden project identity/metadata for the initialized project.

It should stay small and boring.

In v1 it should identify only what is necessary to:
- mark the folder as a valid presentation project
- record minimal schema/project information
- aid diagnostics

This file is system-owned and should not be edited during normal authoring.

### Editable authoring intent

`/.presentation/intent.json`

This is the structured package file the agent may author directly.

It is for meaning that deterministic code cannot infer from the filesystem, such as:
- audience
- objective
- tone
- target slide count
- narrative notes
- per-slide purpose
- per-slide editorial status

This is not structural truth. It is authoring intent.

### Deterministic generated package structure

`/.presentation/package.generated.json`

This is the authoritative structural manifest for the package.

It is regenerated from source by deterministic code and should never be hand-edited.

It answers questions like:
- what slides exist
- what order they are in
- which source files define them
- which optional files and assets exist
- whether brief and theme are present and complete enough to proceed

### Deterministic runtime evidence

`/.presentation/runtime/design-state.json`

Generated design-state evidence and orientation ledger. It is an index over canvas, theme, narrative, content, package structure, and runtime evidence. It is not authorable state.

`/.presentation/runtime/render-state.json`

Current remembered runtime truth about the latest explicit render-backed judgment, including:
- source fingerprint
- producer
- status
- slide ids
- canvas contract result
- console/runtime issues
- overflow state

`/.presentation/runtime/artifacts.json`

Current remembered artifact inventory, including the current exported PDF known to the system.

These files are evidence, not source.
They may be missing or stale relative to current authored state.

### Local project shim

`/.presentation/framework-cli.mjs`

This is the preferred local project entrypoint for agents.

It should:
- anchor execution to the current project
- resolve the installed system via standard package resolution
- perform lightweight project checks
- delegate into the installed core/CLI behavior
- fail clearly with repair guidance if the installed system is missing or unusable

It must not duplicate core semantics.

### Claude adapter layer

`/.claude/*`

This is the protected Claude adapter layer scaffolded by `init`.

It includes files such as:
- `/.claude/settings.json`
- `/.claude/AGENTS.md`
- `/.claude/CLAUDE.md`
- `/.claude/hooks/*`
- `/.claude/rules/*`

Its purpose is to help Claude operate correctly inside this project.

It is not part of the mutable authored presentation layer, and it is not the authority on core semantics.

### User-facing deliverable

`/<project-slug>.pdf`

This is the final user-facing PDF produced by `export` or `finalize`.

Users care about this artifact, not the hidden package machinery.

---

## Design System Placement

The design system is split across two levels.

### Installed core

The installed core holds the **shared framework design system**.

This includes:
- canvas/stage contract
- protected layout primitives
- token ownership rules
- theme boundary rules
- allowed structural affordances
- shared templates and starter visual grammar
- deterministic audit rules
- deterministic issue vocabulary for visual/system drift
- preview/render logic that interprets the framework correctly

This layer is shared, non-project-specific, and not agent-authored during normal presentation work.

### Project workspace

The project workspace holds the **deck-specific expression** of that shared design system.

This primarily lives in:
- `theme.css`
- `slides/**/slide.html`
- optional `slides/**/slide.css`
- deck assets under `assets/` and `slides/**/assets/`

#### `theme.css`

`theme.css` is the main project-level design-system file.

It should define the deck’s specific:
- palette
- typography choices
- spacing feel
- component styling
- visual tone
- reusable deck-local tokens

But it must do so within the framework constraints owned by the installed core.

### Hidden package machinery

`.presentation/` is not the primary home of design-system authorship.

It should hold only:
- metadata
- structure
- runtime evidence
- operational metadata

So design-system information appears there only as:
- remembered evidence
- generated design-state orientation
- generated structure
- validation outcomes
- operational metadata

### Exported PDF

The exported PDF is the **user-facing manifestation** of the design system.

Users do not need to understand framework tokens or hidden package files. They experience the design system only through:
- coherence
- consistency
- readability
- polish
- structure in the final presentation

---

## Ownership Matrix

### Agent can author

- `brief.md`
- `theme.css`
- `slides/<NNN-name>/slide.html`
- optional `slides/<NNN-name>/slide.css`
- `assets/`
- `slides/<NNN-name>/assets/`
- `.presentation/intent.json`

### Agent can trigger regeneration of, but must not author directly

- `.presentation/package.generated.json`

Editing source may cause this file to change, but deterministic package operations should write it.

### Agent can read, but should not author

- `.presentation/project.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/design-state.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/framework-cli.mjs`
- `/.claude/*`

### Runtime/core can write

- `.presentation/project.json` during init/repair flows
- `.presentation/package.generated.json`
- `.presentation/runtime/design-state.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/framework-cli.mjs`
- scaffolded `/.claude/*`
- the exported PDF at the project root

### System-only / protected

- installed shared core logic
- installed framework internals
- shared canvas internals
- local shim implementation details except during explicit system work
- `/.claude/*`

---

## Example File Shapes

### `project.json`

Illustrative example:

```json
{
  "projectMode": "project-folder",
  "projectName": "My Presentation",
  "projectSlug": "my-presentation",
  "projectSchemaVersion": 1,
  "createdWithCoreVersion": "1.0.0",
  "canvasPolicy": "protected"
}
```

V1 note:
- keep compatibility metadata minimal
- do not over-design version negotiation for the first shipped version

### `intent.json`

```json
{
  "schemaVersion": 1,
  "presentationTitle": "My Presentation",
  "audience": "internal leadership",
  "objective": "secure alignment on launch plan",
  "tone": "clear, concise, confident",
  "targetSlideCount": 8,
  "narrativeNotes": "Start with stakes, then decision, then rollout.",
  "slideIntent": {
    "intro": {
      "purpose": "Set stakes quickly",
      "status": "draft"
    },
    "launch-plan": {
      "purpose": "Explain phases and owners",
      "status": "ready"
    }
  }
}
```

### `package.generated.json`

```json
{
  "schemaVersion": 1,
  "project": {
    "slug": "my-presentation",
    "title": "My Presentation"
  },
  "source": {
    "brief": {
      "path": "brief.md",
      "exists": true,
      "complete": true
    },
    "theme": {
      "path": "theme.css",
      "exists": true
    },
    "sharedAssets": {
      "dir": "assets",
      "exists": true
    }
  },
  "slides": [
    {
      "id": "intro",
      "orderLabel": "010",
      "orderValue": 10,
      "dir": "slides/010-intro",
      "html": "slides/010-intro/slide.html",
      "css": "slides/010-intro/slide.css",
      "hasCss": false,
      "assetsDir": "slides/010-intro/assets",
      "hasAssetsDir": false
    }
  ],
  "counts": {
    "slidesTotal": 1
  }
}
```

### `runtime/render-state.json`

```json
{
  "schemaVersion": 1,
  "kind": "render-state",
  "sourceFingerprint": "sha256:...",
  "generatedAt": "2026-04-12T12:34:56.000Z",
  "producer": "preview",
  "status": "pass",
  "slideIds": ["intro", "slide-02", "close"],
  "previewKind": "slides",
  "canvasContract": {
    "valid": true,
    "violations": []
  },
  "consoleErrorCount": 0,
  "overflowSlides": [],
  "failures": [],
  "issues": [],
  "lastCheckedAt": "2026-04-12T12:34:56.000Z"
}
```

### `runtime/artifacts.json`

```json
{
  "schemaVersion": 1,
  "kind": "artifacts",
  "sourceFingerprint": "sha256:...",
  "generatedAt": "2026-04-12T12:35:10.000Z",
  "finalized": {
    "exists": true,
    "pdf": {
      "path": "my-presentation.pdf"
    }
  },
  "latestExport": {
    "exists": true,
    "format": "pdf",
    "pdf": {
      "path": "my-presentation.pdf"
    }
  }
}
```

---

## Package Workflow Model

A typical v1 package loop now looks like this:

1. install the system
2. run `presentation init /abs/path-to-project`
3. Claude operates inside the initialized project
4. edit root-level authored files
5. use `.presentation/framework-cli.mjs` as the preferred local project entrypoint
6. run `inspect` and `status` to orient
7. run `audit` to get deterministic diagnostics
8. run `preview open` or `preview serve` to inspect the rendered deck without a shell
9. run `export` to produce the root-level PDF (`finalize` is only an alias in v1)
10. use git directly for history, rollback, and milestone navigation

Hooks or shells may later wrap these operations, but the package meaning lives in the installed core plus the project-local shim.

---

## What This Solves

This package model removes recurring failure modes:

1. agents needing to know where the sacred installed core lives
2. hidden package machinery getting confused with authored source
3. user-facing deliverables being buried inside hidden system trees
4. shells becoming required before the core product is usable
5. framework design-system rules getting duplicated into each project
6. Claude integration being scattered across the authored workspace

With this model:
- source stays visible and editable
- hidden package machinery stays under `.presentation/`
- Claude adapter files stay under `/.claude/`
- the design system is shared in the installed core and expressed in the project theme/source
- the agent has a stable local project entrypoint
- the final PDF appears where the user expects it

---

## Status

Target v1 model:
- installed system ships core + CLI first
- shell is optional and deferred
- v1 project scaffolding is Claude-first
- preview is part of the core surface
- every project gets a hidden local shim in `.presentation/`
- the shim resolves the installed system using standard package resolution
- the shim fails hard with repair guidance when needed
- authored presentation files stay at the project root
- hidden package machinery stays under `.presentation/`
- protected Claude adapter files live under `/.claude/`
- the final exported PDF lands at the project root

Still evolving:
- the exact shell contract for later UI work
- richer preview/export options beyond the shell-less first version
- a fuller compatibility/migration story after real usage informs it
