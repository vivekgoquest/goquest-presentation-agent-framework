# Shell-less Hard Cleanup Design

## Summary

This design resets the repository to the shell-less product shape established in the package rehaul.

After this cleanup, the repository should present one clear product:

- an installed presentation package
- one canonical CLI surface
- one project-local shim
- one core-owned `init` flow
- one protected agent adapter scaffold under `/.claude/`

It should no longer present itself as an Electron product, a shell-managed product, or a framework-owned agent launcher.

The shell may be rebuilt later, but only as a thin adapter on top of the shell-less package. The shell must not remain in the current repository as active product code.

## Source of Truth

This design follows the newer shell-less package architecture spec as authoritative:

- `docs/superpowers/specs/2026-04-12-presentation-package-core-architecture-design.md`

Where older specs disagree, especially around project-root `AGENTS.md` versus `/.claude/AGENTS.md`, the newer shell-less spec wins.

In particular, the authoritative init shape is:

- authored source at project root
- package machinery under `.presentation/`
- protected agent adapter files under `/.claude/`
- a local project shim at `.presentation/framework-cli.mjs`

## Problem

The repository has drifted into a confusing hybrid shape:

- part shell-less CLI package
- part Electron desktop product
- part application/router layer for shell traffic
- part framework-owned agent launcher/orchestrator

That drift creates repeated ambiguity about:

- which path is canonical
- where `init` really lives
- whether the shell owns behavior or the package owns behavior
- whether agents should use the package directly or be launched by framework-owned wrappers
- whether wrapper commands are product surface or historical leftovers

The result is path confusion, duplicated behavior, and architecture that no longer reflects the shell-less rehaul.

## Goals

1. Make the repository fully shell-less.
2. Make the package and CLI the product.
3. Make `framework/runtime/presentation-cli.mjs` the canonical public CLI implementation.
4. Make `init` core-owned, full-fidelity, and ready-to-use.
5. Keep the finalized protected `/.claude/*` scaffold created by `init`.
6. Ensure agents use the CLI directly rather than being launched by framework-owned orchestration code.
7. Remove shell-driven routers, IPC layers, wrappers, and duplicate command paths.
8. Leave one official command surface only:
   - installed `presentation ...`
   - project-local `.presentation/framework-cli.mjs ...`
9. Preserve automatic git setup during `init`.
10. Make the cleanup a deliberate breaking change rather than carrying compatibility shims.

## Non-Goals

1. Rebuilding a new shell now.
2. Preserving Electron compatibility.
3. Preserving old wrapper command paths.
4. Keeping framework-owned agent launch/review/apply workflows.
5. Changing the finalized `/.claude/*` project scaffold contract established by the newer shell-less spec.
6. Redesigning the authored presentation package model.

## User-Approved Decisions

The following decisions are already established for this cleanup:

- hard-delete the Electron shell now
- use the newer runtime CLI implementation in `framework/runtime/presentation-cli.mjs`
- make the newer runtime CLI `init` create the complete project
- remove shell-era routing, shell-only adapters, and legacy wrapper extensions to the shell
- keep the finalized agent-specific scaffold created by `init`
- keep one official command path only
- remove built-in framework-owned agent-launching code
- keep automatic git setup in `init`
- remove repo-level shortcut commands such as `npm run new`, `npm run check`, and `npm run finalize`
- treat the cleanup as a breaking change, not a compatibility exercise
- keep `/.claude/hooks/*`, but make them thin CLI-only hooks with no shell coupling and no source mutation

## Recommended Cleanup Approach

Use a runtime-first hard cleanup.

This means:

- the official CLI comes from runtime
- the runtime/package layer owns product behavior
- the shell is deleted rather than slowly deprecated
- the repository stops presenting multiple behavioral entrypoints for the same thing
- any code retained outside runtime must directly serve the shell-less package, not a shell adapter

This is the cleanest way to restore the architecture to the shell-less rehaul without flattening every remaining directory in the same pass.

## Target Product Shape

After cleanup, the repository should effectively contain four useful concerns:

1. **Package/runtime core**
   - project/package semantics
   - CLI
   - preview
   - audit/status/inspect
   - export/finalize
   - runtime evidence
   - init/scaffold

2. **Framework assets and protected contracts**
   - canvas contract
   - browser-side deck behavior
   - starter templates

3. **Protected agent scaffold source**
   - the source files copied into `/.claude/*` by `init`

4. **Docs/tests for the shell-less package product**

The repository should not contain active product code for:

- Electron windows
- Electron IPC/request transport
- shell-driven action routing
- shell-facing product adapters
- framework-owned agent process launching
- duplicate wrapper CLIs around the canonical CLI

## Target End-to-End Flow

### 1. Installed command

The user installs the package and uses:

```bash
presentation <family> ...
```

This command is the canonical product surface.

It should be backed directly by:

- `framework/runtime/presentation-cli.mjs`

### 2. Core-owned init

The user or agent creates a project with:

```bash
presentation init --project /abs/path
```

That command must create a complete ready-to-use project, including:

- root authored files
- `.presentation/*`
- `.presentation/framework-cli.mjs`
- `/.claude/*`
- git initialization/setup

### 3. Project-local command

Inside a project, the local shim remains:

- `.presentation/framework-cli.mjs`

Its job is intentionally narrow:

- bind commands to the current project
- resolve the installed package through standard package resolution
- forward into the canonical CLI
- fail clearly if the installed package is missing or incompatible

It must not duplicate product behavior.

### 4. Agent usage model

The framework no longer launches agents for the user.

Instead:

- `init` creates the protected `/.claude/*` scaffold
- the agent reads those files
- the agent invokes the CLI directly
- the agent edits authored presentation files and other authorable package files only
- the framework remains the owner of deterministic package machinery and runtime evidence

### 5. Future shell posture

A future shell may be built later, but only as a thin client over the CLI/package.

That future shell must:

- call the package rather than re-owning workflow semantics
- remain replaceable
- not become the new primary architecture center

## Official Command Surface

After cleanup, only two official command paths should exist:

1. Installed package command:

```bash
presentation ...
```

2. Project-local shim:

```bash
node .presentation/framework-cli.mjs ...
```

No other path should be presented as official product usage.

In particular, remove shell-era or duplicate wrapper paths such as:

- application-level public bin wrappers whose main purpose is indirection to runtime
- repo-maintainer shortcut entrypoints that duplicate command families
- legacy single-purpose wrapper scripts for init/check/finalize/capture/export when the canonical CLI already owns those behaviors
- package.json scripts that market those wrappers as product usage

The shell-less product should teach one language, not several aliases for the same action.

## Command Families to Preserve

The canonical CLI should remain centered on the shell-less families established in the rehaul:

- `init`
- `inspect`
- `status`
- `audit`
- `preview open`
- `preview serve`
- `export`
- `finalize`

These should be the package-native operations that the user and the agent learn.

## Init Contract

### Init ownership

`init` is a core/package-owned scaffolding operation.

It should no longer depend on an outer shell wrapper to become “the real init.”

### Init output

A successful `init` must create the full shell-less project shape:

```text
<project-root>/
  brief.md
  theme.css
  slides/**
  assets/**
  <project-slug>.pdf          # appears after export/finalize
  .presentation/
    project.json
    intent.json
    package.generated.json
    runtime/
      render-state.json
      artifacts.json
    framework-cli.mjs
  .claude/
    settings.json
    AGENTS.md
    CLAUDE.md
    hooks/*
    rules/*
```

### Git setup

`init` should continue to set up git automatically.

However, git setup is part of project initialization hygiene, not the package’s primary semantic model. The command should:

- initialize git when appropriate
- create the initial project baseline
- report failures clearly instead of silently pretending git succeeded

### Init success guarantee

A successful `init` should guarantee that the project is ready for immediate shell-less use via:

- `presentation inspect`
- `presentation status`
- `presentation audit`
- `presentation preview open|serve`
- `presentation export`
- `presentation finalize`
- or the equivalent local shim invocations

## Agent Scaffold Contract

The newer shell-less spec already settled the protected project scaffold under `/.claude/*`.

This cleanup should preserve that outcome.

### What stays

`init` should continue to scaffold:

- `.claude/settings.json`
- `.claude/AGENTS.md`
- `.claude/CLAUDE.md`
- `.claude/hooks/*`
- `.claude/rules/*`

### What changes

Those files should no longer sit on top of framework-owned agent-launching/orchestration code.

Instead, they should guide the agent toward:

- the project-local shim
- the canonical `presentation` CLI
- the authored-vs-generated boundary rules
- the rule that meaningful fixes happen through the agent, not framework-owned auto-repair code

### Hooks posture

Hooks remain, but only as thin shell-less hooks.

They should:

- call the official CLI or local shim
- run deterministic non-mutating checks/workflows
- return feedback to the agent
- avoid shell coupling
- avoid source mutation
- avoid dependence on shell-specific action routers or Electron transport

They should not:

- launch or orchestrate agents on behalf of the framework
- depend on Electron code or shell adapters
- become a hidden second workflow system

## Authorship Boundary

The shell-less rehaul principle remains:

- the package owns deterministic structure and runtime evidence
- the agent owns meaningful authored changes

For this cleanup, that means the framework should continue distinguishing:

### Agent-editable / authorable

- `brief.md`
- `theme.css`
- `slides/**/slide.html`
- optional `slides/**/slide.css`
- presentation assets
- other explicitly authorable package files such as structured intent where the package contract allows it

### Framework-owned / not normal agent edit targets

- generated structure
- runtime evidence
- local shim implementation details
- protected `/.claude/*` adapter files

The cleanup should strengthen this boundary rather than muddy it.

## Keep / Remove Boundaries

### Keep

Keep the parts of the repository that directly serve the shell-less package product:

- `framework/runtime/`
- `framework/canvas/`
- `framework/client/`
- `framework/templates/`
- `project-agent/` scaffold-source pieces that exist only to populate `/.claude/*`
- docs/tests that describe and verify the shell-less product

### Remove

Remove code whose main purpose is shell ownership, shell transport, or framework-owned agent orchestration:

- `electron/` entirely
- Electron-specific tests
- Electron request routing and IPC contracts
- shell-facing action routers and adapters
- framework-owned agent-launching code and capability registries
- product wrappers whose main job is to redirect into the canonical CLI
- repo shortcut commands that advertise old paths
- shell-first docs that describe the desktop app as the product

### `framework/application/` posture

`framework/application/` may remain only where a module directly serves the shell-less package and has not yet been folded elsewhere.

But after cleanup it must not be:

- the public command surface
- a shell router
- an Electron bridge
- an action-routing layer for shell UI triggers
- a framework-owned agent launcher surface

In plain terms: keeping the directory is acceptable for now, but keeping shell logic inside it is not.

## Package.json and Public Surface Cleanup

After cleanup, package metadata should reflect the shell-less product honestly.

### Public bin/export posture

The package should expose:

- `presentation` as the canonical bin
- the runtime CLI/export surface needed by the local shim and installed usage

### Script posture

Remove repo-level product shortcut scripts such as:

- `npm run start`
- `npm run new`
- `npm run check`
- `npm run capture`
- `npm run export`
- `npm run finalize`

The remaining scripts should be maintainer-oriented only, such as test or repo maintenance tasks.

The product usage story should no longer be “run package-manager shortcuts from the framework repo.” It should be “use the installed CLI.”

## Documentation Cleanup

Repository documentation should be updated to describe the shell-less package as the current product.

This means removing or rewriting docs that still present:

- the Electron desktop app as the main workflow
- shell UI action routing as product architecture
- shell-specific startup instructions as current usage
- legacy wrapper commands as normal product usage

The docs should instead teach:

- install package
- run `presentation init`
- work in a project folder
- use `.presentation/framework-cli.mjs` locally when appropriate
- let the agent use the CLI directly

## Breaking Change Posture

This cleanup should be executed as a clean breaking change.

That means:

- do not preserve old shell entrypoints merely for nostalgia
- do not keep duplicate public paths to avoid short-term friction
- do not leave compatibility shims that keep the architecture ambiguous

The repository should become cleanly shell-less in one intentional move.

## Acceptance Criteria

The cleanup is complete when all of the following are true:

1. `electron/` and Electron product code are gone.
2. The canonical public CLI is `framework/runtime/presentation-cli.mjs`.
3. `presentation init` creates the full project, including `/.claude/*` and git setup.
4. `.presentation/framework-cli.mjs` is the only project-local entrypoint.
5. There is one official command language only:
   - `presentation ...`
   - `node .presentation/framework-cli.mjs ...`
6. Framework-owned agent-launch/review/apply orchestration code is gone.
7. `/.claude/hooks/*` remain, but are thin shell-less hooks over the official CLI.
8. Repo-level shortcut scripts for product usage are gone.
9. Docs describe the shell-less package, not the desktop app, as the product.
10. Tests verify the shell-less end-to-end contract rather than legacy shell pathways.
11. A future shell could be rebuilt later as a thin adapter without reintroducing product ownership confusion.

## Implementation Priorities

This design suggests the following execution order:

1. make runtime CLI the sole public command surface
2. move full `init` ownership into the runtime CLI path
3. remove framework-owned agent launch/orchestration code
4. delete Electron and shell transport layers
5. delete wrapper commands and package-manager shortcut product paths
6. simplify hooks to thin CLI-only behavior
7. rewrite docs/tests around the shell-less product

This order reduces confusion early by first making the command surface and init path unambiguous, then removing the shell-era layers around them.

## Rationale in One Sentence

The repository should stop behaving like a desktop app with a bolted-on CLI and instead become what the rehaul established: a shell-less presentation package with one CLI, one local shim, one full init flow, one protected agent scaffold, and no shell-owned behavior.