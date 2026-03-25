# Repository Documentation Design for AI Agents

**Date:** 2026-03-24
**Audience:** AI agents operating inside the repository
**Status:** Approved for documentation authoring

## Goal

Create an agent-first documentation set under `docs/` that helps AI agents both:

1. understand the repository architecture deeply enough to make safe changes
2. move quickly from a requested change to the right files, boundaries, and verification commands

## Why this documentation set is needed

The repository already has strong product and maintainer contracts in:

- `AGENTS.md`
- `README.md`
- `docs/base-canvas-contract.md`
- `docs/presentation-package-spec.md`
- `docs/prd-human-agent.md`

But those documents do not yet provide a compact, agent-operational map for:

- which files call which files
- how a named product action flows through the stack
- how project creation flows through the stack
- which files are highest risk to edit
- how to choose the right edit lane for a requested change

## Chosen approach

Use a **small index + several focused reference docs**.

This is preferred over a single giant handbook because the repository has strong architectural boundaries and agents often need targeted reading for one task category at a time.

## Documentation principles

Each new doc should be:

- **agent-first**: explicit operating guidance, not just descriptive prose
- **task-oriented**: tell the agent when to read the doc
- **cross-linked**: point to related source docs and implementation files
- **boundary-aware**: reinforce allowed vs forbidden dependency directions
- **verification-aware**: include relevant commands where a topic implies risk

Each doc should begin with a compact quickstart block covering:

- use this when
- read this after
- do not confuse with
- key files
- verification

## Planned files

1. `docs/repo-architecture-index.md`
   - entrypoint for agents
   - tells the agent which document to read based on the task

2. `docs/repo-architecture-overview.md`
   - one-page architecture summary
   - domain boundaries
   - dependency direction
   - source-of-truth model

3. `docs/repo-onboarding-reading-order.md`
   - ordered reading path for agents new to the repository
   - explains why each file matters

4. `docs/repo-change-impact-matrix.md`
   - maps requested change types to the correct files and verification steps

5. `docs/repo-call-flows.md`
   - maintainer mental model of what calls what across the stack

6. `docs/repo-action-trace-export-presentation.md`
   - exact flow for the `export_presentation` product action

7. `docs/repo-trace-project-creation.md`
   - exact flow for project scaffolding and activation

8. `docs/repo-high-risk-files.md`
   - most sensitive files in the repository and why they require care

## Scope boundaries

These new docs should not replace the canonical product and contract docs. Instead, they should sit on top of them and direct the reader back to them when deeper specification is required.

Canonical docs remain:

- `AGENTS.md`
- `README.md`
- `docs/base-canvas-contract.md`
- `docs/presentation-package-spec.md`
- `docs/prd-human-agent.md`
- `project-agent/project-dot-claude/rules/*.md`

## Style and wording

The docs should use imperative wording when appropriate, for example:

- read these files first
- do not edit here unless the task is explicitly framework-level
- verify with these commands before claiming success

They should also explain the reason behind boundaries so agents do not treat them as arbitrary.

## Success criteria

The documentation set is successful if an AI agent can answer these questions quickly and correctly:

1. What are the main architectural domains and which direction may imports flow?
2. If asked to change X, which files should it inspect first?
3. How does `Export presentation` travel through the stack?
4. How is a new project scaffolded and activated?
5. Which files are dangerous to edit and what verification is required after editing them?

## Output decision

All operational docs for this task will be written under `docs/`.
