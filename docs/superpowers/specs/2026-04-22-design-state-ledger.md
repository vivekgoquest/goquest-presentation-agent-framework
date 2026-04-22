# Design State Ledger

## Summary

The presentation package needs one stable context surface that agents can read before authoring, reviewing, or finalizing a deck.

That surface should not be an author-maintained `DESIGN.md` that competes with the current package model. It should be a generated **Design State Ledger**: a runtime-owned snapshot of current design, narrative, canvas, package, and audit facts.

The ledger gives agents a compact answer to:

- what is fixed
- what is currently working
- where the authoritative source lives
- what changed since the last runtime snapshot
- what would count as cross-layer drift

The core principle is:

```text
Single context surface, not single authority.
```

## Problem

Presentation authoring is iterative. Users rarely know the full theme or content at the beginning of a deck.

In normal use:

- the canvas stays fixed
- the theme keeps changing
- the narrative keeps changing
- the slide content keeps changing
- assets, logos, backgrounds, and visual treatments keep changing
- nothing theme/content-related is truly frozen until export or finalize

Current repo contracts already separate canvas, theme, and content, but agents must gather that context from several files:

- `framework/canvas/canvas-contract.mjs`
- `framework/canvas/canvas.css`
- `theme.css`
- `.presentation/intent.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/*.json`
- `outline.md`
- `slides/`
- scaffolded `.claude/rules/*`
- maintainer docs

That fragmentation increases agent drift. A new agent can miss which surface owns which decision, infer stale context from prior edits, or invent one-off theme language inside slide-local content.

## User Mental Model

The user is not maintaining a design system. The user is making a presentation.

The useful mental model is:

```text
Canvas = fixed physical stage
Theme = evolving slide master
Content = evolving story, assets, and slide-by-slide expression
Agent = narrative and design guide operating inside boundaries
```

Canvas is structure-only. It defines:

- slide size
- aspect ratio
- generated scaffold
- legal roots
- structural primitives
- ownership boundaries

Canvas does not define:

- color palette
- typography mood
- logo treatment
- image/video treatment
- visual taste
- narrative or slide content

Theme is the slide master. It may define:

- logos and logo placement
- image and video treatment
- backgrounds
- typography hierarchy
- color palette
- recurring card, table, stat, badge, quote, or divider language
- density and rhythm preferences
- visual treatments that should repeat across slides

Content is the live deck work. It includes:

- story spine
- slide sequence
- slide intent
- text
- images
- videos
- charts
- proof points
- local composition

The user should be able to keep tweaking theme and content until export. The system should support that loop rather than treating every theme change as drift.

## Source Of Truth Model

The ledger must not become a second source of truth.

Authoritative sources remain:

- canvas truth: `framework/canvas/canvas-contract.mjs` and effective framework canvas assets
- theme truth: project `theme.css`
- package structure truth: `.presentation/package.generated.json`
- author intent truth: `.presentation/intent.json`
- narrative/content truth: `outline.md` and `slides/`
- runtime evidence truth: `.presentation/runtime/*.json`
- enforcement truth: `framework/runtime/deck-policy.js` and `presentation audit`

The ledger is an index and snapshot over those sources.

It should be generated, not hand-edited.

## Why Not Copy Google DESIGN.md Literally

Google's `DESIGN.md` structure is useful because it combines:

- machine-readable commitments
- human-readable rationale
- lintable rules
- diffable design evolution

That is valuable for agents.

But the literal schema is not a full fit for this package because it assumes a more conventional product UI design system built around:

- colors
- typography
- spacing
- rounded corners
- components

This package needs a different contract:

- fixed canvas physics
- evolving slide master
- evolving narrative/content
- cross-layer ownership
- export/finalize snapshots
- runtime evidence

The package should borrow the anti-drift discipline, not the whole format.

## Target Artifact

The first ledger artifact should be:

```text
.presentation/runtime/design-state.json
```

It is runtime-owned evidence.

It should be refreshed by package commands that already normalize or inspect project state:

- `presentation inspect package`
- `presentation status`
- `presentation audit ...`
- `presentation preview ...`
- `presentation export ...`
- `presentation finalize`

The project-local shim should expose the same behavior.

## Ledger Shape

The v1 ledger should be concrete and conservative.

It should prefer observable facts and fingerprints over subjective interpretation.

Example structure:

```json
{
  "kind": "presentation-design-state",
  "version": 1,
  "generatedAt": "2026-04-22T00:00:00.000Z",
  "project": {
    "root": "/abs/path/to/project",
    "slug": "project-slug"
  },
  "authority": {
    "canvas": "framework/canvas/canvas-contract.mjs",
    "theme": "theme.css",
    "intent": ".presentation/intent.json",
    "structure": ".presentation/package.generated.json",
    "runtime": ".presentation/runtime/"
  },
  "canvas": {
    "status": "fixed",
    "stage": {
      "slideMaxWidth": 1200,
      "slideWideMaxWidth": 1300,
      "slideRatio": "16 / 9"
    },
    "structuralTokens": [],
    "protectedSelectors": [],
    "allowedThemeVariables": []
  },
  "theme": {
    "status": "working",
    "source": "theme.css",
    "fingerprint": "sha256:...",
    "observedTokens": [],
    "observedPrimitives": [],
    "canvasVariablesUsed": [],
    "assetReferences": []
  },
  "narrative": {
    "status": "working",
    "sources": [".presentation/intent.json", "outline.md", "slides/"],
    "slideCount": 0,
    "slidePurposes": []
  },
  "content": {
    "status": "working",
    "slideRoots": [],
    "slideCssFiles": [],
    "assetReferences": []
  },
  "audit": {
    "lastKnownStatus": "unknown",
    "families": {}
  },
  "driftRules": {
    "changeIsAllowed": true,
    "untrackedLayerBypassIsNotAllowed": true
  },
  "fingerprints": {
    "theme": "sha256:...",
    "intent": "sha256:...",
    "outline": "sha256:...",
    "slides": "sha256:..."
  }
}
```

The example is illustrative, not a frozen schema. The important point is that every field either:

- names an authority
- reports an observed fact
- records a fingerprint
- summarizes audit state
- describes a package rule

## Lifecycle

### Scaffold

On project creation:

- canvas is fixed
- default `theme.css` exists
- `.presentation/intent.json` starts sparse
- slides are scaffolded
- `.presentation/package.generated.json` is generated
- `.presentation/runtime/design-state.json` is generated

At this point theme/content are working, not locked.

### Authoring

During normal edits:

- users may change theme and content freely
- agents may revise theme and content as part of narrative/design work
- canvas remains fixed
- the ledger is regenerated by package commands
- audits check layer ownership, not taste

Drift is not "the theme changed."

Drift is:

- content bypassed theme
- theme broke canvas
- slide-local CSS introduced reusable visual language that belongs in theme
- runtime context is stale relative to current source fingerprints
- an agent acted from stale design context

### Export And Finalize

Export/finalize are the snapshot boundary.

At export/finalize, runtime evidence should record:

- current canvas contract identity
- current theme fingerprint
- current intent/narrative fingerprints
- current slide/source fingerprints
- current design ledger fingerprint
- artifact outputs

This does not mean the deck can never change again. It means the exported artifact can be traced back to the exact design and content state that produced it.

## Agent Workflow

Agents should read the ledger first.

The intended startup loop is:

1. Read `.presentation/runtime/design-state.json`.
2. Follow the `authority` pointers to the source files relevant to the task.
3. If the ledger is missing or stale, run the local CLI command that regenerates it.
4. Make theme/content edits in the authoritative files.
5. Run `presentation audit all` or the project-local equivalent.
6. Let the runtime refresh the ledger.
7. Report changed source files and verification evidence.

The ledger should reduce first-contact confusion. It should not replace reading the actual source when editing.

## Audit Behavior

The existing audit families remain primary:

- `theme`
- `canvas`
- `boundaries`

A future `design` audit family may be added after the ledger exists.

V1 audit behavior should remain deterministic:

- the ledger is present when expected
- the ledger fingerprints match current source files
- the canvas section matches the installed/effective canvas contract
- the theme uses only allowed canvas variables
- slide CSS remains scoped
- slide CSS does not restyle protected canvas selectors
- slide CSS does not redefine theme primitives with colors, typography, borders, or shadows

V1 should not try to judge whether a theme is tasteful or whether the narrative is persuasive. Those are agent/user cognitive tasks, not deterministic policy checks.

## Relationship To `.presentation/intent.json`

The ledger should not immediately force a larger authoring schema.

V1 should generate useful context from existing sources first.

After that proves useful, `.presentation/intent.json` may be extended with minimal authorable design fields such as:

- `designIntent`
- `visualFlow`
- `themeNotes`
- `assetTreatmentNotes`
- per-slide visual intent

Those fields should remain authoring intent, not enforcement truth by themselves. Enforcement should still compare actual source behavior against package rules.

## Relationship To A Human-Friendly DESIGN.md

A human-friendly `DESIGN.md` may be useful later as a generated view or export.

It should not be the v1 source artifact.

Possible later roles:

- render the ledger into Markdown for agents or humans
- summarize the active slide master
- explain canvas/theme/content boundaries
- provide a portable design handoff

If added, it should be generated from runtime/source truth or explicitly marked as advisory. It should not become another editable contract during normal authoring.

## Failure Modes And Controls

### Stale Ledger

Risk:

- an agent reads outdated context and makes edits from stale assumptions

Controls:

- include source fingerprints
- regenerate during inspect/status/audit/export/finalize
- make stale ledger detection a deterministic audit issue

### Second Source Of Truth

Risk:

- ledger content conflicts with `theme.css`, `intent.json`, or slides

Controls:

- keep the ledger generated
- store authorable intent in existing authorable files
- always point each ledger section back to its authority

### Authoring Bureaucracy

Risk:

- every small user tweak requires manual ledger maintenance

Controls:

- never require manual ledger edits
- treat theme/content as `working`
- refresh from source

### Over-Inference From CSS

Risk:

- runtime pretends to understand visual taste from CSS and produces misleading summaries

Controls:

- extract concrete facts first
- do not infer subjective theme descriptions in v1
- keep richer design rationale in authorable intent fields later, if needed

### Weak Enforcement

Risk:

- the ledger becomes a passive summary that agents ignore

Controls:

- require agents to read it in scaffolded instructions
- surface stale/missing ledger in status/audit
- include `nextFocus` guidance pointing back to authoritative files

## Non-Goals

1. Replacing `theme.css`.
2. Replacing `canvas-contract.mjs`.
3. Replacing `.presentation/intent.json`.
4. Replacing `outline.md` or slide source files.
5. Creating an author-maintained Google-style `DESIGN.md` as the main contract.
6. Freezing theme or content before export.
7. Judging subjective taste in deterministic audits.
8. Inferring a complete semantic design system from CSS in v1.
9. Moving canvas aesthetics into the canvas layer.

## Recommended Implementation Direction

Build this incrementally.

1. Define a small generated ledger schema.
2. Generate it from existing project state and canvas/theme/content sources.
3. Write it to `.presentation/runtime/design-state.json`.
4. Include source fingerprints.
5. Expose it through `inspect package` or a nearby inspect/status surface.
6. Refresh it during audit/finalize paths.
7. Add stale-ledger detection once generation is stable.
8. Only later consider extending `.presentation/intent.json` with design-intent fields.
9. Only later consider generated Markdown views.

The first useful version should make agents better oriented without changing how users author decks.

## Open Architectural Decision

The main remaining decision is whether the first implementation should:

1. only generate `.presentation/runtime/design-state.json`, or
2. also add explicit `designIntent` fields to `.presentation/intent.json`.

The recommended choice is option 1.

Generate the ledger first. Let it prove useful as an orientation and drift-control artifact before expanding the authorable intent model.
