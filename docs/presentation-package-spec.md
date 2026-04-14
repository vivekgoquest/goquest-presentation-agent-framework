# Presentation Package Spec

## Purpose

This document defines the canonical user-facing structure of a scaffolded presentation project.

The rebuilt core separates six concerns cleanly:

1. authored source
2. authored intent
3. deterministic generated structure
4. deterministic runtime evidence
5. delivery outputs
6. git-backed agent-internal history

This package model exists so:

- humans can edit the presentation naturally
- agents do not need to hand-maintain structural bookkeeping
- runtime can record what was most recently observed
- delivery outputs are clearly separated from evidence
- git remains the history lane for agent work

## Core Principle

The agent should author:

- content
- editorial intent
- optional narrative metadata

The system should author:

- package structure
- runtime evidence
- artifact inventory
- delivery outputs produced by explicit commands

Git should record:

- evolution over time
- agent milestones
- diffs between meaningful states

The package should not maintain a separate history file alongside git.

## Mutation Boundary

The rebuilt core enforces a hard authorship boundary.

### Only the agent may mutate authored content

After project creation/scaffolding, only the agent may change authored presentation content such as:

- `brief.md`
- `theme.css`
- `slides/<NNN-id>/slide.html`
- optional `slides/<NNN-id>/slide.css`
- author-managed assets under `assets/` and `slides/<NNN-id>/assets/`

Validators, audits, status checks, export flows, finalize flows, hooks, and shells may inspect this content, render it, diagnose it, and report issues against it, but they must not silently repair or rewrite it.

### What the system may mutate

The headless core may still create or update system-owned files such as:

- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- canonical delivery outputs under `outputs/finalized/`
- ad hoc export outputs under `outputs/exports/`

These are generated structure, runtime evidence, and delivery artifacts. They are not authored presentation content.

### Intent boundary

`/.presentation/intent.json` is authorable intent, but it is not allowed to define structural truth such as slide existence, slide ids, or slide order.

In normal authoring, the agent owns meaningful intent edits. The core may bootstrap an initial `intent.json` when scaffolding a project or regenerating missing system files, but that bootstrap behavior does not weaken the authored-content rule above.

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

## Operational Surface

The package’s canonical command families are:

- `presentation inspect ...`
- `presentation status ...`
- `presentation audit ...`
- `presentation finalize ...`
- `presentation export ...`

Use them this way:

- `inspect` for inventory and package facts
- `status` for interpreted workflow state
- `audit` for deterministic diagnostics
- `finalize` for canonical delivery outputs under `outputs/finalized/`
- `export` for ad hoc artifacts under `outputs/exports/<run-id>/`

## Package Layout

```text
<project-root>/
  brief.md
  theme.css
  outline.md                          # optional, long decks
  slides/
    010-intro/
      slide.html
      slide.css                       # optional
      assets/                         # optional
    020-problem/
      slide.html
  assets/

  outputs/
    finalized/
      deck.pdf
      full-page.png
      report.json
      summary.md
      slides/
        slide-intro.png
        slide-problem.png
    exports/
      <run-id>/
        pdf/
          my-presentation.pdf
        screenshots/
          slide-intro.png

  .presentation/
    project.json
    intent.json
    package.generated.json
    runtime/
      render-state.json
      artifacts.json
    framework/
      base/
      overrides/

  .claude/
  .git/
  .gitignore
```

## File Roles

### Authored source

These files are the editable presentation source:

- `brief.md`
- `theme.css`
- `outline.md` when required
- `slides/<NNN-name>/slide.html`
- optional `slides/<NNN-name>/slide.css`
- `assets/`
- `slides/<NNN-name>/assets/`

They define the deck as humans and agents intentionally author it.

### Stable package identity

`/.presentation/project.json`

This is stable package identity and framework linkage. It should stay boring.

It holds package-level facts such as:

- project identity
- framework linkage mode
- framework version/source
- protected package invariants such as canvas policy

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
- whether brief, outline, and theme are present and complete enough to proceed

### Deterministic runtime evidence

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

Current remembered artifact inventory, split into:

- canonical finalized outputs
- latest ad hoc export inventory

These files are evidence, not source.
They may be missing or stale relative to current authored state.

### Delivery outputs

`/outputs/finalized/`

This is the canonical delivery boundary produced by `presentation finalize`.

Typical contents:

- `outputs/finalized/deck.pdf`
- `outputs/finalized/full-page.png`
- `outputs/finalized/report.json`
- `outputs/finalized/summary.md`
- `outputs/finalized/slides/*.png`

`/outputs/exports/<run-id>/`

This is the ad hoc export area produced by `presentation export`.

Typical contents:

- selected-slide PDFs
- screenshot sets
- other non-canonical delivery artifacts

### Git-backed agent-internal history

`/.git/`

Git is the history lane for the package.

It should be treated as:

- evolution log
- milestone history
- diff/navigation substrate

It should not be treated as:

- the current structural manifest
- the current runtime evidence record
- the delivery output directory

## Ownership Matrix

### Agent can author

- `brief.md`
- `theme.css`
- `outline.md` when applicable
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
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`

### Runtime can write

- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `outputs/finalized/**`
- `outputs/exports/**`

### System-only / protected

- `.presentation/framework/`
- shared framework internals
- canvas internals
- scaffolded `.claude/` package structure except during explicit framework work

## Example File Shapes

### `project.json`

Illustrative example:

```json
{
  "projectMode": "project-folder",
  "projectName": "My Presentation",
  "projectSlug": "my-presentation",
  "frameworkMode": "linked",
  "frameworkVersion": "1.0.0",
  "frameworkSource": "/abs/path/to/framework",
  "frameworkSourceVersion": "1.0.0",
  "frameworkCopiedAt": null,
  "canvasPolicy": "protected"
}
```

Implementation note:
- current scaffolded `project.json` still includes a legacy `historyPolicy` field for compatibility
- in the rebuilt core, git is the real history substrate and callers should not treat that field as a user-facing workflow concept

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
    "outline": {
      "path": "outline.md",
      "exists": false,
      "required": false,
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
  "producer": "finalize",
  "status": "pass",
  "slideIds": ["intro", "problem", "close"],
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
    "outputDir": "outputs/finalized",
    "pdf": {
      "path": "outputs/finalized/deck.pdf"
    },
    "fullPage": {
      "path": "outputs/finalized/full-page.png"
    },
    "report": {
      "path": "outputs/finalized/report.json"
    },
    "summary": {
      "path": "outputs/finalized/summary.md"
    },
    "slides": [
      {
        "id": "intro",
        "path": "outputs/finalized/slides/slide-intro.png"
      }
    ]
  },
  "latestExport": {
    "exists": true,
    "format": "pdf",
    "outputDir": "outputs/exports/2026-04-12T12-40-00Z/pdf",
    "pdf": {
      "path": "outputs/exports/2026-04-12T12-40-00Z/pdf/my-presentation.pdf"
    },
    "slides": [],
    "artifacts": [
      {
        "path": "outputs/exports/2026-04-12T12-40-00Z/pdf/my-presentation.pdf"
      }
    ]
  }
}
```

## Package Workflow Model

A typical package loop now looks like this:

1. author source and intent
2. run `presentation inspect ...` to orient
3. run `presentation status ...` to understand workflow state
4. run `presentation audit ...` to get deterministic diagnostics
5. run `presentation finalize ...` to produce canonical delivery outputs
6. run `presentation export ...` for non-canonical artifact requests
7. use git directly for history, rollback, and milestone navigation

Hooks or adapters may surface diagnostics, but the package meaning lives in these package-level operations.

## What This Solves

This package model removes recurring failure modes:

1. agents forgetting to update structural bookkeeping
2. runtime evidence being mixed with delivery outputs
3. delivery artifacts being confused with source
4. history semantics being spread across package files instead of git

With this model:

- source stays editable
- structure stays deterministic
- evidence stays explicit
- delivery outputs stay legible
- git remains the history substrate

## Status

Implemented now:

- `.presentation/intent.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- split delivery output layout under `outputs/finalized/` and `outputs/exports/`
- package-oriented CLI families for inspect, status, audit, finalize, and export

Still evolving:

- broader inspect/status subcommands over the same package model
- richer deterministic explanation layers for audits and status
- any future migration tooling beyond the current regeneration-on-use behavior
