# Project-Root AGENTS Portability Spec

## Summary

Make each scaffolded presentation project self-describing and reduce the Claude
adapter to a thin vendor layer.

After this change:

- the universal startup file is `<project>/AGENTS.md`
- machine-readable project truth stays under `<project>/.presentation/`
- `<project>/.claude/` becomes a vendor-specific adapter only

## Problem

Today a first-run project agent starts from `.claude/CLAUDE.md` and `.claude/skills/*`.
That works for Claude, but it makes too much presentation knowledge live in the
agent layer.

That causes two portability problems:

1. a non-Claude agent does not get a universal project startup contract
2. project meaning is duplicated across vendor-specific docs instead of living in
   the presentation package itself

## Goals

- make the project self-describing for any agent
- make startup deterministic
- keep presentation truth in the presentation package
- preserve current Claude hooks and skills without changing runtime behavior

## Non-Goals

- removing `.claude/`
- changing the `.presentation/` package model
- changing runtime policy or canvas semantics
- changing project-folder source layout

## Target Contract

Each scaffolded project should contain:

```text
<project-root>/
  AGENTS.md
  brief.md
  theme.css
  outline.md
  slides/
  assets/
  outputs/
  .presentation/
    project.json
    intent.json
    package.generated.json
    runtime/
      render-state.json
      artifacts.json
      last-good.json
  .claude/
    CLAUDE.md
    settings.json
    hooks/
    skills/
```

### AGENTS.md responsibilities

`AGENTS.md` is the universal startup contract and must define:

- startup read order
- package truth files
- editable vs read-only files
- core authoring rules
- required commands
- expected handoff
- vendor adapter note

### .presentation responsibilities

`.presentation/` remains the machine-readable package contract:

- `project.json` for stable identity
- `intent.json` for authoring intent
- `package.generated.json` for deterministic structure
- `runtime/*.json` for runtime evidence

### .claude responsibilities

`.claude/` becomes a Claude adapter layer only:

- `CLAUDE.md` is a thin shim that points to `../AGENTS.md`
- `settings.json` owns hook wiring
- `hooks/` own stop enforcement
- `skills/` own Claude workflow helpers

`.claude/` must not be treated as the source of presentation structure or state.

## Implementation

### 1. Scaffold a project-root AGENTS.md

Add a new source template:

- `project-agent/project-agents-md.md`

Update scaffold package export:

- `project-agent/scaffold-package.mjs`

New projects must receive:

- `<project>/AGENTS.md`

### 2. Make CLAUDE.md a thin adapter

Reduce:

- `project-agent/project-claude-md.md`

So that it:

- tells Claude to read `../AGENTS.md` first
- points to `.claude/settings.json`, `.claude/hooks/`, and `.claude/skills/`
- explicitly says presentation truth lives in `.presentation/*`

### 3. Change the launcher prompt order

Update:

- `project-agent/agent-launcher.mjs`

For project-scoped capabilities, the prompt must tell the spawned agent to read:

1. `<project>/AGENTS.md`
2. `<project>/.claude/CLAUDE.md`
3. `<project>/.claude/skills/<capability>/SKILL.md`

Keep `cwd = projectRoot` and `--add-dir projectRoot`.

### 4. Slim duplicated Claude-layer guidance

Update these files to point to `AGENTS.md` instead of carrying the main project
contract themselves:

- `project-agent/project-dot-claude/rules/framework.md`
- `project-agent/project-dot-claude/rules/file-boundaries.md`
- `project-agent/project-dot-claude/rules/authoring-rules.md`
- `project-agent/project-dot-claude/skills/new-deck/SKILL.md`
- `project-agent/project-dot-claude/skills/revise-deck/SKILL.md`
- `project-agent/project-dot-claude/skills/review-deck/SKILL.md`
- `project-agent/project-dot-claude/skills/fix-warnings/SKILL.md`

The goal is not to delete all helpful guidance. The goal is to make the project
contract authoritative and the Claude layer derivative.

### 5. Update repo docs

Update:

- `README.md`
- `START-HERE.md`

So they reflect:

- scaffolded projects now include root `AGENTS.md`
- agent startup should begin from `AGENTS.md`

## Verification

### Tests

- scaffold tests assert `<project>/AGENTS.md` exists
- scaffold tests assert `AGENTS.md` mentions deterministic structure and runtime evidence
- launcher tests assert the spawned prompt references `AGENTS.md` before `.claude/CLAUDE.md`
- renderer/runtime behavior should remain unchanged

### Smoke

- `npm test`
- `npm run new -- --project /abs/path`
- `npm run check -- --project /abs/path`
- `npm run finalize -- --project /abs/path`

## Acceptance Criteria

- every new project scaffolds root `AGENTS.md`
- `AGENTS.md` is sufficient for agent orientation without reading framework repo docs
- `.claude/CLAUDE.md` is a thin adapter, not the main project contract
- launcher prompt points project agents at `AGENTS.md` first
- existing Claude hooks and skills still work
- runtime and Electron behavior are unchanged
