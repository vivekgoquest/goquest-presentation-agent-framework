# Presentation Package Spec

## Purpose

This document defines the canonical structure of a scaffolded presentation project.

The goal is to separate five concerns cleanly:

1. authored source
2. editable authoring intent
3. deterministic generated package structure
4. deterministic runtime evidence
5. git-backed history

This package model exists so:

- humans can edit the deck naturally
- agents do not need to remember structural bookkeeping
- runtime can prove what actually renders
- the product can distinguish current authoring state from last known-good visual state

## Core Principle

The agent should author:

- content
- editorial intent
- optional narrative metadata

The system should author:

- package structure
- runtime evidence
- artifact inventory
- validation truth

Git should record:

- evolution over time
- checkpoints between meaningful states

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
    deck.pdf
    full-page.png
    report.json
    summary.md
    slides/
      slide-intro.png
      slide-problem.png

  .presentation/
    project.json
    intent.json
    package.generated.json
    runtime/
      render-state.json
      artifacts.json
      last-good.json
    framework-cli.mjs
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

It holds:

- project identity
- framework linkage mode
- framework version/source
- protected package invariants such as canvas policy

This file is system-owned and should not be edited during normal authoring.

### Editable authoring intent

`/.presentation/intent.json`

This is the only structured package file the agent should be allowed to author directly.

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

It should be regenerated from source by deterministic code and never hand-edited.

It should answer:

- what slides exist
- what order they are in
- which source files define them
- which optional files/assets exist
- whether brief/outline/theme are present and complete enough to proceed

### Deterministic runtime evidence

`/.presentation/runtime/render-state.json`

Current runtime truth about:

- preview kind
- quality/policy/canvas state
- source fingerprint
- last checked timestamp

`/.presentation/runtime/artifacts.json`

Current artifact inventory for:

- PDF
- full-page PNG
- per-slide PNGs
- report
- summary

`/.presentation/runtime/last-good.json`

The last known-good visual/runtime checkpoint. This should link:

- source fingerprint
- render fingerprint
- slide ids
- artifact paths
- git commit

### Git-backed history

`/.git/`

Git is the history lane for the package.

It should be treated as:

- evolution log
- checkpoint history
- delta source between states

Git should not be treated as:

- the current structural manifest
- the current runtime truth
- the only place render evidence lives

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

Editing source may cause this file to change, but the stop hook or runtime regeneration should write it.

### Agent can only read

- `.presentation/project.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/last-good.json`

### Runtime can write

- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/last-good.json`
- `outputs/*`

### System-only / protected

- `.presentation/framework-cli.mjs`
- `.presentation/framework/`
- shared framework internals
- canvas internals
- scaffolded `.claude/` package structure except during explicit framework work

## Example File Shapes

### `project.json`

```json
{
  "schemaVersion": 1,
  "projectMode": "project-folder",
  "projectName": "My Presentation",
  "projectSlug": "my-presentation",
  "frameworkMode": "linked",
  "frameworkVersion": "1.0.0",
  "frameworkSource": "/abs/path/to/framework",
  "frameworkSourceVersion": "1.0.0",
  "frameworkCopiedAt": null,
  "canvasPolicy": "protected",
  "historyPolicy": "checkpointed"
}
```

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
  "projectSlug": "my-presentation",
  "title": "My Presentation",
  "brief": {
    "path": "brief.md",
    "exists": true,
    "complete": true
  },
  "outline": {
    "path": "outline.md",
    "exists": false,
    "required": false,
    "complete": false
  },
  "theme": {
    "path": "theme.css",
    "exists": true
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
  "sharedAssets": {
    "dir": "assets",
    "exists": true
  },
  "outputs": {
    "dir": "outputs"
  },
  "counts": {
    "slidesTotal": 1
  }
}
```

### `runtime/render-state.json`

```json
{
  "schemaVersion": 1,
  "status": "pass",
  "previewKind": "slides",
  "slideIds": ["intro", "problem", "close"],
  "canvasContract": {
    "status": "pass",
    "violations": []
  },
  "policy": {
    "status": "pass",
    "warnings": [],
    "errors": []
  },
  "quality": {
    "status": "pass",
    "warnings": []
  },
  "lastCheckedAt": "2026-03-22T15:40:00.000Z",
  "sourceFingerprint": "sha256:..."
}
```

### `runtime/artifacts.json`

```json
{
  "schemaVersion": 1,
  "pdf": {
    "path": "outputs/deck.pdf",
    "exists": true,
    "generatedAt": "2026-03-22T15:41:00.000Z"
  },
  "fullPage": {
    "path": "outputs/full-page.png",
    "exists": true
  },
  "slides": [
    {
      "id": "intro",
      "path": "outputs/slides/slide-intro.png",
      "exists": true
    }
  ],
  "report": {
    "path": "outputs/report.json",
    "exists": true
  },
  "summary": {
    "path": "outputs/summary.md",
    "exists": true
  }
}
```

### `runtime/last-good.json`

```json
{
  "schemaVersion": 1,
  "status": "pass",
  "sourceFingerprint": "sha256:...",
  "renderStateFingerprint": "sha256:...",
  "approvedAt": "2026-03-22T15:41:00.000Z",
  "slideIds": ["intro", "problem", "close"],
  "artifacts": {
    "pdf": "outputs/deck.pdf",
    "slides": [
      "outputs/slides/slide-intro.png",
      "outputs/slides/slide-problem.png",
      "outputs/slides/slide-close.png"
    ]
  },
  "gitCommit": "abc123def456"
}
```

## Stop-Hook Pipeline

At each stop turn, the hook pipeline should run in this order:

1. regenerate `.presentation/package.generated.json`
2. validate source against generated package structure
3. validate `intent.json` references against package structure
4. run deck policy, canvas contract, quality, and render checks
5. update runtime evidence files
6. optionally checkpoint to git when the state is clean

The hook should not ask the agent to remember or hand-maintain the structural manifest.

The hook should enforce agreement between:

- source truth
- generated package truth
- runtime/render truth

## What This Solves

This package model removes three recurring failure modes:

1. agents forgetting to update structural bookkeeping
2. runtime truth being spread across transient checks and logs
3. user-visible state having no durable linkage to the source and commit that produced it

With this model:

- source stays editable
- structure stays deterministic
- runtime proof stays explicit
- history stays auditable

## Status

Implemented now:

- `.presentation/intent.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/runtime/last-good.json`
- deterministic regeneration during preview/check/finalize flows
- package-oriented stop hook through `.claude/hooks/check-presentation-package.mjs`
  delegating to application-owned workflow services

Still evolving:

- richer runtime fingerprints in `last-good.json`
- broader Electron-facing query summaries over package/runtime evidence
- any future migration tooling beyond the current automatic regeneration-on-use behavior
