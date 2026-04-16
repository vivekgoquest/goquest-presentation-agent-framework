# Presentation Package Core Architecture Design

**Date**: 2026-04-12  
**Status**: Living architecture record spanning the original design discussion and later implementation updates  
**Scope**: Package-only core design, intentionally ignoring the Electron shell for now  
**Update policy**: This document is a living design record and should be updated as the architecture discussion evolves.

Historical note:
- early sections capture the original discussion-phase framing before implementation started
- later sections include implementation-grounded observations and rebuilt-core clarifications
- when early discussion sections and later current-state sections differ, the later current-state sections are authoritative

---

## 1. Current Design Focus

We are stepping back from the current implementation and redesigning the core from first principles.

For this discussion, we are intentionally ignoring:
- Electron shell concerns
- renderer UX concerns
- desktop workflows
- sidecars/background supervisors
- automatic fixers outside the agent

We are focusing only on:
- the presentation package in a folder
- the authored presentation files
- the files that describe/interpret/enforce the package
- the workflows an agent in a terminal can use
- the protections around the package
- how policy/validation/checking should relate to the agent

We are also assuming we have the luxury to fully rewrite the core from the ground up.

---

## 2. Fundamental Philosophical Direction

### 2.1 Agent-agnostic core

The core must be package-shaped, not vendor-shaped.

That means:
- the package must make sense without Claude Code
- the package must make sense without `.claude/`
- the package must make sense without Electron
- no vendor-specific feature may define the meaning of the package

Claude Code may be the best current authoring agent, but it must remain an adapter around the package, not the core definition of the package.

### 2.2 Agent as sole mutating authority

The strongest agreed principle so far:

> The agent should be the only active mutating authority over the presentation source.

Meaning:
- if something is wrong, tell the agent
- the agent decides how to fix it
- the agent performs all meaningful edits
- no background system should silently repair presentation problems

This does **not** mean the agent is the only truth authority.

A better split is:
- **truth authority** = package truth + deterministic compiler/policy/check engines
- **mutating authority** = agent

So:
- the system may inspect and judge
- the agent must interpret and mutate

### 2.3 Authorship and mutation boundary spec

This is a hard architectural rule for the rebuilt core.

#### 2.3.1 Sole mutator rule

Only an agent may make meaningful mutations to authored presentation content after project creation.

That includes:
- `brief.md`
- `theme.css`
- `slides/<NNN-id>/slide.html`
- optional `slides/<NNN-id>/slide.css`
- author-managed assets under `assets/` and `slides/<NNN-id>/assets/`

The package core may inspect, compile, validate, export, finalize, and explain. It may not silently rewrite authored presentation content.

#### 2.3.2 What the core may mutate

The core is still allowed to create or refresh deterministic package-owned files and delivery artifacts such as:
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- canonical outputs under `outputs/finalized/`
- ad hoc exports under `outputs/exports/`

These are generated structure, runtime evidence, and outputs. They are not authored presentation content.

#### 2.3.3 Intent nuance

`/.presentation/intent.json` is authorable intent, but it is subordinate to structural truth.

That means:
- it may annotate known structural entities
- it may not define slide existence, slide ids, or ordering
- the agent should own meaningful intent edits during normal authoring
- the core may bootstrap an initial `intent.json` when scaffolding a project or repairing missing package-owned files

That bootstrap exception does not grant the core permission to mutate authored presentation content.

#### 2.3.4 Validator rule

Validators, audits, hooks, and review/judge flows may:
- inspect source
- report deterministic issues
- explain failures
- block operations
- route feedback back into the agent loop

They may not:
- patch authored source directly
- auto-fix authored source
- turn shell/UI actions into a second mutation authority

The intended control loop is:
1. core inspects and judges
2. core reports deterministic findings
3. agent interprets and edits authored content
4. core re-validates the result

#### 2.3.5 Shell boundary implication

A replaceable shell should be able to:
- read package state through the core
- invoke core operations
- display findings, artifacts, and progress

A replaceable shell should not:
- mutate authored content directly
- write package truth files directly
- reconstruct core orchestration on its own

This boundary exists primarily to protect package semantics and agent authorship while allowing rapid UI experimentation.

### 2.4 Core/shell mental model

This is the simplest correct framing for the rebuilt system.

#### Core

The core knows how the presentation system works.

It owns:
- package semantics
- structural compilation
- audits and deterministic findings
- status meaning
- preview assembly
- finalize/export orchestration
- runtime evidence
- the rule that only the agent may mutate authored content

#### Shell

The shell knows how to show the system and invoke it.

It owns:
- windows and panels
- menus and buttons
- dialogs and file pickers
- progress display
- preview framing
- terminal embedding
- host-specific UX flows

It does not own:
- package meaning
- workflow semantics
- issue taxonomy
- authored-content mutation rules
- finalize/export meaning
- runtime evidence meaning

#### Core-first consequence

If a UI experiment can happen by changing only shell files, the architecture is healthy.

If a UI experiment requires touching:
- orchestration
- core state semantics
- audit/finalize/export behavior
- agent flow semantics

then the core/shell seam is too weak.

#### Non-goal

The rebuilt core is not being designed as a shell-extension platform.

The immediate goal is simpler and stricter:
- protect package semantics
- protect the agent authorship boundary
- allow rapid UI experimentation without modifying core orchestration

### 2.5 Checks should feed the agent's working loop

We want policy/validation/structure checks to be experienced by the agent as part of its ongoing authoring process.

The reason is not machine learning. The reason is context discipline.

As the agent works, checks should:
- remind it about hard boundaries
- expose breakages early
- keep it grounded to package reality
- update its effective working context
- reduce drift from the package contract
- help it understand what kind of failure it is seeing
- explain why the failure matters
- point to what conceptual boundary was crossed
- help it understand what to inspect or fix next

This is seen as a feature, not a burden.

Important architectural emphasis:
- the package should not merely fail
- the package should teach
- the package should become an active reasoning surface for the agent without becoming vendor-specific

---

## 3. Concentric Circle Model for the Rebuilt Core

This is the current preferred architecture model.

### Circle 0 — Package ontology / constitution

Defines:
- what a presentation package fundamentally is
- artifact classes
- ownership model
- authored vs generated vs evidence vs adapter/internal git substrate
- invariant categories

This is the deepest layer.

### Circle 1 — Authored source truth

This is the presentation itself as creative source.

Candidate members:
- `brief.md`
- `outline.md`
- `theme.css`
- `slides/<NNN-id>/slide.html`
- optional `slides/<NNN-id>/slide.css`
- assets
- possibly `intent.json` as authored structured intent

Key property:
- the presentation must remain meaningful from these files alone

### Circle 2 — Deterministic structural compiler

This layer interprets authored source and produces the canonical structural model.

Its job:
- discover slides
- normalize ordering/ids
- map source files
- produce a deterministic package structure representation

This is conceptually where a generated package manifest belongs.

### Circle 3 — Policy / invariants engine

This layer answers:
- is the package legal?
- does source violate hard structural, ownership, or authoring rules?

Examples of policy topics:
- content/theme/canvas ownership
- slide fragment shape
- CSS scope rules
- asset path rules
- completeness rules

Strong architectural preference:
- this should be policy-first and ideally AST/semantic, not mostly regex/string heuristic

### Circle 4 — Package command / workflow surface

This is the package’s explicit operational language.

Examples in concept:
- structure/manifest regeneration
- policy validation
- runtime validation
- finalize
- package introspection

Important current direction:
- these workflows should be available as explicit commands the agent can invoke directly
- these commands are part of the package, not part of any one agent adapter

### Circle 5 — Runtime evidence and outputs

This includes:
- latest validation state
- latest artifact inventory
- reports and outputs
- runtime evidence written from checks/builds

Current design direction:
- important, but not deepest source truth
- should inform the agent
- should not become confused with authored source
- should be legible enough to help the agent understand what has happened, what it means, and what to look at next

### Circle 6 — Trigger profiles and agent environment integration

This is where we place:
- manual explicit invocation by the agent
- hook-driven diagnostic runs in agents that support hooks
- future adapter-specific invocation profiles

The key idea:
- the workflow meaning lives in the package
- the trigger mechanism is adapter-specific

### Circle 7 — Vendor adapters

Examples:
- Claude Code instructions and hooks
- future Codex/Gemini/etc wrappers
- terminal launcher contracts

Important rule:
- adapters may guide or trigger workflows
- adapters must not define package truth
- adapters must not become the only place where workflow semantics live

---

## 4. Primary Package Philosophy So Far

### 4.1 Keep truth small

Only a small set of things should count as real package truth.

The more files that are considered authoritative, the harder the package becomes to reason about and harden.

### 4.2 Separate truth from observation

There is a hard distinction between:
- what the presentation is
- what the system most recently observed
- what the system most recently produced

These must not blur together.

### 4.3 No hidden fixers

A core architectural boundary:
- the system may inspect
- the system may judge
- the system may report
- the system may block
- the system may remind
- the system may surface enough state for the agent to choose a git milestone
- the system should explain
- the system should guide

But:
- the system must not silently repair presentation source outside the agent

This means the package is allowed — and encouraged — to be rich in diagnosis and explanation.
What it must not do is cross the line into silent authorship.

### 4.4 The package must survive adapter replacement

The package should remain intelligible and operable if:
- Claude is replaced
- no hooks are available
- the terminal activates another agent

So any essential workflow meaning must exist independently of vendor-specific integration.

---

## 5. Current Position on Runtime Evidence

We discussed whether runtime files should be treated as core package truth.

Current leaning:
- runtime evidence is important
- runtime evidence should inform the agent
- runtime evidence may be durable in parts
- but runtime evidence should not be treated as deepest authored truth
- runtime evidence should ideally help the agent understand not only what the last observation was, but what that observation means in package terms

Provisional position:
- authored source + package identity/intent/structure belong closer to the center
- runtime evidence belongs further out
- durable package outputs/evidence may matter, but agent milestones should live in git rather than a separate package checkpoint layer

This is still open for refinement.

---

## 6. Current Position on Hooks and Agent-Agnosticism

This is the most important refined decision so far.

### 6.1 Hooks are acceptable if they are diagnostic and non-mutating

We do **not** currently reject hooks.

Current tighter position:

> For now, hooks should be limited to deterministic diagnostic package workflows and should route the resulting feedback back into the agent, while leaving all fixes to the agent.

This is intentionally narrower than "any non-mutating workflow".

At the current stage of the architecture, hooks are considered appropriate for:
- inspection
- validation
- drift detection
- policy/runtime diagnostics
- re-grounding feedback
- explanatory feedback that helps the agent understand what kind of issue has occurred and what boundary was crossed

Hooks are **not yet** considered appropriate for broader workflow automation, even if some of those operations might technically avoid authored-source mutation.

So hooks may:
- run checks
- run validations
- regenerate derived structural state if that is a core package operation
- report failures
- prevent drift from passing silently
- re-ground the agent

Hooks may **not**:
- edit authored source
- silently fix policy issues
- apply repairs outside the agent
- become autonomous mutators

### 6.2 Why hooks still fit the philosophy

The reasoning that emerged:
- hooks are still part of the agent’s working environment
- they can be considered agent-triggered diagnostic re-grounding within that environment
- they reinforce grounding and reduce drift
- they do not undermine agency as long as mutation stays with the agent

So the more precise principle is:

> Automatic inspection is acceptable. Automatic mutation is not.

### 6.3 The correct abstraction

Hooks are **not** the workflows.

Hooks are one trigger profile for core package workflows.

Meaning:
- package operations exist independently of Claude
- Claude hooks may invoke them automatically at certain diagnostic moments
- another agent may invoke them manually or through different adapter mechanisms

So:
- workflow semantics belong to the package core
- trigger semantics belong to the adapter

### 6.4 Good and bad versions of hooks

#### Good
- system detects
- agent fixes

#### Bad
- system detects
- system fixes

This distinction should likely become a hard architectural boundary.

---

## 7. Current Preferred Direction on Workflow Model

The discussion has moved toward a package with an explicit operational command surface that the agent can invoke directly, while still allowing adapter-level automatic diagnostic triggers such as Claude hooks.

This means the preferred model is no longer simply “manual commands instead of hooks.”

It is closer to:

> The package exposes canonical operations. The agent should be able to invoke them directly and repeatedly during authoring. Some adapters may additionally auto-trigger non-mutating diagnostic operations.

This preserves:
- agent agency
- package portability
- repeated contextual grounding
- strong non-mutating diagnostics

while avoiding:
- hidden fixers
- sidecars
- background mutation
- vendor-specific ownership of package semantics

---

## 8. Constraints Kept During the Initial Design Discussion

Historical snapshot:
these were the active constraints at the start of the architecture discussion, before implementation work began.

- no code modifications yet
- no implementation planning yet
- no sidecar/background supervisor model
- no autonomous package fixer outside the agent
- no assumption that Claude-specific features define the core package
- no assumption that Electron exists
- all discussion is package-first and terminal-agent-first

---

## 9. Major Open Questions

These are still open and should be refined in later updates.

### 9.1 What is the irreducible authored source truth?

Especially:
- is structured intent part of the irreducible core?
- what belongs in authored truth versus generated structure?

### 9.2 What exactly belongs in the policy circle?

This question now has a second, more concrete companion question:
- what issue/rule taxonomy is already implicit in the current validators?
- how fragmented is the current validation landscape?
- what exists already versus what is still missing?

Need sharper definition of:
- structural rules
- ownership rules
- completeness rules
- rendering-derived policy versus runtime evidence

### 9.3 What are the canonical package operations?

This is now becoming a primary design question.

Current direction:
- keep hooks diagnostic-only for now
- move more package operations into an explicit CLI surface for the agent to invoke deliberately
- make the CLI the main operational language of the package

Important refinement from discussion:
- the goal is not artificial minimalism
- the goal is to expose the operational vocabulary the agent should know and use
- the CLI should be as rich as necessary for intelligent package work
- the real constraint is coherence, not smallness for its own sake

So the better question is not merely:
- what is the minimum command surface?

The better question is:
- what is the complete canonical package operational language the agent should know?

Current working answer:
- the CLI should be organized into families of package knowledge and package action, rather than a flat list of unrelated commands
- each family should correspond to a meaningful package concept the agent ought to understand
- commands should expose package semantics, not implementation plumbing

### 9.4 Which package operations may be auto-triggered by hooks?

This question is now partially refined.

Current working distinction:

- **diagnostic operations** may be auto-triggered by hooks if they do not mutate authored source and do not silently commit durable package state
- **derived-state refresh operations** may be hook-triggered only if they are deterministic rewrites of generated/read-only package files and never alter authored source
- **state-committing operations** should remain explicitly agent-invoked
- **mutation-producing operations** must remain explicitly agent-invoked

The key boundary is not simply "writes files" vs "does not write files".
The more important boundaries are:
- does it change authored source?
- does it commit or bless package state?
- does it create durable outputs intended as handoff artifacts?
- does it repair anything without agent authorship?

### 9.5 How strong should runtime evidence be?

Need a more final stance on:
- latest-state evidence
- stale detection
- source binding / fingerprints
- how package evidence should relate to agent-internal git history

---

## 10. Canonical CLI Knowledge / Verb Families (Current Working Model)

This section defines the current preferred families of CLI vocabulary the package should expose to the agent.

The emphasis is not on exact command names yet.
The emphasis is on what kinds of things the agent should be able to know and do through the package itself.

### 10.1 Identity and package summary

The agent should be able to ask the package:
- who are you?
- what kind of package is this?
- what authored source exists?
- what generated/evidence artifacts exist?
- what is missing?
- what is the current overall package status?

This family should help the agent orient itself quickly without spelunking raw files first.

### 10.2 Source inventory and authorship boundaries

The agent should be able to ask:
- which files are authored source?
- which files are generated?
- which files are evidence?
- which files are agent-internal/git-derived versus package-owned evidence or outputs?
- which files are editable by the agent?
- which files are read-only from the package perspective?

This family is especially important for preserving edit boundaries and reducing accidental mutation of protected files.

### 10.3 Structural model and package compilation

The agent should be able to ask:
- what structural model does the package derive from current source?
- what slides exist?
- what order are they in?
- what stable slide ids exist?
- what source files map to what structural entities?
- what structural problems exist?

The agent should also be able to invoke explicit structural compilation/refresh operations where appropriate.

### 10.4 Policy and rule inspection

The agent should be able to ask:
- what rules are in force?
- what policy classes exist?
- which rules are currently failing?
- where are the failures?
- what kind of failure is each one?
- which files/selectors/assets are implicated?
- what conceptual boundary was crossed?
- why does this failure matter?
- what should be inspected next?

This family is a primary learning surface for the agent.
It should make package rules legible, actionable, and explanatory.

### 10.5 Validation and runtime judgment

The agent should be able to invoke and inspect:
- source-level validation
- runtime/render validation
- overflow and console/runtime integrity checks
- combined readiness judgments
- structured diagnostics suitable for iterative fixing
- guidance that helps interpret what category of failure just occurred and what to examine next

This is the family most likely to be used repeatedly during active authoring.

### 10.6 Runtime evidence and freshness

The agent should be able to ask:
- what runtime evidence currently exists?
- when was it produced?
- which source state does it correspond to?
- is it stale relative to current source?
- what evidence is missing or outdated?

This family helps the agent distinguish current truth from remembered observations.

### 10.7 Artifact inventory and deliverable state

The agent should be able to ask:
- what outputs currently exist?
- which are canonical outputs versus ad hoc exports?
- which artifact paths are known?
- which artifact set corresponds to the latest finalize/export?
- which artifacts are missing?

This helps the agent reason about output state without treating artifacts as authored truth.

### 10.8 Git history and agent milestones

The package should not need a first-class checkpoint family if git already provides the agent’s durable history and milestone lane.

So the agent should instead be able to combine package commands with native git questions such as:
- what recent milestones/commits exist?
- how does current package state differ from a chosen git baseline?
- what changed between two agent milestones?

Important note:
- this is an agent workflow concern, not necessarily a package command family
- the package may report source/evidence freshness relative to current source, while git remains the durable comparison substrate

### 10.9 Delivery workflows

The agent should have explicit verbs for package-level forward motion such as:
- capture
- export
- finalize
- prepare review bundle(s)
- other delivery-boundary operations

These should be intentional, explicit actions rather than hidden automation.

### 10.10 Repair-oriented guidance

The package should help the agent answer:
- what should I fix next?
- what is blocking readiness?
- what is the smallest set of package issues currently preventing success?
- which failures are structural versus policy versus runtime?
- what changed after the last action?
- why does the current failure matter?
- what conceptual boundary was crossed?
- what should I inspect before editing?

This family is especially valuable if the package is meant to continually re-teach the agent during work.
It is where the package stops being a pile of reports and starts becoming an active reasoning partner.

### 10.11 Explain / introspect mode

Beyond pass/fail judgments, the agent should be able to ask the package to explain itself in package terms.

Examples in concept:
- explain why this file is protected
- explain why this selector violates policy
- explain how a slide id was derived
- explain why evidence is stale
- explain why the package is not ready to finalize
- explain what category of issue this is
- explain what conceptual boundary was crossed
- explain what the agent should inspect next

This is not mere verbosity. It is part of making the package an active reasoning partner for the agent.

### 10.12 Design rule for the CLI surface

A candidate command family belongs in the canonical CLI vocabulary if:
- it represents a meaningful package concept the agent should understand
- it helps the agent reason or act at package level
- it is not just low-level implementation plumbing

So the CLI should be:
- rich in package semantics
- sparse in internal machinery

### 10.13 Query families vs action families

A useful refinement from discussion:
- some CLI families primarily exist to help the agent understand package state
- others primarily exist to let the agent intentionally move package state forward
- a few are mixed families that include both read/query and explicit action verbs

#### Primarily query / read families

These mostly help the agent learn, orient, inspect, and reason.

- **Identity and package summary**
  - primarily query-oriented
  - answers what the package is and how complete/ready it appears

- **Source inventory and authorship boundaries**
  - primarily query-oriented
  - answers what the agent may edit and what kinds of files exist

- **Policy and rule inspection**
  - primarily query-oriented
  - answers what rules exist and how failures should be understood

- **Runtime evidence and freshness**
  - primarily query-oriented
  - answers what evidence exists, whether it is stale, and what it means

- **Artifact inventory and deliverable state**
  - primarily query-oriented
  - answers what outputs exist and what deliverable state the package currently remembers

- **Explain / introspect mode**
  - purely query-oriented in spirit
  - should help the agent interpret package semantics and diagnostics

#### Mixed families (query + action)

These families involve both understanding and explicit operation.

- **Structural model and package compilation**
  - query side:
    - what structure currently exists?
    - how were slide ids/order derived?
    - what structural problems exist?
  - action side:
    - explicitly compile/refresh/rebuild the structural model if the package uses such an operation

- **Validation and runtime judgment**
  - query side:
    - what validation state currently exists?
    - what failed and why?
  - action side:
    - run source/runtime validation deliberately and obtain fresh judgments

- **Git history and agent milestones**
  - package side:
    - expose enough source/evidence identity for git-relative reasoning to be useful
  - agent side:
    - use native git to inspect recent milestones, diffs, and code evolution

- **Repair-oriented guidance**
  - query side:
    - what should be fixed next?
    - what is blocking readiness?
  - action side (possibly later):
    - package-assisted planning/triage commands that organize failures for the agent, while still leaving source mutation to the agent

#### Primarily action / invocation families

These exist mainly to move the package forward intentionally.

- **Delivery workflows**
  - capture
  - export
  - finalize
  - review preparation
  - other handoff-oriented operations

These are explicit package verbs more than package questions.

### 10.14 Why this split matters

This split matters because the agent will use the CLI in two different modes:

#### Mode A — understanding mode
The agent is trying to learn:
- what the package is
- what constraints apply
- what is broken
- what the package believes about itself

This mode depends on strong query families.

#### Mode B — intentional movement mode
The agent is trying to do something specific:
- compile/refresh structure
- validate current source
- produce fresh evidence
- create outputs
- create or inspect deliberate git milestones when useful to the agent

This mode depends on explicit action families.

A good package CLI should support both modes clearly instead of forcing the agent to infer package meaning from the side effects of action commands alone.

### 10.15 Architectural preference emerging from this split

Current preference:
- query families should be especially strong, legible, structured, and explanatory because they form the package’s teaching surface for the agent
- action families should be explicit and intentional because they move or commit package state
- hooks, while diagnostic-only for now, should likely rely on the same underlying query/judgment model rather than inventing a separate diagnostic language
- the package should do more than emit raw failures; it should help the agent understand what the failure is, why it matters, what conceptual boundary was crossed, and what to inspect next

### 10.16 Preferred output shape for package commands

A major architectural decision emerging from discussion:
- package commands should not be plain-text only
- package commands should not be JSON only
- the ideal output model is **structured-first with an explanatory human layer**

That means a good package command should usually produce two conceptual layers:

#### Layer 1 — Structured machine-usable payload

This is the durable semantic output.
It should be stable enough for:
- agents to reason over directly
- future adapters/tools to consume
- hooks to pass through consistently
- downstream package workflows to rely on

Typical contents may include:
- command kind
- status / judgment
- category of result
- affected entities and files
- issue list
- evidence metadata
- freshness / source-binding metadata
- suggested next-focus entities

#### Layer 2 — Explanatory narrative layer

This is the package’s teaching voice.
It should explain:
- what happened
- why it matters
- what category of issue this is
- what conceptual boundary was crossed
- what the agent should inspect next

Important refinement:
- this should not be understood as open-ended, LLM-generated prose inside the core
- the preferred model is deterministic explanation generation from a rule taxonomy, issue taxonomy, and package concept model
- the package should speak in controlled package-native explanation patterns, not improvise freeform prose

This layer exists to improve reasoning quality, not just readability.

### 10.17 Why both layers are needed

#### JSON alone is insufficient

Pure structured output is useful for tooling, but often too cold and underspecified as a reasoning aid.
It can tell the agent:
- which file failed
- which rule failed

But it may not tell the agent clearly enough:
- why this class of failure matters
- what package concept is being violated
- what the next useful inspection step is

That does not mean the core must generate creative prose.
It means the core should deterministically attach explanation fields derived from known rule meanings and known package concepts.

#### Plain text alone is insufficient

Pure prose is easier to read but weak for:
- consistency
- automation
- comparison across runs
- future multi-adapter tooling
- reliable machine reasoning

So the package should prefer:
- semantic structure as the primary contract
- explanatory prose as the primary teaching surface

### 10.18 Preferred judgment schema concepts

Without locking exact field names yet, command outputs should usually include concepts like:

- `kind`
  - what sort of command/result this is
- `status`
  - pass / fail / warning / stale / ready / blocked / pending, etc.
- `summary`
  - a compact high-level result
- `issues`
  - structured issue list when relevant
- `explanations`
  - deterministic conceptual explanations of the issue classes
- `nextFocus`
  - what files/entities/slides/concepts the agent should inspect next
- `evidence`
  - pointers to supporting facts, diagnostics, or artifacts
- `freshness`
  - whether the result is current relative to source
- `scope`
  - what part of the package this judgment applies to

The important point is not exact naming yet.
The important point is that package outputs should encode:
- judgment
- explanation
- navigation

not just pass/fail.

### 10.18a Deterministic explanation generation

Current preferred direction:
- explanations in the core should come from deterministic composition, not open-ended prose synthesis

A likely model is:
- each rule / issue type has a stable explanation definition
- each explanation definition contains deterministic slots such as:
  - what happened
  - why it matters
  - what boundary was crossed
  - what to inspect next
- command outputs fill those slots using current package facts

So the core explanatory layer would be built more like:
- structured issue -> explanation template -> filled explanation fields

and less like:
- structured issue -> ask a language model to narrate it

This preserves:
- determinism
- consistency
- portability across agents
- package-native language

while still giving the agent something richer than raw error codes.

### 10.19 Output design by family

Different CLI families should likely emphasize different output shapes.

#### Identity / inventory families
Emphasize:
- concise structured summaries
- package maps
- ownership/boundary annotations
- low drama, high clarity

#### Policy / validation families
Emphasize:
- issue classification
- affected entities
- explanation of the violated boundary
- suggested next inspection targets
- high signal over exhaustive noise

#### Evidence / artifact families
Emphasize:
- timestamps
- source-binding/freshness
- known paths
- relationship between current source and remembered outputs/evidence

#### Explain / repair-guidance families
Emphasize:
- conceptual interpretation
- why-this-matters language
- next-step guidance
- low ambiguity

#### Delivery/action families
Emphasize:
- what changed
- what was produced
- what package state boundary was crossed
- what the resulting deliverable state now is

### 10.20 Diagnostic output should be package-native, not linter-native

Another strong design preference:
- command output should be expressed in package concepts first, not only low-level parser/linter terms

For example, instead of only saying:
- selector X is invalid

The package should be able to say something closer in spirit to:
- this selector escapes slide-local ownership and crosses the content/theme/canvas boundary
- this matters because slide-local CSS may not redefine package-wide or canvas-owned behavior
- inspect this slide’s local CSS scope first

This is what makes the package agent-native without making it vendor-specific.
It also keeps explanatory output deterministic, because the package is mapping known issue categories into known package-language explanations rather than improvising prose.

### 10.21 Hooks should surface the same output model

Since hooks are diagnostic-only for now, they should not invent a separate diagnostic voice.

Instead, hook feedback should ideally be a transport layer for the same package-native judgments:
- same structured result concepts
- same explanations
- same next-focus guidance

That way:
- the package speaks with one semantic voice
- the agent learns one operational language
- adapters differ in trigger profile, not in meaning

## 11. Package Operation Classes (Current Working Model)

This section captures the current preferred classification of package operations.

### 10.1 Class A — Pure diagnostic operations

These inspect package state and return information, but do not alter package files.

Examples in concept:
- read package identity and authored source summaries
- inspect structure already known to the package
- validate policy against source
- validate runtime/render integrity without writing durable state
- report drift, violations, warnings, and repair targets
- expose enough source/evidence identity for git-relative comparison outside the package

Characteristics:
- read-only with respect to package files
- may be computationally expensive, but are semantically observational
- should produce structured feedback the agent can read and act on
- should ideally include explanatory guidance, not only raw failures
- safe to run often

Current design position:
- safe for auto-triggered hooks
- ideal for keeping the agent grounded

### 10.2 Class B — Deterministic generated-state refresh operations

These rewrite generated or runtime-owned package files but do not alter authored source.

Examples in concept:
- regenerate structural manifest from source
- refresh latest validation/runtime evidence files
- refresh derived artifact inventory that is not itself a handoff commitment

Characteristics:
- they do write files
- but only files that are system-owned and non-authorable
- the writes are deterministic consequences of current package state
- they should never involve creative repair or judgment beyond deterministic rules

This class is more nuanced than pure diagnostics.

Current design position:
- may be hook-safe if and only if:
  - the target files are clearly generated/read-only from the package perspective
  - the operation is deterministic
  - the operation does not bless or commit package state
  - the operation does not create user-facing deliverables
  - the operation does not mutate authored source

### 10.3 Class C — State-committing operations

These do not necessarily alter authored source, but they create or update durable package state that has semantic weight beyond a transient latest check.

Examples in concept:
- record or refresh package-owned evidence summaries
- update official delivery/finalize state
- bind current package state to a durable artifact/handoff status when that status is a real package concept

Characteristics:
- may write only system-owned files
- but the write has package meaning, not merely bookkeeping meaning
- can affect how future tooling/agents interpret package delivery state and remembered evidence

Current design position:
- should remain explicitly agent-invoked when they cross a real package boundary
- should not be auto-triggered by hooks

Reason:
- these operations cross from observation into package memory or delivery commitment
- the agent should decide when that commitment is appropriate

### 10.4 Class D — Deliverable-producing operations

These create canonical outputs intended for review, export, or handoff.

Examples in concept:
- finalize
- export canonical PDF
- generate review-ready screenshot set
- produce official summary/report outputs

Characteristics:
- create durable user-facing artifacts
- may overwrite previous outputs
- often imply a package milestone or delivery boundary

Current design position:
- must remain explicitly agent-invoked
- should not be hook-triggered automatically

Reason:
- they are not just diagnostics
- they change package deliverable state
- they should happen intentionally at a meaningful boundary

### 10.5 Class E — Mutation-producing operations

These change authored source or make substantive creative/structural edits.

Examples in concept:
- repair source files
- rewrite slide/theme/brief/outline content
- reorganize slide structure
- resolve policy issues by editing source

Characteristics:
- changes authored truth
- inherently authorial
- may involve judgment, design choice, or narrative trade-offs

Current design position:
- must always remain agent-authored
- must never be performed by hooks or autonomous package subsystems

### 10.6 Safe-for-hook boundary (current working rule)

Current working decision:

Hooks may auto-trigger:
- Class A operations only

Hooks may not auto-trigger:
- Class B operations for now
- Class C operations
- Class D operations
- Class E operations

Reason:
- we want hooks to remain purely diagnostic at this stage
- we want the agent to explicitly invoke more operational commands itself
- we want to preserve a very clean boundary between automatic judgment and deliberate package operations

In short:
- **hooks may observe and diagnose**
- **hooks may not refresh, commit, deliver, or author**

### 10.7 Important refinement: file writes are not the real boundary

A useful distinction that emerged in discussion:

It is not enough to say:
- if an operation writes files, it must be explicit
- if it does not write files, it is safe for hooks

That is too coarse.

Better distinction:

#### Hook-safe
- observational
- or deterministic refresh of non-authorable generated state
- no authored-source mutation
- no durable blessing/commitment
- no deliverable boundary crossing

#### Hook-unsafe
- authored-source mutation
- canonical output generation for handoff
- any package-state change that crosses a real delivery or evidence boundary
- anything that changes package meaning rather than merely reflecting it

## 11. Current Working Summary

The architecture is currently moving toward this position:

1. The core should be package-first and agent-agnostic.
2. The package should have a small center of authored truth.
3. Generated structure and policy enforcement should be deterministic.
4. The package should expose canonical operations the agent can invoke directly.
5. Hooks are acceptable only as diagnostic, non-mutating trigger points.
6. The system may inspect and judge automatically.
7. The system should also explain and guide, not merely fail.
8. The agent remains the sole active mutator.
9. All meaningful fixes must flow through the agent.
10. Vendor adapters must not own core workflow semantics.

---

## 12. Current Validator / Issue Landscape in the Existing Codebase

This section is a first-pass extraction of the issue taxonomy already implicit in the current code.

Important framing:
- this is not yet the target architecture
- this is an inventory of what exists today
- the point is to see what the current validators already know, how they are distributed, and where the current system is fragmented

### 12.1 Where issue generation currently lives

Current issue/explanation generation is spread across several files rather than centralized.

Primary locations identified so far:
- `framework/runtime/deck-policy.js`
- `framework/runtime/deck-source.js`
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/project-state.js`
- `framework/runtime/presentation-intent.js`

This suggests that the current explanation layer is:
- deterministic
- real
- package-native

but also:
- fragmented
- only partially categorized
- uneven in structure
- not yet normalized into a first-class issue model

### 12.2 Issue families already present in the current code

#### A. Incomplete authored-source state

Current examples already detected:
- empty `brief.md`
- TODO markers remaining in `brief.md`
- empty `outline.md`
- TODO markers remaining in `outline.md`
- TODO markers remaining in `slide.html`
- unfinished slide source inferred in `project-state.js`

Current meaning:
- the authored narrative/content source is incomplete, not merely invalid

This is an important family because it is distinct from malformed structure or ownership violations.

#### B. Workspace structure / source inventory violations

Current examples:
- missing `theme.css`
- missing `brief.md`
- no slide folders
- invalid slide folder naming
- duplicate order prefixes
- duplicate derived slide ids
- missing `slide.html`
- illegal extra files inside slide folders
- `assets` entry exists but is not a directory
- required `outline.md` missing for long decks

Current meaning:
- the source workspace shape itself is invalid or incomplete

#### C. Structured intent / package-model consistency issues

Current examples:
- `intent.json` is not an object
- `slideIntent` is not a keyed object
- `slideIntent` references unknown slide ids

Current meaning:
- structured package intent is internally inconsistent with the structural package model

#### D. Theme-layer policy violations

Current examples:
- missing `@layer theme`
- `!important` usage in `theme.css`
- overriding structural canvas tokens from theme
- introducing unknown `--canvas-*` variables
- overriding protected canvas selectors from theme
- invalid theme asset references

Current meaning:
- deck-wide visual system is violating theme/canvas ownership rules

#### E. Slide HTML fragment / content-layer violations

Current examples:
- TODO markers in `slide.html`
- inline styles in slide HTML
- `<style>` blocks in slide HTML
- forbidden outer tags/wrappers in slide fragments
- missing or multiple slide roots
- wrapper nodes around slide root
- extra top-level nodes/text outside the root
- invalid asset references from slide HTML

Current meaning:
- slide fragments are violating the authored source contract for content fragments

#### F. Slide CSS scope / ownership violations

Current examples:
- missing `@layer content`
- `!important` in `slide.css`
- overriding structural canvas tokens from slide CSS
- selectors escaping current slide scope
- targeting generated slide wrapper directly
- protected canvas selector usage inside slide CSS
- runtime chrome selector usage inside slide CSS
- targeting slide root through custom root class
- putting theme-owned declarations into slide-local selectors
- invalid asset references from slide CSS

Current meaning:
- slide-local styling is violating source ownership boundaries and/or local scope rules

#### G. Effective canvas / framework integrity violations

Current examples:
- structural canvas token values changed in effective framework canvas
- `.slide` not bound to required max-width/aspect-ratio variables
- `.slide-wide` not bound to required width variable
- runtime chrome selectors appearing in effective framework canvas

Current meaning:
- the framework-owned structural surface has drifted away from protected expectations

This is notable because it sits closer to framework integrity than ordinary deck authoring errors.

#### H. Asset ownership and path violations

Current examples from asset resolution and CSS/HTML validation:
- unsupported URL schemes
- root-relative asset paths
- asset paths escaping owning workspace
- asset paths outside allowed roots
- missing preview-path resolution support for assets

Current meaning:
- authored assets are violating package portability/ownership constraints

#### I. Runtime/render integrity issues

Current examples:
- no discovered slides at runtime
- browser console errors during capture
- overflow on rendered slides
- rendered canvas contract violations
- unknown slide selections during export/capture requests

Current meaning:
- the source may be structurally legal but the rendered/runtime result is still invalid or degraded

#### J. Coarse readiness / state categories

Current examples in `project-state.js`:
- `incomplete_brief`
- `incomplete_outline`
- `incomplete_slide`
- `authoring_violation`
- project states such as `onboarding`, `in_progress`, `policy_error`, `ready_to_finalize`, `finalized`

Current meaning:
- the system already has a partial high-level taxonomy for package readiness, but it is much coarser than the full issue landscape

### 12.3 What already exists and is valuable

The current validation layer already has some strong properties:

- issue generation is deterministic
- issue messages are often package-native rather than parser-native
- many messages already include fix direction
- many messages already imply ownership boundaries
- the system already distinguishes some kinds of incompleteness from general authoring violations
- runtime validation is already conceptually separated from some source validation

This is important because it means the future architecture does **not** need to invent explanatory validation from scratch.
It needs to organize and formalize what already exists.

### 12.4 What appears fragmented or weak today

Current likely weaknesses:

#### Fragmented issue generation
Messages are spread across multiple modules, which means:
- no single issue taxonomy
- no single stable issue kind model
- explanation style may drift over time
- adapters/tools cannot rely on a normalized semantic schema

#### Mixed abstraction levels
Some messages are:
- package-native and conceptually strong

Others are:
- still fairly low-level or file-local

So the current system mixes:
- conceptual package violations
- low-level validation remarks
- operational/runtime failures
without a normalized cross-cutting model.

#### Weak explicit categorization
Outside a few coarse readiness categories, most issues are not explicitly typed.
They are mostly carried as strings.

This limits:
- comparison across runs
- structured next-step guidance
- high-quality package-native explanations
- future tooling around issue classes

#### Boundary between policy issues and runtime evidence is not fully formalized
The current code distinguishes some of this in practice, but the conceptual model is still blurry in places.
For example, the difference between:
- authored-source invalidity
- structural invalidity
- runtime invalidity
- stale evidence
- delivery unreadiness

is not yet formalized into one issue taxonomy.

#### Explanation exists, but is not modeled as first-class data
The current code already explains a lot, but explanation is embedded directly in message strings.
It is not yet modeled as:
- issue kind
- explanation fields
- boundary kind
- guidance fields
- next-focus targets

### 12.5 Current architectural interpretation

Based on the current code, the right interpretation is:

- the package already has the beginnings of a deterministic explanatory validator
- the problem is not absence of explanatory power
- the problem is fragmentation, unevenness, and lack of a normalized issue model

So the next architecture step is likely **not**:
- add explanations

It is more likely:
- extract and normalize the issue taxonomy
- make issue kinds explicit
- separate source/structure/policy/runtime/evidence/delivery concerns more cleanly
- formalize explanation and next-focus guidance as structured package output

### 12.6 Practical takeaway for redesign

If the core is rewritten, the validator redesign should probably start with these questions:
- what are the canonical issue families?
- which current messages already represent good package-native explanations?
- which current messages are too low-level or inconsistent?
- which issue families should produce stronger next-inspection guidance?
- which issue families belong to source policy versus runtime judgment versus deliverable state?

This section should be treated as the current inventory baseline for that later redesign.

## 13. Candidate Canonical Issue Taxonomy (Derived from Current Code)

This section is a first-pass proposal for a cleaner issue model built from what the current code already appears to know.

It is not yet a final redesign.
It is an attempt to reorganize the current validator landscape into clearer semantic buckets.

### 13.1 Top-level taxonomy groups

Current recommended top-level groups:

1. **Source completeness issues**
2. **Source structure issues**
3. **Source ownership/policy issues**
4. **Framework integrity issues**
5. **Runtime/render judgment issues**
6. **Intent/model consistency issues**
7. **Evidence freshness/issues of remembered state**
8. **Deliverable state issues**

These groups are intentionally higher-level than the current code’s message strings.
They are meant to become the major semantic buckets the package thinks in.

### 13.2 Source completeness issues

These mean:
- the authored source exists, but is not meaningfully complete enough to proceed

Examples already present in current code:
- incomplete brief
- incomplete outline
- incomplete slide source
- unresolved TODO markers in authored source

Why this deserves its own group:
- this is different from malformed structure
- different from policy boundary violations
- different from runtime failures
- it often implies "continue authoring" rather than "repair a broken rule"

Current code coverage:
- reasonably strong but spread across multiple validators and `project-state.js`

What is likely missing:
- a normalized issue kind family for all forms of authored incompleteness
- stronger next-step guidance across all completeness cases

### 13.3 Source structure issues

These mean:
- the authored source tree or slide inventory is malformed as a package source model

Examples already present in current code:
- missing required source files
- missing slide folders
- invalid slide folder names
- duplicate order prefixes
- duplicate derived slide ids
- missing `slide.html`
- illegal entries inside slide folders
- required outline missing for long decks

Why this deserves its own group:
- these are package-shape issues, not style/policy issues
- they often block compilation or higher-level reasoning entirely

Current code coverage:
- strong in `deck-policy.js`

What is likely missing:
- clearer structural subcategories
- stronger distinction between missing source, malformed source, and ambiguous source

### 13.4 Source ownership / policy issues

These mean:
- authored source exists and is structurally recognizable, but violates hard ownership or authoring rules

This group can be subdivided.

#### 13.4a Theme policy issues
Examples:
- missing `@layer theme`
- `!important` in theme
- overriding protected canvas selectors
- overriding structural canvas tokens
- unknown canvas variables

#### 13.4b Slide HTML policy issues
Examples:
- inline styles
- `<style>` blocks
- forbidden wrappers
- invalid root shape

#### 13.4c Slide CSS policy issues
Examples:
- missing `@layer content`
- `!important`
- selector escaping slide scope
- canvas selector usage
- runtime chrome selector usage
- theme-style leakage into slide-local CSS

#### 13.4d Asset ownership issues
Examples:
- root-relative paths
- unsupported schemes
- escaping workspace roots
- invalid asset ownership roots

Why this deserves its own group:
- these issues are fundamentally about crossing package ownership boundaries
- this is the area where content/theme/canvas/workspace concepts matter most

Current code coverage:
- very strong, but fragmented across `deck-policy.js` and `deck-source.js`

What is likely missing:
- explicit policy issue kinds and boundary kinds
- stronger normalized explanation fields
- shared structure across theme/html/css/asset violations

### 13.5 Framework integrity issues

These mean:
- the framework-owned structural surface has drifted or been altered in ways that violate protected assumptions

Examples already present in current code:
- changed structural canvas token values
- `.slide` not bound correctly
- `.slide-wide` not bound correctly
- runtime chrome selectors leaking into framework canvas

Why this deserves its own group:
- this is not ordinary deck authoring failure
- it represents protected framework/core integrity drift
- it may need stronger severity and stronger escalation language

Current code coverage:
- present, but embedded in general validation flow

What is likely missing:
- an explicit distinction between deck-authoring issues and framework-integrity issues

### 13.6 Runtime / render judgment issues

These mean:
- the package may compile, but the rendered or runtime result is still invalid or degraded

Examples already present in current code:
- no discovered slides at runtime
- browser console errors
- overflow
- rendered canvas contract violations
- unknown slide selections for runtime/export operations

Why this deserves its own group:
- these are not purely source-policy failures
- they arise from rendered behavior and runtime observation
- they are likely to be consumed often by the agent during iterative authoring

Current code coverage:
- present in `presentation-ops-service.mjs` and rendered-canvas validation

What is likely missing:
- stronger normalization of runtime issue kinds
- clearer separation between runtime judgment and deliverable-state problems

### 13.7 Intent / model consistency issues

These mean:
- authored structured intent disagrees with package structure or has invalid shape

Examples already present:
- invalid intent object shape
- invalid `slideIntent` structure
- unknown slide references in intent

Why this deserves its own group:
- intent is neither ordinary source text nor runtime evidence
- it is authored structured package meaning
- it needs consistency with the package’s structural model

Current code coverage:
- present but narrow

What is likely missing:
- clearer role of intent in the overall package ontology
- stronger integration with structure/status commands

### 13.8 Evidence freshness issues

These mean:
- remembered runtime evidence/artifact state exists, but may no longer correspond to current source

Important note:
- this group is mostly missing as a first-class validator family in the current code
- it is more an architectural need inferred from current discussion than a strong existing implementation area

Why this deserves its own group:
- the package needs a clean way to distinguish:
  - current source truth
  - remembered observations
  - stale remembered observations

Current code coverage:
- weak / largely implicit

This is one of the major missing families in the current system.

### 13.9 Deliverable state issues

These mean:
- the package’s official output/handoff state is incomplete, missing, failed, or inconsistent

Examples partially present today:
- finalize outputs missing
- package not yet ready to finalize
- output artifacts absent

Important note:
- the current code has some state notions like `ready_to_finalize` / `finalized`
- but deliverable-state issues are not yet strongly modeled as a canonical issue family

This is another likely missing or under-modeled family.

### 13.10 Revision: checkpoint / trust-state should probably not remain a first-class package issue family

Later discussion changed the recommendation here.

Current revised view:
- missing or stale remembered package information should mostly live under **evidence freshness/issues of remembered state**
- durable milestone comparison should mostly be handled through native git history in the agent workflow
- the package probably does not need a separate checkpoint/trust-state issue family unless a truly package-specific trust concept emerges later

So what initially looked like a separate issue family is now better split into:
- package-side evidence freshness issues
- agent-side git-relative comparison concerns

### 13.11 What the current code appears strong at

Stronger current areas:
- source completeness
- source structure
- theme/html/css ownership policy
- asset ownership policy
- runtime/render failures
- coarse readiness categories

### 13.12 What the current code appears weak at

Weaker current areas:
- explicit issue kinds
- normalized explanation fields
- evidence freshness as a first-class issue family
- deliverable-state issue modeling
- unified taxonomy spanning source, runtime, evidence, and delivery

### 13.13 Current redesign implication

If we later redesign the validator layer, the likely path is:

1. keep the issue knowledge already present
2. normalize it into explicit issue kinds
3. separate top-level groups more cleanly
4. distinguish current source problems from remembered-state problems
5. distinguish runtime invalidity from delivery unreadiness
6. formalize explanation and next-focus guidance for each issue family

This candidate taxonomy should be treated as a working reorganization of the current system, not yet a final architecture commitment.

## 14. Mapping Issue Taxonomy Back Into the Concentric Circles

Now that a candidate issue taxonomy exists, the next architectural task is to place each issue group into the correct conceptual circle.

This matters because otherwise the package will blur together:
- source illegality
- rendering failure
- stale remembered state
- missing deliverables
- agent-internal git milestone concerns that should not become package semantics

The circles should help keep those kinds of truth and failure separate.

### 14.1 Circle-oriented interpretation rule

A useful rule of thumb:

- if an issue is about **authored source not being complete enough to proceed**, it belongs closer to the source circle
- if an issue is about **deterministic structure derived from source**, it belongs closer to the structural compiler circle
- if an issue is about **ownership or legality of authored source**, it belongs in the policy circle
- if an issue is about **what happened when the package was rendered or executed**, it belongs in the runtime judgment circle
- if an issue is about **remembered state no longer matching current source**, it belongs in the evidence circle
- if an issue is about **whether the package has crossed a handoff/output boundary**, it belongs in the delivery/readiness circle

### 14.2 Source-side circles

#### Circle 1 — Authored source truth

Most closely associated issue groups:
- **Source completeness issues**

Why:
- these issues mean the package’s authored truth is still unfinished
- they are not really about policy complexity yet
- they are about the presentation not being authored enough to proceed cleanly

Examples:
- incomplete brief
- incomplete outline
- incomplete slides
- unresolved TODO markers

Important nuance:
- these are source-state deficiencies, not merely policy failures
- the package should likely treat them as “continue authoring” signals rather than generic rule-break messages

#### Circle 2 — Deterministic structural compiler

Most closely associated issue groups:
- **Source structure issues**
- much of **Intent / model consistency issues**

Why:
- these issues are about whether source can be deterministically normalized into one coherent package structure
- they sit between raw authored files and higher-order legality judgments

Examples:
- invalid slide folder names
- duplicate order prefixes
- duplicate slide ids
- missing required source files
- malformed or structurally inconsistent intent references

Important nuance:
- some intent issues are partly semantic, but the current ones mostly look like structure/model-consistency issues rather than policy issues proper

### 14.3 Policy circle

#### Circle 3 — Policy / invariants engine

Most closely associated issue groups:
- **Source ownership / policy issues**
- **Framework integrity issues**

Why:
- these are the clearest expressions of the package’s invariant system
- they are about boundaries, ownership, protected surfaces, and what kinds of authoring are legal

Examples:
- theme overriding protected canvas selectors
- slide CSS escaping local scope
- inline styles in slide fragments
- asset paths violating workspace ownership
- framework canvas drift from protected structural contracts

Important nuance:
- framework integrity issues should probably be a higher-severity subclass inside the policy circle
- they differ from ordinary deck authoring mistakes because they indicate drift in protected framework-owned surfaces

### 14.4 Runtime judgment circle

#### Circle 4 / Circle 5 boundary — render/build engine and runtime evidence

Most closely associated issue groups:
- **Runtime / render judgment issues**

Why:
- these issues arise only after rendering, capture, or runtime inspection
- they are not purely authored-source legality questions
- they represent observed runtime behavior or observed render quality/integrity

Examples:
- console errors
- overflow
- no discovered slides at runtime
- rendered canvas contract violations

Important nuance:
- these issues conceptually begin in the render/build engine
- but their remembered results are often stored in runtime evidence
- so this family naturally spans the boundary between runtime judgment generation and runtime evidence storage

### 14.5 Evidence / memory circles

#### Circle 5 — Runtime evidence and outputs

Most closely associated issue groups:
- **Evidence freshness issues**
- part of **Deliverable state issues**

Why:
- these issues are not about source being illegal
- they are about remembered observations, outputs, and whether those are current or stale

Examples:
- evidence exists but no longer matches current source
- remembered artifacts are outdated
- latest validation evidence is stale or absent

Important note:
- this is one of the biggest under-modeled areas in the current code
- architecturally it should become a first-class family even though implementation support is still weak

#### Circle 5 / outer memory boundary — evidence freshness and remembered-state drift

Most closely associated issue groups:
- **Evidence freshness/issues of remembered state**

Why:
- these are about whether remembered package observations still correspond to current source
- they do not require a separate package checkpoint concept to be useful

Examples in concept:
- latest evidence is stale relative to source
- remembered artifact inventory no longer matches current source assumptions
- finalize outputs exist but no longer correspond to current source

Important note:
- git may still provide additional milestone comparison for agents
- but the package-side issue family should stay centered on evidence freshness and delivery drift

### 14.6 Delivery / readiness circles

#### Circle 6 or outer operational circle — delivery/readiness state

Most closely associated issue groups:
- **Deliverable state issues**

Why:
- these issues are about whether the package has crossed an intentional output/handoff boundary
- they are not the same as source policy failures
- they are not the same as stale evidence
- they are about readiness, canonical outputs, and package-forward movement

Examples in concept:
- canonical outputs missing
- finalize not yet run
- package not yet at delivery boundary
- known output set incomplete

Important note:
- the current code has coarse status concepts here (`ready_to_finalize`, `finalized`)
- but the issue family is not yet strongly modeled

### 14.7 Where each issue group currently seems to belong

A compact placement table:

- **Source completeness issues** -> Circle 1
- **Source structure issues** -> Circle 2
- **Intent / model consistency issues** -> mostly Circle 2, with some possible semantic overlap later
- **Source ownership / policy issues** -> Circle 3
- **Framework integrity issues** -> Circle 3 (high-severity protected subclass)
- **Runtime / render judgment issues** -> Circle 4/5 boundary
- **Evidence freshness issues** -> Circle 5
- **Deliverable state issues** -> outer operational/readiness circle
- **Evidence freshness / remembered-state drift** -> Circle 5

### 14.8 Why this re-mapping is useful

This re-mapping suggests a cleaner future validator architecture:

#### Source-side validators
Focus on:
- completeness
- structure
- authored-source legality

#### Runtime-side validators
Focus on:
- rendered/runtime observation
- runtime integrity
- capture/export observations

#### Memory/readiness evaluators
Focus on:
- freshness of evidence
- presence and quality of deliverables
- remembered-state drift that is truly package-owned

This is cleaner than letting one giant validator conflate all of them.

### 14.9 Current likely problem in the existing code

The current code appears to compress too many circles into a small number of operational entry points.

As a result:
- source completeness, source policy, runtime observation, and readiness are all present
- but they are not always modeled as distinct semantic layers
- some concepts are rich in implementation but poor in taxonomy
- some concepts are present architecturally but weak in implementation

This is probably why the current validator layer feels fragmented.

### 14.10 Provisional architectural conclusion

If the core is rewritten, the validator system probably should not be one giant undifferentiated checker.

A better model would likely be:
- **source-side evaluation**
- **structural evaluation**
- **policy evaluation**
- **runtime judgment evaluation**
- **evidence freshness evaluation**
- **deliverable/evidence-state evaluation**

Those may still be exposed through coherent package commands, but internally they should likely map back to different circles of package meaning.

## 15. Where the Current Operational Entry Points Collapse Multiple Circles Together

This section looks at the current code through an operational lens.
The question is not just what issue families exist.
The question is:

- where do current commands and services blur multiple circles of meaning together?
- where does one operation currently act as a catch-all for conceptually different jobs?
- where might a future CLI want to separate concerns more cleanly?

### 15.1 `validateSlideDeckWorkspace(...)` is doing several jobs at once

Current file:
- `framework/runtime/deck-policy.js`

This function currently acts as a large source-side umbrella.
It mixes:

- source completeness checks
- source structure checks
- source ownership/policy checks
- framework integrity checks
- required-outline logic for long decks
- file inventory expectations

In other words, one function currently spans:
- Circle 1 concerns
- Circle 2 concerns
- Circle 3 concerns
- part of protected framework integrity

Why this matters:
- it makes source evaluation feel like one giant authoring gate
- it hides which failures are about incompleteness vs structure vs legality
- it makes it harder to expose those distinctions cleanly to the agent

Likely redesign implication:
- future package operations may want to separate these into distinct evaluations, even if they are still commonly run together

### 15.2 `validatePresentation(...)` mixes runtime judgment production with evidence writing

Current file:
- `framework/runtime/services/presentation-ops-service.mjs`

Current behavior:
- capture rendered state
- derive failures from runtime observations
- write `render-state.json`
- return judgment

This means one operation currently spans:
- runtime/render judgment generation
- runtime evidence mutation

So it blurs:
- Circle 4 (runtime judgment)
- Circle 5 (runtime evidence)

Why this matters:
- a future architecture may want to distinguish:
  - "run judgment now"
  - from
  - "record this judgment as latest remembered evidence"

Right now those are bundled.

### 15.3 `finalizePresentation(...)` is an especially dense multi-circle operation

Current file:
- `framework/runtime/services/presentation-ops-service.mjs`

Current behavior bundles:
- runtime capture
- issue summarization
- PDF export
- report writing
- summary writing
- artifact inventory updates
- render-state updates

This currently spans:
- runtime judgment
- deliverable generation
- runtime evidence mutation

So it mixes:
- Circle 4
- Circle 5
- delivery/readiness concerns
- remembered-state concerns

Why this matters:
- finalize is understandably a package boundary command
- but internally it currently compresses too many semantic layers into one path
- that makes it harder to reason about what changed in package meaning versus what was merely observed or remembered

Likely redesign implication:
- keep a deliberate high-level finalize command
- but internally separate judgment, artifact production, evidence recording, and any git/internal milestone behavior more clearly

### 15.4 `project-state.js` compresses many circles into coarse readiness labels

Current file:
- `framework/runtime/project-state.js`

Current behavior uses a mix of:
- source completeness state
- policy failure presence
- runtime evidence presence
- output existence

and compresses them into statuses such as:
- `onboarding`
- `in_progress`
- `policy_error`
- `ready_to_finalize`
- `finalized`

This is useful, but it also collapses:
- source completeness
- source legality
- output existence
- package readiness

into one coarse state model.

Why this matters:
- coarse readiness is useful for humans and agents
- but if it becomes the main semantic surface, it can hide the richer issue taxonomy underneath

Likely redesign implication:
- keep coarse readiness summaries
- but make them secondary views derived from richer issue families and package state concepts

### 15.5 `ensurePresentationPackageFiles(...)` mixes package bootstrapping and regeneration

Current file:
- `framework/runtime/presentation-package.js`

Current behavior:
- ensures `intent.json`
- writes/regenerates structural manifest
- ensures runtime state files exist

This operation currently bundles:
- package bootstrap/repair of missing package companions
- structural compilation
- runtime evidence file initialization

This means it crosses:
- Circle 2 (structural manifest generation)
- Circle 5 (runtime evidence file existence)
- package bootstrapping concerns

Why this matters:
- convenient today
- but conceptually it blurs source-derived structure with remembered runtime state scaffolding

Likely redesign implication:
- future architecture may want clearer separation between:
  - compile structure
  - ensure runtime evidence containers exist
  - initialize package system scaffolding

### 15.6 Hook workflow currently compresses several meanings into one stop-time gate

Current file:
- `framework/application/project-hook-service.mjs`

Current stop-hook flow currently does roughly:
- ensure package files
- validate intent
- run presentation validation
- maybe create a git milestone

This mixes:
- package repair/bootstrap
- source/model consistency checks
- runtime judgment
- git/history advancement concerns

Why this matters:
- even if hooks remain diagnostic-only in the future architecture, the current implementation shows how easy it is for one workflow to accumulate responsibilities across circles
- this is exactly the kind of semantic compression the redesign should resist

### 15.7 Current likely anti-pattern: convenience bundling across circles

A pattern emerging from the current code:
- many functions are convenient because they bundle adjacent operations together
- but the bundling often crosses circle boundaries

Examples:
- source checks + policy checks + framework integrity checks
- runtime judgment + evidence writing
- artifact production + evidence writing + remembered-state updates
- package ensure/bootstrap + manifest generation + runtime file initialization

This is understandable in an evolving implementation.
But architecturally it creates semantic blur.

### 15.8 Not all bundling is bad

Important nuance:
- the redesign should not aim for pathological over-separation
- some high-level commands should intentionally orchestrate multiple lower-level operations

For example:
- a `finalize` command can remain a valid high-level package operation
- a `check` command can remain a valid high-level package operation

The important distinction is:
- high-level commands may orchestrate multiple circle-specific evaluations internally
- but the architecture should still know what semantic layers are being crossed
- and ideally expose richer outputs that preserve those distinctions

So the problem is not bundling itself.
The problem is **unlabeled semantic bundling**.

### 15.9 Current redesign opportunity

A future package architecture could improve clarity by:
- preserving convenient high-level commands
- while internally separating circle-specific evaluators and outputs
- and exposing richer structured results that say:
  - source completeness status
  - structural status
  - policy status
  - runtime judgment status
  - evidence freshness status
  - deliverable state status
  - remembered-state / delivery status

This would let one command still be convenient while avoiding conceptual flattening.

### 15.10 Practical conclusion

The current codebase does not appear to suffer from a lack of validation intelligence.
It appears to suffer more from:
- bundling too many circles into a few operations
- expressing results too coarsely at the outer surface
- lacking a normalized semantic decomposition underneath the convenience flows

That is a useful diagnosis because it suggests the redesign path is more about:
- decomposition
- naming
- normalization
- output modeling

than about inventing validation logic from zero.

## 16. Candidate Future High-Level Package Commands and Their Circle Boundaries

Now that we have:
- circles
- issue families
- current collapse points

we can sketch what the future high-level package commands might look like.

Important framing:
- these are still discussion-stage concepts
- the goal is not exact command names yet
- the goal is to identify which high-level package verbs are legitimate, and which circles each one should intentionally orchestrate

### 16.1 Design rule for future high-level commands

A future high-level command is valid if:
- it represents a real package concept the agent should use repeatedly
- it is coherent at package level
- it may orchestrate multiple lower-level evaluators
- but it should preserve which semantic circles it is crossing in its output

So the future design should avoid two extremes:
- too many tiny low-level commands
- too few catch-all commands with flattened meaning

### 16.2 Revised command-shape recommendation

This section originally explored names like `describe`, `check-source`, `check-runtime`, and `capture`.
After later discussion, those should be treated mostly as intermediate thinking rather than the preferred final vocabulary.

Current preferred command surface is simpler and more coherent:
- `presentation inspect ...`
- `presentation status ...`
- `presentation audit ...`
- `presentation finalize ...`
- `presentation export ...`
- optionally `presentation explain ...`
- plus native `git ...` for the agent’s own history/milestone workflow

### 16.3 How the earlier ideas map into the revised families

A rough translation table:

- old `describe` -> `inspect` / `status`
- old `compile-structure` / `structure ...` -> mostly `inspect` plus internal deterministic refresh operations
- old `check-source` -> `audit` (source-facing rule families)
- old `check-runtime` -> `audit ... --render` or other explicit runtime-backed audit forms
- old `inspect-evidence` -> `inspect evidence` or `status` depending on question shape
- old `capture` -> either an internal runtime mechanism or an explicit export/finalize sub-operation, not necessarily a top-level family in the long-term CLI
- old `guide` / `explain` -> `explain`, with some guidance also embedded in `audit` and `status`

The key shift is:
- prefer package-semantic families over implementation-shaped verbs

### 16.4 Frequent-loop commands in the revised model

For day-to-day agent authoring, the most central loop is likely:
- `presentation inspect ...`
- `presentation audit ...`
- `presentation status ...`
- optionally `presentation explain ...`
- native `git diff/log/show` when the agent wants historical context

This keeps the frequent loop focused on:
- orientation
- deterministic diagnostics
- interpreted package state
- targeted explanation

### 16.5 Boundary-crossing commands in the revised model

The main package boundary-crossing commands should remain:
- `presentation finalize ...`
- `presentation export ...`

And the main agent-internal milestone/history tools should remain:
- native `git commit`
- native `git diff`
- native `git log`
- native `git show`

This preserves the distinction between:
- package semantics
- agent workflow substrate

## 17. Current Command / Action Audit and Revised Future Naming Model

This section audits the current codebase command surface, but the future naming recommendation should now be read through the revised CLI taxonomy above.

### 17.1 Current CLI/runtime commands in the repo

Current package-level commands exposed in `package.json` and runtime entrypoints:

- `npm run new -- --project /abs/path`
- `npm run check -- --project /abs/path`
- `npm run capture -- --project /abs/path [output-dir]`
- `npm run export -- --project /abs/path [output.pdf]`
- `npm run finalize -- --project /abs/path`
- project-local shim variants through `.presentation/framework-cli.mjs`

Current application action ids:
- `export_presentation`
- `export_presentation_artifacts`
- `validate_presentation`
- `capture_screenshots`
- plus agent-oriented review/apply/fix actions

### 17.2 Main semantic problems in the current command surface

Current likely problems:

#### Problem A — `export` and `finalize` are semantically entangled
- current CLI export is narrower than finalize
- current action name `export_presentation` actually means finalize
- package and application layers are not speaking with one clean vocabulary

#### Problem B — `check` / `validate` are too broad
- the current system does not clearly distinguish:
  - source-side audit
  - runtime/render-backed audit
  - evidence recording
  - status interpretation

#### Problem C — `capture` is half inspection, half artifact generation
- this is valid as an implementation operation
- but it is not a great stable top-level semantic family for the future package CLI

#### Problem D — high-level convenience names mask internal semantic crossings
- one command may span multiple circles
- but the name gives no hint which boundary is being crossed

### 17.3 Revised future naming philosophy

The future command vocabulary should be organized around package semantics rather than legacy scripting names.

Current strong preference:
- use `inspect` for inventory/orientation
- use `status` for package-state interpretation
- use `audit` for deterministic diagnostics
- use `finalize` for the canonical delivery boundary
- use `export` for direct artifact emission
- use `explain` only where a dedicated explanation surface is still valuable
- use native git directly rather than inventing package verbs for agent history/milestones

### 17.4 Revised treatment of legacy names

#### `check`
Recommendation:
- keep only as a compatibility or convenience wrapper if needed
- do not treat it as the conceptual center of the architecture
- semantically split its responsibilities into `audit` and `status`

#### `capture`
Recommendation:
- treat it as an implementation/runtime mechanism or a narrower explicit export/finalize sub-operation
- do not rely on it as a top-level semantic family unless later design work gives it a clearer package meaning

#### `describe`
Recommendation:
- fold into `inspect` and `status`

#### `check-source` / `check-runtime`
Recommendation:
- superseded conceptually by `audit` families and optional render-backed audit modes

### 17.5 Recommended treatment of `finalize`

Current judgment:
- `finalize` is the right conceptual term for the package’s canonical completion/delivery command
- the word itself should likely be kept
- what needs to change is not the existence of finalize, but the clarity of what finalize does and what sub-results it reports

Future finalize should ideally report separate sub-results for:
- audit status
- runtime/render-backed audit status when used
- artifacts produced
- evidence updated
- resulting readiness/delivery state

### 17.6 Recommended treatment of `export`

Current judgment:
- `export` should be reserved for direct artifact production
- the current action name `export_presentation` is architecturally misleading because it actually means finalize

Strong recommendation for future redesign:
- stop using `export` to mean canonical package completion
- reserve `finalize` for canonical completion
- reserve `export` for requested artifact emission

### 17.7 Recommended treatment of application action names

Current likely future correction:
- rename action semantics so application action ids reflect what they actually do

Examples in concept:
- current `export_presentation` should map to a future finalize-oriented name
- direct artifact export should keep an export-oriented name
- validation actions should align with `audit` semantics rather than broad `check` semantics where possible

### 17.8 Practical redesign takeaway

The current command surface likely needs:
- semantic cleanup
- reduction in overloaded names
- clearer distinction between:
  - inspect
  - status
  - audit
  - export
  - finalize
  - internal git workflow

This is not just naming polish.
It is part of making the package’s operational language coherent for the agent.

## 18. Revised Command Behavioral Classes for the Future Package CLI

The revised CLI families should still have a clear behavioral model.

Current proposed behavioral classes:

1. **Pure view**
2. **View + computation**
3. **Computation + remembered-state update**
4. **Boundary-crossing action**

### 18.1 Pure view

Definition:
- does not mutate package files
- does not regenerate state
- does not create outputs
- only reports already-known package state or derives a lightweight view from existing state

Likely families/operations:
- `inspect` in purely descriptive modes
- `status` when reading already-available package facts
- `explain`

### 18.2 View + computation

Definition:
- performs deterministic computation or evaluation now
- returns fresh judgment or fresh derived understanding
- but does not persist durable package mutations by default

Likely families/operations:
- `audit`
- some richer `status` calls if they derive fresh summaries from current facts
- some `inspect` calls if they compute fresh structure without recording it

### 18.3 Computation + remembered-state update

Definition:
- performs computation and also updates package-owned generated/evidence state
- still does not mutate authored source
- but does change what the package now remembers as latest derived state

Likely operations:
- deterministic structural/evidence refresh steps invoked explicitly or internally
- some runtime-backed audit/export/finalize preparation paths if they record evidence

Important note:
- these should be explicit in output even when they are not exposed as the main top-level family names

### 18.4 Boundary-crossing action

Definition:
- crosses an intentional package boundary
- creates outputs or changes official package state in a semantically significant way

Likely families:
- `export`
- `finalize`

### 18.5 Why this behavioral classification still matters

The agent should know not just:
- what a command is called

but also:
- whether it should expect side effects
- whether package memory will change
- whether official outputs will be created
- whether a package boundary will be crossed

That remains true even after simplifying the naming model.

## 19. Revised Recommendation on Modes and Subcommands

With the newer vocabulary, the highest-risk semantic blur now lives less in top-level family names and more in sub-modes/options inside those families.

Current likely hotspots:
- `inspect` when it mixes view vs fresh structural recomputation
- `audit` when it mixes source-only vs render-backed work
- internal runtime/capture mechanisms when they mix observation vs artifact creation vs evidence recording

### 19.1 `inspect` likely needs careful subcommand design

Examples:
- `presentation inspect package`
- `presentation inspect slide --slide <id>`
- `presentation inspect evidence`

If structural recomputation exists, it should be explicit rather than hidden behind a generic inspect call.

### 19.2 `audit` likely needs explicit scope/mode controls

Examples:
- source-only default behavior
- optional render-backed mode such as `--render`
- explicit deck-level aggregation mode

The package should not let one audit invocation silently mean too many different things.

### 19.3 `finalize` may still orchestrate many layers internally

That is acceptable, but its output should preserve layer distinctions clearly:
- diagnostics run
- evidence written or refreshed
- outputs created
- resulting delivery state

### 19.4 Current recommendation

If the future CLI is redesigned, the main semantic families should stay stable:
- `inspect`
- `status`
- `audit`
- `finalize`
- `export`
- optionally `explain`

And the main care should shift to:
- option design
- subcommand clarity
- output contracts

rather than proliferating additional top-level verbs like `check-source` or `capture` unless a later design pass proves they are truly indispensable.

## 20. Canonical Package Nouns / Entities the System Should Think In

Now that command families are taking shape, the next foundational step is to define the canonical nouns of the package.

This matters because:
- commands should operate on stable package concepts
- issue taxonomy should attach to stable package concepts
- explanations should refer to stable package concepts
- adapters and hooks should not invent alternate vocabularies

If the package does not have a clear noun model, the command surface and validator outputs will drift.

### 20.1 Why nouns matter

A good package architecture should not only have verbs.
It should also have a stable object model.

The agent should be able to think in nouns like:
- package
- source artifact
- slide
- structural entity
- policy issue
- evidence record
- deliverable set
- git baseline or git milestone when working through internal history

rather than only thinking in raw paths and ad hoc error strings.

### 20.2 Core package nouns (top level)

#### Package

The root object.
Represents the presentation package as a whole.

Likely properties in concept:
- identity
- title
- package mode/version
- authored source inventory
- structural status
- policy status
- runtime status
- evidence status
- deliverable status

This is the primary noun most summary commands should speak about.

#### Package state

A coarse interpreted view of the package as a whole.

Examples in concept:
- onboarding
- in progress
- blocked
- ready for delivery boundary
- finalized
- finalized outputs diverged from current source

Important note:
- package state should be a derived summary over richer issue families, not the only truth model

### 20.3 Authored source nouns

#### Source artifact

A generic authored input to the package.

Examples:
- `brief.md`
- `outline.md`
- `theme.css`
- `slide.html`
- `slide.css`
- assets
- possibly `intent.json` if treated as authored source

Useful conceptual properties:
- artifact kind
- authored/generated/evidence classification
- editability
- owning scope
- completeness state

#### Brief
A source artifact representing the narrative brief.

#### Outline
A source artifact representing the locked long-form story plan when required.

#### Theme
A source artifact representing deck-wide visual system authorship.

#### Slide source
A source artifact family representing slide-level authored content and optional local styling.

#### Asset
A source artifact representing package-owned media/resource input.

### 20.4 Structural nouns

#### Structural manifest

The deterministic package structure derived from authored source.

This is the package’s normalized structural view, not authored truth.

#### Slide entity

A normalized presentation entity derived from source.

Likely properties:
- stable slide id
- order label/value
- source directory
- source HTML path
- source CSS path if any
- asset scope

Important note:
- the slide entity is not identical to the slide directory name, even if derived from it

#### Structural issue

A problem in the package’s derived structural model.
Examples:
- duplicate derived ids
- invalid slide folder naming
- ambiguous ordering
- missing required source artifacts

### 20.5 Policy nouns

#### Policy rule

A named invariant the package enforces.

Examples in concept:
- theme must stay in `@layer theme`
- slide CSS must stay scoped
- protected canvas selectors may not be overridden
- asset paths must stay inside allowed ownership roots

#### Policy boundary

A conceptual ownership boundary.

Likely recurring boundaries:
- authored vs generated
- content vs theme vs canvas
- local slide scope vs package-wide scope
- project workspace vs outside workspace
- package source vs runtime chrome
- deck authoring surface vs framework integrity surface

This noun is especially important because explanations often refer to boundary crossings.

#### Policy issue

A violation of a policy rule.
Likely properties:
- rule kind
- boundary crossed
- affected entity
- severity
- explanation slots
- next-focus hints

### 20.6 Runtime nouns

#### Runtime judgment

A fresh evaluation result produced by rendering/executing the package.

Examples in concept:
- pass/fail/warn runtime state
- overflow detected
- console/runtime error detected
- rendered canvas contract failure

This is not the same as remembered runtime evidence.

#### Runtime issue

A typed issue produced by runtime judgment.

This should be distinct from policy issues even if both may eventually block readiness.

#### Capture result

A runtime observation/output bundle produced by capture-oriented operations.

May include:
- screenshots
- report data
- extracted runtime observations

### 20.7 Evidence and memory nouns

#### Evidence record

A remembered record of previously computed runtime or package observations.

Examples:
- latest validation evidence
- latest artifact inventory
- remembered runtime state

Important distinction:
- evidence record is remembered state, not authored truth and not fresh runtime judgment itself

#### Freshness state

A noun representing whether remembered evidence still corresponds to current source.

Examples in concept:
- current
- stale
- unknown
- missing

This noun is currently weak in the existing code but likely essential for the future architecture.

#### Git baseline / milestone (agent-internal)

A git commit or comparison point the agent may use to reason about code evolution.

Likely properties in concept:
- commit identity
- commit message
- diff relationship to current source

Important note:
- this is useful for agents, but should not necessarily become a first-class package noun unless the package later gains a true product-level need for it

### 20.8 Output / delivery nouns

#### Artifact

A produced output file or output member.

Examples:
- PDF
- slide screenshot
- summary
- report

#### Artifact set

A collection of related artifacts.

Examples:
- latest capture set
- latest export set
- canonical finalize output set

This is useful because the package often reasons about outputs in bundles, not only individual files.

#### Deliverable state

A noun representing whether the package has crossed a delivery boundary and what official output state exists.

Examples in concept:
- no canonical outputs yet
- outputs partial
- canonical outputs present
- canonical outputs stale relative to source

### 20.9 Guidance nouns

#### Next focus

A recommended next inspection or repair target for the agent.

Examples in concept:
- file path
- slide id
- issue family
- conceptual boundary to inspect

This noun is important if the package is to guide the agent instead of merely failing.

#### Explanation

A deterministic package-native explanation attached to an issue or judgment.

Likely conceptual parts:
- what happened
- why it matters
- what boundary was crossed
- what to inspect next

### 20.10 Likely canonical noun set for first-class modeling

If the noun model needs to stay manageable, the most important first-class nouns are likely:

- package
- package state
- source artifact
- slide entity
- structural manifest
- policy rule
- policy boundary
- issue
- runtime judgment
- evidence record
- freshness state
- artifact
- artifact set
- deliverable state
- next focus
- explanation

This is likely enough to stabilize command outputs and validator outputs without exploding into unnecessary ontology.

### 20.11 Current likely gap in the existing code

The current code seems to think mostly in:
- files
- messages
- coarse state labels

It appears weaker at explicitly modeling nouns like:
- policy boundary
- evidence record
- freshness state
- artifact set
- next focus
- explanation as structured entity

This is likely one of the deepest architectural gaps.

### 20.12 Current architectural recommendation

Before finalizing future command shapes, the architecture should continue to stabilize this noun model.

Reason:
- commands are verbs over nouns
- issues are judgments about nouns
- explanations are narratives about noun relationships
- if the nouns are unstable, the whole package language stays unstable

## 21. Which Nouns Should Be Stored, Computed, or Only Exposed in Output

Now that the package noun model is clearer, the next architectural question is:
- which nouns should exist as durable stored artifacts?
- which should exist only as computed internal objects?
- which should exist mainly as output-schema concepts?
- which should remain conceptual helper categories rather than fully materialized objects?

This matters because not every noun deserves its own file or persisted record.
If too many nouns become stored artifacts, the package truth model becomes bloated and fragile.

### 21.1 Four status classes for package nouns

A useful classification:

1. **Stored artifact noun**
   - has durable representation in package files
2. **Computed core noun**
   - deterministically derived in memory from package truth or package evidence
3. **Output-schema noun**
   - appears primarily in command/query outputs and issue/judgment payloads
4. **Conceptual helper noun**
   - useful for architecture and explanation, but does not necessarily need independent materialization

### 21.2 Nouns that should likely be stored artifacts

These are the nouns that appear important enough to justify durable representation.

#### Package
Should be stored.

Reason:
- the package needs stable identity and package-level metadata
- some package identity/configuration cannot be inferred from raw authored files alone

Likely storage shape:
- package identity file / project metadata file

#### Source artifact
Stored implicitly through actual authored files.

Reason:
- authored source is the core truth surface
- individual source artifacts are real persisted things, not just abstractions

Important nuance:
- the noun is conceptual, but its storage is the authored file itself rather than a separate registry object

#### Structural manifest
Likely stored.

Reason:
- this is the deterministic normalized structural view of the package
- it is useful enough and central enough to justify durable generated representation
- current architecture already trends in this direction

Important nuance:
- this should remain generated truth, not authored truth

#### Evidence record
Likely stored.

Reason:
- latest remembered runtime/evidence state is part of package memory
- if the architecture wants evidence inspection/freshness reasoning, durable records are useful

Important nuance:
- evidence record should remain clearly secondary to authored truth

#### Git baseline / milestone
Not a package-stored object by default.

Reason:
- git already persists it
- the package should avoid duplicating git history unless a clear package-specific need emerges

#### Artifact
Stored implicitly through output files themselves.

Reason:
- output artifacts are real persisted files

Important nuance:
- individual artifact files may exist without needing each to become a fully separate modeled metadata file

#### Artifact set
Likely stored, at least in remembered artifact inventory form.

Reason:
- the package often reasons in output sets/bundles rather than only individual files
- a durable artifact inventory makes those bundles legible

#### Deliverable state
Possibly stored, or at least durably derivable from package memory.

Reason:
- canonical delivery boundary status may need durable representation
- however, this may also be derived from evidence + outputs depending on final architecture

Current recommendation:
- do not decide too early whether deliverable state needs its own stored file or should remain a derived package summary

### 21.3 Nouns that should likely be computed core objects

These are central to package reasoning, but do not obviously need their own persisted storage if they can be derived reliably.

#### Package state
Likely computed.

Reason:
- package state is better treated as a derived summary over richer underlying facts
- storing it as the only truth would flatten too much meaning

Current code already hints at this through coarse status derivation.
The future architecture should likely keep it derived, but richer.

#### Slide entity
Likely computed from authored source + structural manifest.

Reason:
- slide entity is a normalized concept that is central to package reasoning
- but it does not necessarily need a separate durable file beyond the structural manifest and source files

#### Runtime judgment
Likely computed fresh.

Reason:
- runtime judgment is a fresh act of evaluation
- remembered evidence may persist a record of it, but the judgment itself is conceptually a computation, not the stored record

This distinction is important.

#### Capture result
Likely computed during capture operations.

Reason:
- the operation produces a result bundle and possibly artifacts/evidence
- but the noun itself can remain a computed result object rather than needing its own permanent canonical file form beyond outputs/evidence records

### 21.4 Nouns that should likely be first-class output-schema objects

These are especially important in command outputs and issue payloads, even if they do not need their own dedicated storage.

#### Issue
Strong candidate for first-class output-schema object.

Reason:
- issue is the central object for package judgment and guidance
- it should likely become typed and structured across all validation families

#### Structural issue
Likely output-schema specialization of issue.

#### Policy issue
Likely output-schema specialization of issue.

#### Runtime issue
Likely output-schema specialization of issue.

#### Explanation
Strong output-schema object.

Reason:
- explanation should be structured and deterministic
- it likely belongs in command outputs, issue payloads, and hook feedback
- it does not need to exist as an independent stored file

#### Next focus
Strong output-schema object.

Reason:
- this is part of the package’s teaching/guidance surface
- highly valuable in outputs
- probably not worthy of durable storage on its own

#### Freshness state
Likely output-schema object and computed concept.

Reason:
- freshness is likely derived by comparing remembered state to current source
- it should appear prominently in outputs
- it may not need dedicated independent storage beyond whatever evidence records exist

### 21.5 Nouns that may remain conceptual helper categories

These nouns are valuable for architecture and explanation, but may not need independent persistence or heavy object materialization.

#### Policy boundary
Likely conceptual + output-schema, not necessarily stored independently.

Reason:
- extremely important for explanation
- probably best represented as a field/category on issues and explanations rather than as an independent stored artifact

#### Package concept categories like “authored vs generated vs evidence”
Likely conceptual + output-schema.

Reason:
- these are classification systems that should shape outputs and behavior
- they may not need a separate durable object representation beyond package ontology definitions

### 21.6 Provisional recommended materialization map

A compact recommendation:

#### Stored artifacts / durable records
- package
- authored source artifacts (as files)
- structural manifest
- evidence record(s)
- artifact inventory / artifact sets
- possibly some deliverable-state memory

#### Computed core objects
- package state
- slide entity
- runtime judgment
- capture result

#### Output-schema-first objects
- issue
- explanation
- next focus
- freshness state
- structural/policy/runtime issue variants

#### Conceptual helper objects
- policy boundary
- ownership classes
- artifact/source/evidence/internal-git categories

### 21.7 Architectural implication

This materialization split suggests a healthier future core.

The core should not try to store everything.
Instead it should:
- store the minimum durable truths and memories
- compute the active package understanding from them
- expose rich output-schema objects to the agent

That matches the broader philosophy already emerging in this architecture:
- keep truth small
- keep reasoning rich
- keep outputs explanatory
- keep mutation authority with the agent

### 21.8 What this suggests about the current code

The current code appears to:
- already store some of the right things (source, structural manifest, evidence-ish state)
- under-model some computed/core nouns explicitly (slide entity, runtime judgment, package state richness)
- under-model output-schema nouns almost entirely (issue, explanation, next focus, freshness)

So a future redesign likely needs more work in:
- computed object modeling
- output-schema modeling

than in inventing entirely new stored artifacts.

## 22. External Framework Fit: Hardik Pandya’s “LLM Design Systems” Model

This section records how the framework described in Hardik Pandya’s article “Expose your design system to LLMs” fits into the presentation package architecture.

Source read in full during architecture discussion:
- https://hvpandya.com/llm-design-systems

### 22.1 The blog’s core framework in distilled form

The article argues that LLMs drift because they:
- fabricate values
- lose context across sessions
- cannot infer design intent from source code alone
- fail silently over many micro-decisions

Its proposed solution has four tightly related parts:

1. **Spec files the LLM reads every session**
   - structured design knowledge
   - component usage rules
   - composition guidance
   - layout guidance

2. **A closed token layer**
   - the model picks from named design variables instead of inventing values
   - three-layer indirection:
     - upstream design-system tokens
     - project-local aliases
     - components consume aliases only

3. **An audit script that catches every violation**
   - scans for hardcoded values
   - suggests correct token replacements
   - returns machine-usable results
   - blocks drift in CI

4. **Drift detection for upstream updates**
   - when upstream design system changes, local spec/tokens are flagged for review
   - the LLM should always read current specs, not stale assumptions

Additional important themes from the article:
- the system must be re-read every session
- documentation alone is not enough; violations must be blocked
- explanations must be operational, not merely descriptive
- consistency is achieved by constraining choices, not by trusting the model’s taste

### 22.2 Why this framework matters to the presentation package

This article is highly relevant because the presentation package has the same core problem in a different domain.

In a normal app repo, the drifting unit is:
- component styling and composition

In the presentation package, the drifting unit is broader:
- slide layout
- theme values
- content/theme/canvas ownership
- narrative structure
- asset usage
- render integrity

So the presentation package is not merely a code generator.
It is a domain-specific design system and composition system for presentations.

That means the article’s framework fits well — but not as a literal copy.
It must be adapted from:
- “general product UI design system”

to:
- “presentation package design-and-structure system”

### 22.3 Where the article’s framework already exists implicitly in current code

The current codebase already contains partial versions of all four parts.

#### A. Spec layer already exists, but is fragmented

Current analogues:
- `AGENTS.md`
- `.claude/CLAUDE.md`
- `.claude/rules/*`
- docs such as base canvas contract and package spec
- scaffold templates and maintainer docs

These already encode:
- ownership rules
- source boundaries
- structural primitives
- slide authoring rules
- token usage ideas

But from the architecture point of view they are currently:
- fragmented across repo and project layers
- partly vendor-specific
- not normalized into one package-native spec system

#### B. Token layer already exists, but only partially as a closed system

Current analogues:
- `framework/canvas/canvas.css`
- `framework/canvas/canvas-contract.mjs`
- scaffolded `theme.css`
- theme-owned semantic classes and canvas-exposed variables

These already encode:
- structural tokens
- deck-level theme tokens
- some semantic visual primitives

But from the article’s perspective, the current system is only partially “closed” because:
- theme/slide authoring can still introduce raw values
- there is not yet a fully formalized package-wide token regime in the article’s sense
- the current policy engine constrains ownership more than it enforces a closed semantic token language

#### C. Audit/enforcement already exists strongly

Current analogues:
- `framework/runtime/deck-policy.js`
- runtime capture/validation in `presentation-ops-service.mjs`
- check/finalize flows
- some readiness classification in `project-state.js`

This is one of the strongest areas of the current codebase.
The package already has a deterministic audit mindset.

But relative to the article’s model, the audit layer is currently:
- more fragmented than ideal
- less normalized as a stable issue taxonomy
- stronger on ownership/structure than on token-discipline per se

#### D. Drift detection exists only partially

Current analogues:
- linked vs copied framework mode
- `.presentation/project.json` with framework linkage information
- generated manifest/runtime evidence files
- some package memory through runtime state/evidence files

But compared to the article’s framework, the current package is weaker here.
It does not yet have a clean, first-class model for:
- spec freshness
- evidence freshness
- upstream framework drift and downstream package impact
- which package knowledge is stale and needs review

This is one of the major architectural gaps.

### 22.4 How the article’s framework maps into the concentric circles

The fit becomes clearer if we map the article’s four parts into the package circles.

#### Circle 0 / 1 — package ontology and authored source truth

The article’s “spec files the LLM reads every session” maps here, but with an important twist.

For the presentation package, there are likely two kinds of specs:

1. **Package-constitution specs**
   - what the package is
   - what authored/generated/evidence artifacts mean
   - what the ownership model is
   - what source boundaries exist

2. **Presentation-design specs**
   - the design language for a given package
   - theme rules
   - slide composition patterns
   - layout patterns
   - narrative/presentation conventions

The article’s framework suggests these specs should be:
- explicit
- structured
- re-readable by the agent every session
- local to the repo/package

This aligns strongly with the package architecture direction.

#### Circle 1 / 3 — closed token layer

The article’s token layer maps into:
- authored theme/token surface
- policy-enforced ownership boundaries
- a controlled design vocabulary for the agent

For the presentation package, the token system likely needs at least:
- protected structural canvas tokens
- package-level semantic theme tokens
- possibly pattern-level aliases or semantic presentation tokens

Important adaptation:
- the package should not only have tokens for colors and spacing
- it likely also needs a controlled vocabulary for presentation-specific semantics such as:
  - stage modes
  - panel densities
  - content rhythm / spacing tiers
  - semantic emphasis styles
  - narrative/pattern-level composition primitives

This is broader than a normal UI token system.

#### Circle 3 — audit/enforcement

The article’s audit script maps very naturally into the policy circle and the runtime judgment circle.

In package terms, this means:
- source completeness evaluation
- structural evaluation
- ownership/policy evaluation
- runtime/render evaluation
- issue explanations and guidance

The package already trends this way.
The redesign opportunity is to make this audit layer:
- more normalized
- more package-native
- more explanatory
- more stable as an issue taxonomy

#### Circle 5 / outer readiness circles — drift and freshness

The article’s “upstream drift detection” maps into a broader package need:
- freshness of remembered evidence
- freshness of local design-spec assumptions
- drift between framework and package expectations
- drift between remembered package evidence/delivery state and current source

This is where the presentation package can learn a lot from the article.
It currently under-models this area.

### 22.5 The biggest architectural insight from the article for this package

The article’s deepest idea is not just “add docs” or “use tokens.”
The deepest idea is:

> Turn design intent into machine-readable, enforceable, session-replayable package knowledge.

That idea fits the presentation package extremely well.

Applied to this package, it means:
- the package should not only expose files and checks
- it should expose a constrained design-and-structure language the agent can repeatedly re-enter
- the package should carry stable authored knowledge, not force the agent to infer everything from source code and past edits

This strongly supports the direction already emerging in this architecture discussion.

### 22.6 Where the article’s framework does **not** map 1:1

Important differences from a generic product UI repo:

#### A. Presentations are narrative systems, not only component systems

The article emphasizes components, tokens, and layout patterns.

The presentation package also needs to govern:
- story structure
- slide sequencing
- rhetorical pacing
- slide-to-slide rhythm
- dense interplay between content meaning and visual composition

So this package needs an additional layer the article only hints at:
- **narrative composition rules**

#### B. The package has stronger authored/generated/evidence boundaries

The article’s setup is repo-wide and design-system-wide.
The presentation package architecture is more explicit about:
- authored source
- generated structure
- runtime evidence
- delivery/evidence memory that the package actually owns

So the article’s framework needs to sit inside a stronger package ontology here.

#### C. The package uses policy not just for token discipline, but for framework discipline

The article is heavily focused on:
- consistency through tokens
- consistency through documentation
- audit of raw values

The presentation package must also enforce:
- content < theme < canvas
- local slide scope vs package-wide scope
- source vs runtime chrome separation
- framework integrity vs deck authoring
- drift from the chosen theme/canvas/design framework
- drift from pattern/content/narrative guidance once those layers are formalized

So policy is broader here than token enforcement.
It should become the enforcement surface for the full package design framework.

### 22.7 A future package-specific adaptation of the article’s framework

If rethought from scratch, the article’s model might map into the presentation package like this:

#### 1. Package-readable specs
Likely families:
- package constitution specs
- foundations specs
- token/reference specs
- slide pattern specs
- narrative/composition specs
- component/presentation primitive specs where relevant

#### 2. Closed package design language
Likely includes:
- structural canvas tokens
- semantic theme tokens
- approved visual primitives
- approved slide/pattern primitives
- maybe narrative/layout primitives

#### 3. Deterministic package audit
Likely includes:
- source completeness audit
- structural audit
- policy audit
- runtime/render audit
- explanation/guidance layer

#### 4. Drift/freshness model
Likely includes:
- framework drift
- evidence freshness
- delivery/evidence drift relative to current source
- spec freshness / stale package assumptions

This is not just “copy the article.”
This is the package-specific generalization of its framework.

### 22.8 Current fit assessment

Overall assessment:
- the article’s framework fits the presentation package **very well in principle**
- the current codebase already contains partial implementations of almost all of it
- but the current implementation is more fragmented and more vendor-shaped than the ideal described by the article

Most aligned current strengths:
- deterministic audit mindset
- explicit rules and boundaries
- generated structure
- some token/semantic layer already present

Most important gaps relative to the article:
- fragmented spec layer
- insufficiently closed token/design language
- weak first-class freshness/drift model
- lack of normalized issue taxonomy and explanation objects
- limited explicit narrative-composition specification compared to the importance of narrative in presentation work

### 22.9 Practical architectural implication

The article supports — rather than contradicts — the current redesign direction.

In fact, it strengthens several already-emerging conclusions:
- package-readable specs should be central
- deterministic explanation-rich audits are essential
- the package should give the agent a constrained design language rather than relying on taste
- freshness/drift should become first-class
- the package should teach the agent repeatedly, not just fail occasionally

So from a new-architecture point of view, the article’s framework should be treated as a major informing principle for the package core, especially in:
- spec architecture
- token/design-language architecture
- audit/explanation architecture
- freshness/drift architecture

### 22.10 Additional package-specific adaptation: theme, canvas, and content-building after theme lock

A further important adaptation emerged in discussion:
- the article’s framework should not only govern tokens and component styling
- in the presentation package, it should also help define:
  - canvas structures
  - theme-specific structural variation
  - bounded content/framework constraints that keep slides inside the chosen visual system after the theme is fixed

Important correction from later discussion:
- this should not expand into package-defined creative rules for slide-by-slide narrative structure, rhetorical form, or wording
- those remain runtime creative work performed by the agent

This is one of the clearest ways the presentation package extends beyond a standard app design-system architecture.

#### A. The design system for presentations is three-layered, not one-layered

The presentation package should likely treat the design system as operating across three distinct but related surfaces:

1. **Canvas system**
   - protected stage structures
   - stage modes
   - layout primitives
   - structural constraints
   - responsive/presentation behavior primitives

2. **Theme system**
   - visual identity
   - semantic visual tokens
   - theme-level components/patterns
   - theme-specific structural variants where allowed

3. **Content/framework boundary system**
   - what kinds of content-level constraints are hard enough to govern
   - how content may sit inside a chosen theme/canvas language without breaking it
   - density and ownership boundaries where they are deterministic enough to enforce

This means the package’s design-system architecture cannot stop at “foundations + tokens + components.”
It needs to govern all three layers, but without taking over the agent’s creative authorship of slide-by-slide narrative structure.

#### B. What “theme fixed” should mean architecturally

Once the theme is fixed, the agent should no longer behave like a freeform visual designer on every new slide.

Instead, the package should shift the agent into a different mode:
- the theme has defined the allowed visual language
- the canvas has defined the allowed structural language
- slide-building should now be an act of composing content through those systems rather than re-inventing visual structure each time

So after theme lock, the package should constrain the agent more at the level of visual language and protected framework rules, but not at the level of dictating the exact creative structure of each slide.

#### C. How the design system should guide slide building after theme lock

After the theme is fixed, the package design system should come into play in at least four ways.

##### 1. It should constrain the agent’s choice space

The agent should no longer be deciding from scratch:
- what kind of spacing style to use
- what kind of card language to invent
- what kind of heading rhythm to pick
- what kind of visual emphasis device to create

Instead, it should choose from a package-defined design language.

This is analogous to the article’s “closed token layer,” but broader:
- closed visual language
- closed structural language
- constrained composition patterns

##### 2. It should provide reusable canvas/theme affordances

The package may provide reusable visual and structural affordances such as:
- stage modes
- allowable primitive combinations
- emphasis devices
- density bands
- approved visual treatments
- optional example structures

Important correction:
- these should not become mandatory package-level slide-category prescriptions by default
- the package may expose examples and affordances, but the agent should remain free to determine slide-specific structure at runtime

The theme may then provide variation in how those affordances are visually realized.

##### 3. It should provide theme-specific composition guidance

Once a theme is fixed, the agent should know things like:
- when this theme wants dense vs airy slides
- how this theme handles emphasis and contrast
- how image-forward vs text-forward slides should behave visually in this theme
- what visual rhythm and restraint the theme expects

Important correction:
- this guidance should shape the agent’s design choices, but should not become a rigid package-authored narrative template system by default

This is where “theme” becomes more than tokens.
It becomes a visual-compositional system.

##### 4. It should provide content-layer boundaries, not creative authorship rules

Important correction from later discussion:
- the package should not define the creative rules of what the narrative should be, how each slide’s rhetoric should be structured, or what words/content forms the agent must use
- that remains runtime creative work performed by the agent

What the package can still govern at the content layer is narrower:
- hard legality boundaries
- density ceilings where those are truly deterministic
- ownership boundaries between content/theme/canvas
- optional examples or guidance that help the agent, without becoming mandatory narrative prescriptions

This keeps the package from overreaching into the agent’s creative authorship.

#### D. A likely future architecture for this layered design system

A strong package-specific adaptation of the article’s framework might therefore include specs in these families:

1. **Canvas specs**
   - protected structures
   - stage modes
   - layout primitives
   - structural rules

2. **Theme specs**
   - visual identity
   - semantic tokens
   - theme-specific primitives
   - emphasis/rhythm rules
   - visual pattern variations

3. **Optional pattern / example specs**
   - reusable examples
   - non-binding structural references
   - affordance documentation for the agent

4. **Content boundary specs**
   - density rules where deterministic
   - text/image/data balance guidance where formalizable
   - ownership and legality boundaries

Important correction:
- narrative structure, rhetorical structure, and wording should not be elevated into package-enforced specs by default
- those remain runtime creative work by the agent

This is still larger than the article’s standard app DS hierarchy, but deliberately less prescriptive than a full narrative grammar.

#### E. How this changes the role of the agent during slide building

Before theme lock, the agent is acting more like:
- system designer
- language setter
- presentation art director

After theme lock, the agent should act more like:
- constrained visual composer
- framework-aware slide builder
- content arranger within a fixed visual language
- but still the creative author of slide-specific narrative structure

This is a major behavioral shift.
The package should help enforce it.

#### F. Why this matters for package quality

Without this shift, even a strong theme will not stop drift.
The agent will still:
- improvise new structures
- repeat weak layouts
- invent new visual treatments
- produce local decisions that technically fit tokens but still degrade coherence

So the package needs not only:
- theme tokens
- audits for raw values

but also:
- protected canvas language
- theme-specific visual-composition rules
- bounded content/framework constraints after theme lock

This is likely one of the most important package-specific additions beyond the article.

#### G. Practical architectural conclusion

The article’s framework should therefore be extended in this package from:
- specs + tokens + audit + drift

to something more like:
- **canvas specs**
- **theme specs**
- **optional pattern/example specs**
- **content boundary specs**
- **audit/explanation/drift**

That is how the design system continues to matter after the theme is fixed.
It stops the agent from merely being token-compliant and pushes it toward being framework-compliant at the visual/system level while preserving creative freedom at the slide-authoring level.

And importantly:
- validators should be the mechanism that actively checks drift from this package framework where rules are deterministic enough
- validation should not only ask "is this CSS legal?"
- it should increasingly ask "is this slide/package still obeying the chosen canvas-theme framework and its hard design constraints?"
- the resulting issue list should be returned to the agent as structured package-native guidance

## 23. Validator Role in Enforcing the Full Package Framework

A major refinement emerging from discussion:
- validators should not stop at low-level legality checks
- they should become the enforcement surface for the package’s full design framework

This means validation should eventually look for drift across multiple layers:
- drift from canvas rules
- drift from theme rules
- drift from the chosen visual/design framework
- drift from pattern/composition rules
- drift from content/narrative rules where they can be made deterministic enough

### 23.1 What “framework enforcement” means in this package

The package framework is larger than CSS correctness.
It includes at least:
- structural canvas rules
- theme identity and allowed variation
- hard visual/composition constraints that are deterministic enough to enforce
- bounded content/framework constraints such as density or ownership where they can be expressed clearly

Important correction:
- the package framework should not, by default, define the creative narrative structure of each slide or dictate wording/content strategy
- those remain runtime creative decisions by the agent

So a mature validator architecture should not just say:
- this selector is illegal
- this asset path is invalid
- this slide overflows

It should also be able to say things more like:
- this slide has drifted from the chosen theme/canvas language
- this slide introduced a visual treatment outside the approved framework
- this slide exceeds framework-defined density constraints
- this content/theme/canvas boundary has been crossed

### 23.2 How this extends the current validator model

Current validators are strongest at:
- source legality
- ownership boundaries
- runtime/render correctness

The new direction adds a higher-order layer:
- framework-compliance validation

This should likely sit above basic legality checks.

That means a future validation stack may need to distinguish:

1. **Can this package be understood structurally?**
2. **Is this source legal under hard ownership/policy rules?**
3. **Does the rendered/runtime output behave correctly?**
4. **Is the package still compliant with the chosen design/composition framework?**

This fourth question is the new addition.

### 23.3 Likely validator strata in the future architecture

A future validation architecture may therefore need layers such as:

#### A. Structural validators
- source completeness
- source structure
- structural compilation correctness

#### B. Policy validators
- ownership boundaries
- scope boundaries
- token/canvas/theme legality
- framework integrity protection

#### C. Runtime validators
- runtime errors
- overflow
- rendered contract problems
- artifact/runtime integrity

#### D. Framework-compliance validators
- theme drift
- canvas drift
- structural-affordance misuse where the rule is explicit
- density/budget drift
- content/theme/canvas boundary drift

This last layer is where the package design framework becomes actively enforceable without taking over creative slide authorship.

### 23.4 What validators should return to the agent

As this framework-compliance layer grows, the validator output should still obey the earlier design principles:
- deterministic
- structured-first
- explanatory
- package-native
- returned to the agent rather than silently auto-fixed

So validation should return issue lists that help the agent understand:
- what framework layer drifted
- why it matters
- what boundary or design rule was crossed
- what to inspect next
- what neighboring files/slides/specs are relevant

This preserves the principle that:
- the system judges
- the system explains
- the agent fixes

### 23.5 Important caution

Not every design-system or narrative rule can be made deterministic immediately.

So the future validator architecture should likely distinguish between:
- **hard violations**
- **strong guidance / framework warnings**
- **advisory composition/narrative drift signals**

This matters because some framework ideas are naturally easier to formalize than others.

Examples likely easier to validate:
- using disallowed structural primitives
- violating theme token rules
- repeating prohibited local CSS behavior
- exceeding defined density thresholds
- introducing non-approved visual/compositional treatments

Examples likely harder at first — and likely outside core package enforcement by default:
- rhetorical weakness
- subtle narrative pacing issues
- what exact slide structure best fits the narrative
- what wording or rhetorical form the slide should use
- whether a slide’s emotional tone fits the theme

So framework enforcement should grow outward from the most deterministic rules first.

### 23.6 Architectural recommendation

A future package redesign should explicitly reserve room for a validator layer that enforces not only:
- legality
- runtime correctness

but also:
- framework compliance

That is likely how the package will remain coherent after theme lock.
The agent should build within the chosen system, and validators should be the package mechanism that detects and reports when the work drifts away from that system.

## 24. First Deterministic Framework-Compliance Rules to Consider

Now that framework-compliance validation is part of the architecture, the next question is:
- what should the first deterministic framework-compliance rules actually be?

This section focuses on the earliest rules that seem realistic, useful, and aligned with the package’s revised philosophy.

The intent is **not** to jump into narrative judgment.
The intent is to start with framework-compliance rules that are:
- deterministic enough
- package-native
- high value
- explainable to the agent
- close to the blog article’s successful “audit” posture

### 24.1 What the blog contributes here

After re-checking Hardik Pandya’s article, the most useful validation lesson is not a literal code artifact but an architectural pattern:
- spec files define the intended system
- a closed token/language layer limits allowed choices
- an audit script detects drift
- the audit prints specific violations plus concrete suggestions
- CI can fail on zero-tolerance violations

The article does **not** provide a full reusable validation codebase in the post itself.
What it provides is a very clear validator contract, including:
- what `token-audit.js` should scan
- how it should classify issues
- what output shape it should print
- that it should return exit code `1` on hard violations

That pattern maps extremely well to the presentation package.

### 24.2 Selection criteria for early framework-compliance rules

The first rules should ideally satisfy most of these:
- they encode a real package/framework expectation
- they are stricter than raw legality but still deterministic enough to implement
- they materially improve slide/deck coherence
- they can be explained in package-native language
- they can produce clear next-focus guidance for the agent
- they can be expressed in an audit-like form: violation + reason + suggested correction target

### 24.3 Candidate rule family A — theme-language / token audit

Conceptual goal:
- once a theme is fixed, slides should remain inside its approved visual language rather than inventing local values or treatments

Potential early deterministic rules:
- no raw visual values in slide-local CSS where theme tokens should be used
- only approved semantic theme tokens may be used for governed properties
- forbid local overrides of theme-owned appearance dimensions beyond defined escape hatches
- flag non-approved visual treatment classes or selectors in theme-governed categories

Why this is a strong early candidate:
- it is the closest analogue to the blog’s token-audit model
- it is highly deterministic
- it can produce precise suggestions such as “replace this raw value/treatment with the approved theme primitive”

### 24.4 Candidate rule family B — canvas primitive / structure audit

Conceptual goal:
- keep slides inside the allowed stage/canvas language without dictating slide-specific rhetoric

Potential early deterministic rules:
- only approved structural primitives may appear in authored slide markup
- forbid illegal primitive nesting or forbidden primitive combinations
- require protected wrappers/containers where the canvas contract demands them
- detect unapproved layout mechanisms introduced outside the canvas vocabulary

Why this is a strong early candidate:
- it is strongly package-native
- it respects the boundary between framework enforcement and creative authorship
- it can be explained clearly as “this slide crossed the canvas contract”

### 24.5 Candidate rule family C — ownership / boundary audit

Conceptual goal:
- preserve the separation between content, theme, and canvas ownership

Potential early deterministic rules:
- content source may not redefine theme-owned concerns
- theme source may not mutate canvas-owned structure
- slide-local authored source may not modify protected package/runtime evidence files
- authored content may not smuggle framework changes through disallowed files or selectors

Why this is a strong early candidate:
- the current package already has ownership instincts in this direction
- this is one of the clearest package-native invariants
- violations are easy to explain and route back to the agent

### 24.6 Candidate rule family D — density / budget audit

Conceptual goal:
- prevent slides that are legal but obviously overloaded relative to the framework’s intended operating range

Potential early deterministic rules:
- maximum counts for headings, body blocks, cards, or table rows where the package defines such budgets
- word/line/element ceilings for specific bounded contexts
- limits on concurrent primary content modes on a single slide
- theme-specific density bands where formalized

Why this is a strong early candidate:
- density is often measurable
- it can catch common agent failure modes without prescribing exact slide rhetoric
- it produces actionable feedback such as “reduce block count” rather than vague design critique

Important caution:
- density rules should be framed as budgets and ceilings, not creative templates

### 24.7 Candidate rule family E — theme-mode usage audit

Conceptual goal:
- if a theme defines strong visual modes or emphasis states, their use should remain controlled

Potential early deterministic rules:
- restrict which theme modes are allowed in authored slide contexts
- limit overuse of high-emphasis modes across a deck
- reserve special punctuation treatments for explicitly defined conditions
- flag mode combinations the theme marks as incompatible

Why this is a strong early candidate:
- it is visually meaningful while still deterministic
- it extends theme governance without drifting into narrative prescription

### 24.8 Candidate rule family F — deck-level drift warnings

Conceptual goal:
- catch emerging visual drift across the deck without pretending the package can fully judge narrative quality

Potential early deterministic or semi-deterministic rules:
- warn on repeated overuse of the same high-emphasis mode
- warn on repeated over-dense slides in sequence
- warn when deck-wide token/theme usage falls outside expected balance bands
- warn when a deck accumulates too many local exceptions or escapes

Why this is a useful later candidate:
- it addresses real multi-slide drift
- it can begin as warnings instead of hard gates
- it remains about system coherence, not rhetorical taste

### 24.9 Recommended order of introduction

Current best judgment for incremental adoption:

#### Phase 1 — closest to the blog’s audit model
- theme-language / token audit
- canvas primitive / structure audit
- ownership / boundary audit
- severe density ceilings

#### Phase 2 — strong next layer
- theme-mode usage constraints
- richer density/budget rules
- deck-level drift warnings

#### Phase 3 — only if they remain deterministic enough
- more nuanced deck-level balance checks
- stronger framework identity checks tied to explicit specs
- freshness/drift checks against versioned package framework inputs

This ordering respects the principle that framework-compliance validation should expand from the most deterministic rules first.

### 24.10 Likely validation severity model for these rules

Current recommendation:

#### Hard fail candidates
Likely candidates:
- theme token/language violations where the rule is explicit
- illegal canvas primitive usage
- ownership boundary violations
- severe density ceilings where package budgets define them clearly

#### Warning / strong guidance candidates
Likely candidates:
- emerging theme-mode misuse
- softer density concerns
- accumulation of local framework escapes
- deck-level drift signals

#### Advisory candidates
Likely candidates:
- weaker balance heuristics
- non-blocking coherence observations that still remain deterministic enough to report

This matters because not all framework drift should initially block the package.
Some of it should first teach the agent before it becomes a hard gate.

### 24.11 What the validators should return for framework-compliance rules

These new rules should still follow the earlier output philosophy.
For each framework-compliance issue, the package should ideally return:
- issue kind
- framework layer involved (canvas/theme/boundary/density/deck-drift)
- what drifted
- why it matters
- what boundary or design rule was crossed
- what slide/entity/spec to inspect next
- the closest approved correction target, when deterministically knowable

This is one of the clearest takeaways from the blog article:
- the validator should not just say “bad”
- it should say what the approved system element is instead

This will make framework-compliance validation an extension of the package’s teaching surface, not merely a stricter linter.

### 24.12 Current recommendation

The best first deterministic framework-compliance rules are likely the ones closest to an audit model:
- theme-language/theme-token drift rules
- illegal canvas primitive or structure usage
- ownership/boundary violations
- explicit density ceilings

These are likely to provide the highest coherence gains with the lowest ambiguity while staying out of creative slide authorship.

## 25. Course Correction: Structural Pattern Families Should Not Become Mandatory Creative Authoring Rules

A major correction emerged in discussion:
- if “pattern family” means defining how certain content should be structured for certain slide categories, it is too prescriptive for the package core
- the package should not define the creative rules of what the narrative should be, how each slide’s rhetoric should be structured, or what words/forms the agent must use
- that work should happen at runtime by the agent

So the earlier, stronger pattern-family architecture should be reconsidered.

### 25.1 What should be kept out of the core framework

The package core should avoid enforcing things like:
- exact slide-category-to-structure mappings
- mandatory narrative roles for slides
- prescriptive rhetorical structure per slide type
- content prescriptions such as “comparison slides must always look like X”
- word-choice/content-shape rules beyond hard legality and deterministic density constraints

Reason:
- this turns the package into a creative authoring system rather than a design/framework system
- it takes too much authorship away from the agent
- it risks making the package rigid, repetitive, and over-specified

### 25.2 What can remain from the earlier pattern-family idea

Not everything from the earlier pattern-family discussion needs to be thrown away.
The useful part is narrower.

The package may still define or expose:
- low-level canvas primitives
- stage modes
- approved visual/structural affordances
- optional example structures
- optional non-binding reference patterns

But these should be treated as:
- references
- affordances
- examples
- visual-framework guidance

not as mandatory structural categories the agent must map every slide into.

### 25.3 Better replacement concept: structural affordances, not enforced pattern families

A better package-core concept may be:
- **structural affordances**

Meaning:
- the package defines what kinds of structural moves are available and protected
- the theme defines how those moves are visually realized
- the agent still decides how to compose a given slide creatively at runtime

This is much less prescriptive than a mandatory pattern-family model.

Examples of structural affordances might include:
- stage modes
- primary split structures
- collection/grouping affordances
- emphasis/callout affordances
- media-emphasis affordances
- stat emphasis affordances

The important difference is:
- affordances expand the agent’s controlled choice space
- they do not fully predetermine slide category or narrative structure

### 25.4 What validators should still enforce in this lighter model

Even if the package does not enforce pattern-family compliance, validators can still enforce:
- canvas integrity
- theme-language integrity
- disallowed primitive usage
- illegal local overrides
- hard density ceilings where clearly deterministic
- framework drift in the visual/system sense

So the validator remains strong, but its enforcement target stays narrower:
- visual/system discipline
- not creative narrative prescription

### 25.5 What should remain the agent’s runtime creative responsibility

The agent should remain responsible for:
- deciding what kind of slide a given idea needs
- deciding whether a slide should be more argument-led, evidence-led, or summary-led
- deciding how the narrative unfolds slide by slide
- deciding the rhetorical structure and wording
- deciding how to combine content meaningfully within the allowed framework

This preserves the principle that:
- the package constrains the framework
- the agent authors the presentation

### 25.6 Revised architectural recommendation

The package should likely avoid making strong slide-category pattern families first-class validation targets in the early architecture.

Instead, it should invest in:
- strong canvas specs
- strong theme specs
- strong legality/policy enforcement
- strong explanation/guidance output
- a controlled visual/system language
- optional examples/reference patterns rather than mandatory pattern taxonomies

This is a better fit for the package philosophy currently emerging in discussion.

## 26. Concrete Issue Schema and CLI Output Model for First Audit Commands

Now that the first-wave validator direction is clearer, the package needs a more concrete issue schema and output contract.

This section proposes a deterministic, audit-oriented model for the first CLI-facing validators.

### 26.1 Design goals for the issue/output contract

The first audit commands should be:
- deterministic
- machine-readable first
- still readable by a human in the terminal
- package-native in vocabulary
- explicit about the crossed boundary
- explicit about the closest correction target
- non-mutating

This follows the most useful lesson from the blog article:
- a validator is most useful when it says not only **what is wrong**
- but also **what approved system element should be used instead**

### 26.2 Canonical issue object (working model)

A first-pass issue object could look conceptually like this:

```json
{
  "code": "theme.raw-value",
  "severity": "error",
  "layer": "theme",
  "scope": "slide",
  "subject": "slide:014-growth-metrics",
  "summary": "Slide-local CSS introduced a raw color value outside the theme token set.",
  "whyItMatters": "Theme-governed appearance must come from approved theme tokens so slides stay inside the chosen visual language.",
  "boundary": "content may not invent theme-owned visual values",
  "locations": [
    {
      "path": "slides/014-growth-metrics/slide.css",
      "line": 42,
      "column": 10,
      "selector": ".metric-link"
    }
  ],
  "suggestion": {
    "kind": "replace-with-approved-token",
    "target": "var(--color-link)",
    "reason": "closest approved token for this color role"
  },
  "nextInspect": [
    "slides/014-growth-metrics/slide.css",
    ".presentation/theme.css",
    "specs/theme/color.md"
  ],
  "evidence": [
    "found raw value #2563EB in a theme-governed property"
  ]
}
```

This is deliberately closer to an audit finding than to an exception stack trace.

### 26.3 Required issue fields

Current recommendation for required fields:
- `code`
  - stable rule/issue identifier such as `theme.raw-value` or `canvas.illegal-primitive`
- `severity`
  - `error`, `warning`, or `advisory`
- `layer`
  - package layer involved, such as `theme`, `canvas`, `boundary`, `density`, `deck`
- `scope`
  - scope of the judgment: `slide`, `deck`, `theme`, `package`, etc.
- `subject`
  - the primary entity being judged
- `summary`
  - deterministic short statement of what happened
- `whyItMatters`
  - deterministic statement of why the package cares
- `boundary`
  - deterministic statement of the crossed rule or ownership boundary
- `locations`
  - one or more concrete source/evidence locations
- `nextInspect`
  - what the agent should inspect next

These fields make the output useful both as:
- machine-parseable judgment
- agent-facing repair guidance

### 26.4 Optional issue fields

Useful optional fields include:
- `suggestion`
  - the closest approved replacement target, if deterministically knowable
- `evidence`
  - compact facts supporting the issue
- `metrics`
  - measured values for density/budget-style audits
- `specRefs`
  - relevant package spec references
- `freshness`
  - whether the evidence is current relative to source
- `relatedIssues`
  - nearby or grouped findings

Important rule:
- suggestions should remain deterministic and bounded
- the validator should suggest approved targets when known, but should not silently rewrite authored source

### 26.5 First recommended issue-code families

A useful first taxonomy would be something like:

#### Theme audit codes
- `theme.raw-value`
- `theme.unapproved-token`
- `theme.unapproved-treatment`
- `theme.illegal-local-override`
- `theme.mode-misuse`

#### Canvas audit codes
- `canvas.illegal-primitive`
- `canvas.forbidden-combination`
- `canvas.illegal-nesting`
- `canvas.unapproved-layout-mechanism`

#### Boundary audit codes
- `boundary.content-overrides-theme`
- `boundary.theme-overrides-canvas`
- `boundary.authored-source-touches-protected-output`
- `boundary.illegal-selector-scope`

#### Density audit codes
- `density.block-budget-exceeded`
- `density.table-budget-exceeded`
- `density.mixed-mode-overload`
- `density.word-budget-exceeded`

#### Deck drift codes
- `deck.mode-overuse`
- `deck.exception-overuse`
- `deck.repeated-overdensity`

These codes should stay:
- stable
- package-native
- broad enough to survive implementation changes underneath

### 26.6 Top-level command result shape

The command result should use a consistent top-level envelope.
A working model:

```json
{
  "command": "presentation audit theme --slide 014 --format json",
  "status": "fail",
  "scope": {
    "kind": "slide",
    "slideId": "014-growth-metrics"
  },
  "summary": {
    "errors": 1,
    "warnings": 0,
    "advisories": 0,
    "checkedRules": 12
  },
  "issues": [],
  "nextFocus": [
    "slides/014-growth-metrics/slide.css",
    ".presentation/theme.css",
    "specs/theme/color.md"
  ],
  "evidence": [
    "theme token audit completed against current source"
  ],
  "freshness": {
    "relativeToSource": "current"
  }
}
```

This aligns with earlier output goals already captured in this document:
- `status`
- `summary`
- `issues`
- `nextFocus`
- `evidence`
- `freshness`
- `scope`

### 26.7 Recommended CLI command family for the first audits

Naming is still provisional, but a strong first command family would be:
- `presentation audit theme`
- `presentation audit canvas`
- `presentation audit boundaries`
- `presentation audit density`
- `presentation audit deck`
- `presentation audit all`

Useful filters/options:
- `--slide <id>`
- `--path <path>`
- `--format text|json`
- `--severity error|warning|advisory`
- `--strict`

Important behavioral rule:
- these commands should be diagnostic-only
- they should never mutate authored source

### 26.8 Exit-code model for audit commands

A simple first exit-code model:
- `0`
  - command completed and found no hard violations
- `1`
  - command completed and found one or more hard violations
- `2`
  - command could not complete due to internal/runtime failure
- `3`
  - command could not produce a trustworthy judgment because prerequisites were missing, stale, or unsupported for the requested scope

This preserves the useful CI pattern from the blog article while adding room for package-specific “judgment unavailable” states.

### 26.9 Human terminal output style

The text output should remain deterministic and compact.
A working style:

```text
presentation audit theme --slide 014
status: fail
scope: slide 014-growth-metrics
summary: 1 error, 0 warnings, 0 advisories

[error] theme.raw-value
what: slide-local CSS introduced raw value #2563EB
why: theme-governed appearance must use approved theme tokens
boundary: content may not invent theme-owned visual values
where: slides/014-growth-metrics/slide.css:42 (.metric-link)
suggest: replace with var(--color-link)
inspect-next: slides/014-growth-metrics/slide.css, .presentation/theme.css, specs/theme/color.md
```

This should read like:
- a package audit
not like:
- a generic parser stack trace

### 26.10 Command-result design rule

For first-wave audits, every issue should try to answer five deterministic questions:
1. what was found?
2. why does the package care?
3. what boundary was crossed?
4. where should the agent look next?
5. what approved target should replace it, if known?

That is probably the cleanest way to turn validation into a teaching surface without turning the package into a creative author.

### 26.11 Current recommendation

The first implemented audit commands should share one common issue schema and one common result envelope, even if the underlying checkers are separate.

That will let:
- CLI output stay consistent
- hooks reuse the same semantics later
- agents learn one package language
- new validator families plug in without redefining how issues are explained

## 27. First Concrete Rule Set for the Audit Architecture

Now that the issue schema and command envelope are clearer, the next step is to define the first concrete rules.

The main design question is not only:
- which rules should exist?

but also:
- which rules should operate on source only?
- which require rendered output?
- which only make sense as deck-level aggregation?

### 27.1 Operating-surface principle

Current recommendation:

#### Prefer source-only when possible
Reason:
- fastest to run
- easiest to explain
- safest for frequent agent diagnostic loops
- closest to the blog article’s token-audit model

#### Use rendered-output rules only where source inspection is insufficient
Reason:
- some drift only becomes visible after cascade/layout/runtime assembly
- rendered checks are more expensive and should be narrower

#### Use deck-level aggregation for coherence signals, not first-pass creative judgment
Reason:
- multi-slide drift is real
- but deck-level rules should mostly begin as warnings unless the package has a very explicit hard limit

### 27.2 Rule-definition shape (working model)

Each concrete rule should eventually specify at least:
- `code`
- `layer`
- `surface`
  - `source`, `render`, or `deck`
- `defaultSeverity`
- `subjectKind`
  - `slide`, `theme`, `package`, `deck`
- `detectionInputs`
- `boundary`
- `approvedCorrectionTarget`
  - when deterministically knowable

This keeps rule definitions aligned with the issue schema introduced above.

### 27.3 Recommended first 12 rules

#### Rule 1 — `theme.raw-value`
- layer: `theme`
- surface: `source`
- default severity: `error`
- subject: slide-local CSS or authored theme-extension CSS

Detect:
- raw hex/rgb/rgba values
- raw spacing/font/radius/shadow/z-index values
- raw visual values in theme-governed properties where approved tokens should be used

Why first:
- this is the closest direct analogue to the blog article’s token audit
- highly deterministic
- easy to attach a concrete replacement suggestion

Typical correction target:
- approved semantic token such as `var(--color-link)` or `var(--space-200)`

#### Rule 2 — `theme.unapproved-token`
- layer: `theme`
- surface: `source`
- default severity: `error`
- subject: slide-local CSS or authored theme-extension CSS

Detect:
- references to unknown tokens
- references to upstream/raw/internal tokens that slides are not allowed to consume directly
- token usage outside the allowed semantic layer

Why first:
- preserves the closed language principle
- prevents agents from “guessing” token names even when they avoid raw values

Typical correction target:
- nearest approved semantic token in the allowed alias layer

#### Rule 3 — `theme.illegal-local-override`
- layer: `theme`
- surface: `source`
- default severity: `error`
- subject: slide-local CSS selectors and declarations

Detect:
- slide-local CSS overriding theme-owned appearance dimensions through forbidden selectors or properties
- local redefinition of protected heading/card/link/button treatment categories
- use of forbidden escape hatches for appearance control

Why first:
- raw-value policing alone is not enough
- a slide can still drift by overriding the wrong semantic concern with legal-looking CSS

Typical correction target:
- move the concern back into the approved theme mechanism or use the permitted slide-local hook

#### Rule 4 — `canvas.illegal-primitive`
- layer: `canvas`
- surface: `source`
- default severity: `error`
- subject: authored slide markup

Detect:
- use of structural primitives not in the package’s approved canvas vocabulary
- markup patterns that bypass the stage/canvas contract entirely

Why first:
- strongly package-native
- highly explainable
- does not dictate what the slide means, only which structural language it may use

Typical correction target:
- approved canvas primitive or container structure

#### Rule 5 — `canvas.forbidden-combination`
- layer: `canvas`
- surface: `source`
- default severity: `error`
- subject: authored slide markup

Detect:
- mutually exclusive stage modes used together
- illegal primitive combinations
- forbidden nesting combinations defined by the canvas spec

Why first:
- catches framework drift one level above simple primitive legality
- still fully deterministic if the forbidden combinations are explicit

Typical correction target:
- remove one incompatible primitive/mode or refactor into an approved structure

#### Rule 6 — `boundary.illegal-selector-scope`
- layer: `boundary`
- surface: `source`
- default severity: `error`
- subject: slide-local CSS

Detect:
- selectors that escape slide-local scope
- selectors that reach theme/canvas/package-owned DOM outside the permitted authored boundary
- selectors that target global/product-level structures from local slide code

Why first:
- directly preserves package ownership boundaries
- very compatible with deterministic explanation output

Typical correction target:
- rewrite selector to stay inside slide-local scope or move concern to the owned layer

#### Rule 7 — `boundary.authored-source-touches-protected-output`
- layer: `boundary`
- surface: `source`
- default severity: `error`
- subject: package file graph

Detect:
- authored changes inside generated/runtime-owned/protected output paths
- authored source that attempts to import from or depend on runtime evidence as if it were authorable truth
- edits that cross protected package-memory boundaries

Why first:
- this is a core package invariant, not a style preference
- helps preserve the authored/generated/evidence split already central to the architecture

Typical correction target:
- move the change back to authorable source or re-run the proper deterministic generation step

#### Rule 8 — `density.block-budget-exceeded`
- layer: `density`
- surface: `source`
- default severity: `warning` (can escalate to `error` where budgets are explicit)
- subject: authored slide source

Detect:
- too many major content blocks on one slide
- too many peer cards/items for a bounded layout context
- too many concurrent primary content modes on one slide

Why first:
- catches a common agent failure mode without prescribing narrative form
- can remain framework-level if budgets are explicit and limited to measurable counts

Typical correction target:
- reduce block count, split the slide, or use a lighter approved structure

#### Rule 9 — `density.word-budget-exceeded`
- layer: `density`
- surface: `source`
- default severity: `warning`
- subject: authored text-bearing slide source

Detect:
- slide text volume above explicit per-context word/character/line-count budgets
- excessive text inside bounded callout/stat/emphasis contexts

Why first:
- still measurable
- supports readability/density discipline without telling the agent what rhetorical structure to use

Typical correction target:
- reduce text volume or move detail to another slide/note/context

#### Rule 10 — `theme.rendered-drift`
- layer: `theme`
- surface: `render`
- default severity: `warning` or `error` depending on rule certainty
- subject: rendered slide DOM/computed style output

Detect:
- computed visual treatment that falls outside approved theme ranges or modes
- cascade outcomes that produce non-approved appearance despite superficially legal source tokens
- rendered style drift visible only after full assembly

Why this belongs in the first concrete set:
- it is one of the clearest places where render-backed auditing is genuinely needed
- it complements source auditing rather than replacing it

Typical correction target:
- inspect the local selector, theme mapping, or computed token path producing the drift

#### Rule 11 — `deck.mode-overuse`
- layer: `deck`
- surface: `deck`
- default severity: `warning`
- subject: deck-wide slide set

Detect:
- overuse of a high-emphasis theme mode across the deck
- repeated use of strong visual punctuation beyond package-defined soft limits

Why this belongs in the first deck-level set:
- it addresses true deck-level drift
- still stays on the visual/system side rather than narrative judgment

Typical correction target:
- reduce repeated use of the flagged mode or reserve it for fewer slides

#### Rule 12 — `deck.exception-overuse`
- layer: `deck`
- surface: `deck`
- default severity: `warning`
- subject: deck-wide slide set

Detect:
- too many local exceptions, overrides, or framework escape hatches across the deck
- accumulation of individually legal but coherence-eroding deviations

Why this belongs in the first deck-level set:
- drift is often cumulative rather than isolated
- this gives the package a way to talk about rising systemic incoherence without pretending to judge narrative quality

Typical correction target:
- reduce slide-local exceptions and consolidate back into approved theme/canvas mechanisms

### 27.4 Surface summary by rule

#### Best first source-only rules
These are the strongest candidates for the very first implementation wave:
- `theme.raw-value`
- `theme.unapproved-token`
- `theme.illegal-local-override`
- `canvas.illegal-primitive`
- `canvas.forbidden-combination`
- `boundary.illegal-selector-scope`
- `boundary.authored-source-touches-protected-output`

Reason:
- fast
- deterministic
- cheap enough for repeated agent-triggered audits
- strongest fit with hook-safe diagnostics

#### First render-backed rule
The strongest early render-backed candidate is:
- `theme.rendered-drift`

Reason:
- some drift only appears after cascade/composition
- this gives the package a principled reason to render when source checks are not enough

#### First deck-level aggregation rules
Strong first aggregation candidates:
- `deck.mode-overuse`
- `deck.exception-overuse`

Reason:
- they speak in package-coherence terms without drifting into narrative prescription

### 27.5 Suggested implementation order

#### Wave 1 — source-only audit core
- `theme.raw-value`
- `theme.unapproved-token`
- `boundary.illegal-selector-scope`
- `canvas.illegal-primitive`
- `canvas.forbidden-combination`
- `boundary.authored-source-touches-protected-output`

#### Wave 2 — richer source budgets
- `theme.illegal-local-override`
- `density.block-budget-exceeded`
- `density.word-budget-exceeded`

#### Wave 3 — render-backed confirmation
- `theme.rendered-drift`

#### Wave 4 — deck aggregation
- `deck.mode-overuse`
- `deck.exception-overuse`

This order keeps the first implementation close to:
- the blog article’s audit posture
- deterministic rule finding
- non-mutating agent guidance

### 27.6 Current recommendation

If the package only implements a small first validator set, it should begin with the source-only rules.

They provide the best combination of:
- determinism
- cost
- explainability
- package-native value

Render-backed and deck-level rules should come next, once the core issue schema and audit command surface are stable.

## 28. Proposed CLI Command Matrix for the First Audit Surface

Now that the first rule set is clearer, the next step is to define how the CLI should expose those rules.

The goal is not to create one giant overloaded `check` command again.
The goal is to give the agent a small, legible audit vocabulary.

### 28.1 Command-family design goals

The first audit CLI should be:
- narrow in purpose
- consistent in output shape
- composable by the agent
- explicit about scope
- safe to run frequently
- easy to map to hooks later without changing semantics

A command family should answer two questions clearly:
1. what layer of the package is being audited?
2. what scope is being audited?

### 28.2 Recommended first command family

Current recommended first family:
- `presentation audit theme`
- `presentation audit canvas`
- `presentation audit boundaries`
- `presentation audit density`
- `presentation audit deck`
- `presentation audit all`

This keeps the command surface aligned with the issue taxonomy rather than with implementation details.

### 28.3 Rule-to-command matrix

#### `presentation audit theme`
Primary purpose:
- audit theme-language compliance
- audit slide/theme usage of approved visual tokens and modes

Runs by default:
- `theme.raw-value`
- `theme.unapproved-token`
- `theme.illegal-local-override`

May optionally include render-backed checks with a flag such as:
- `--render`

Then additionally runs:
- `theme.rendered-drift`

Default scope:
- current package or requested slide/path subset

Good agent use cases:
- “did this slide invent visual values?”
- “did this local CSS leave the approved theme language?”

#### `presentation audit canvas`
Primary purpose:
- audit canvas/stage structural legality and framework compliance

Runs by default:
- `canvas.illegal-primitive`
- `canvas.forbidden-combination`

Default scope:
- current package or requested slide/path subset

Good agent use cases:
- “did I use an illegal structural primitive?”
- “did this slide break the stage/canvas contract?”

#### `presentation audit boundaries`
Primary purpose:
- audit ownership boundaries between content, theme, canvas, and protected package outputs

Runs by default:
- `boundary.illegal-selector-scope`
- `boundary.authored-source-touches-protected-output`

Could later expand to:
- `boundary.content-overrides-theme`
- `boundary.theme-overrides-canvas`

Default scope:
- current package or requested file/slide subset

Good agent use cases:
- “did this edit cross an ownership boundary?”
- “did slide-local CSS escape its allowed scope?”

#### `presentation audit density`
Primary purpose:
- audit bounded density budgets and overload signals

Runs by default:
- `density.block-budget-exceeded`
- `density.word-budget-exceeded`

Default scope:
- slide or deck subset

Good agent use cases:
- “is this slide overloaded?”
- “did I exceed measurable density limits?”

Important posture:
- this command should stay budget-oriented, not rhetorical

#### `presentation audit deck`
Primary purpose:
- audit deck-level visual/system drift across multiple slides

Runs by default:
- `deck.mode-overuse`
- `deck.exception-overuse`

Default scope:
- whole deck

Good agent use cases:
- “is the deck overusing special emphasis modes?”
- “have too many local exceptions accumulated?”

Important posture:
- initially warning-heavy rather than fail-heavy

#### `presentation audit all`
Primary purpose:
- run the full first-wave audit set using one consistent result envelope

Runs by default:
- all first-wave source rules
- optionally render-backed rules if `--render` is passed
- deck-level rules when the requested scope is a deck/package rather than a single slide

Good agent use cases:
- pre-milestone audit before the agent creates a git commit
- pre-finalize audit
- CI gate

### 28.4 Scope flags and defaults

Recommended common options:
- `--slide <id>`
- `--path <path>`
- `--deck`
- `--format text|json`
- `--severity error|warning|advisory`
- `--strict`
- `--render`

Current recommendation for default behavior:
- if `--slide` is given, audit that slide
- if `--path` is given, audit the package entities affected by that path
- if neither is given for `theme`, `canvas`, `boundaries`, or `density`, audit the current authored package scope
- `deck` defaults to whole-deck scope
- `all` defaults to package/deck scope

### 28.5 Suggested hook-safety model

Because hooks are diagnostic-only for now, some audit commands are naturally hook-safe and others should be more deliberate.

#### Hook-safe by default
Strong candidates:
- `presentation audit theme`
- `presentation audit canvas`
- `presentation audit boundaries`
- `presentation audit density`

Reason:
- primarily source-only
- deterministic
- non-mutating
- useful during active authoring

#### Explicit-only by default
Strong candidates:
- `presentation audit deck`
- `presentation audit all --render`

Reason:
- more expensive
- broader in scope
- more likely to create noise if run constantly
- better suited to deliberate agent milestones and package boundaries

### 28.6 Suggested agent workflow matrix

A likely early workflow:

#### During local slide authoring
Use often:
- `presentation audit theme --slide <id>`
- `presentation audit canvas --slide <id>`
- `presentation audit boundaries --slide <id>`

Use when slide feels crowded:
- `presentation audit density --slide <id>`

#### Before the agent creates a deliberate git milestone
Use:
- `presentation audit all`

Optional if visual drift is suspected:
- `presentation audit all --render`

#### Before finalize
Use:
- `presentation audit all`
- `presentation audit all --render`
- `presentation audit deck`

This keeps expensive checks closer to intentional package boundaries.

### 28.7 Text vs JSON output recommendations

#### Text output
Best for:
- interactive agent sessions
- hook feedback
- quick repair loops

Should emphasize:
- short status line
- issue summaries
- direct correction targets
- inspect-next pointers

#### JSON output
Best for:
- machine integration
- CI
- editor integrations
- future adapter transports

Should preserve the full result envelope and issue objects without lossy flattening.

### 28.8 Example command/result matrix

#### Example A — local slide authoring
Command:
```text
presentation audit theme --slide 014
```

Typical result:
- fast
- source-only
- fail on raw values / illegal overrides
- returns correction target suggestions

#### Example B — structure check during composition
Command:
```text
presentation audit canvas --slide 014
```

Typical result:
- fast
- source-only
- flags illegal primitives or forbidden combinations

#### Example C — pre-milestone package audit
Command:
```text
presentation audit all --format text
```

Typical result:
- aggregates first-wave source rules
- summarizes errors/warnings across affected slides
- suitable before the agent creates a deliberate git milestone or prepares for finalize

#### Example D — pre-finalize stronger audit
Command:
```text
presentation audit all --render --format json
```

Typical result:
- includes render-backed theme drift checks
- machine-readable for stronger gating or reporting

#### Example E — deck coherence pass
Command:
```text
presentation audit deck
```

Typical result:
- warning-heavy deck-level drift report
- highlights mode overuse / exception accumulation

### 28.9 Relationship to the old `check` concept

A major architectural lesson from the current codebase is that `check` became too overloaded.
It collapsed too many questions together:
- source legality
- policy
- runtime correctness
- readiness interpretation
- package status

The proposed audit family is meant to separate those concerns more cleanly.

Current recommendation:
- keep `audit` as the narrow diagnostic/framework-compliance family
- keep readiness/delivery/finalize judgments in separate command families
- do not turn `audit all` back into a semantically overloaded super-command that hides distinct package questions

### 28.10 Current recommendation

If the package gets only a small initial audit CLI, the best first shippable set is probably:
- `presentation audit theme`
- `presentation audit canvas`
- `presentation audit boundaries`
- `presentation audit all`

Then add:
- `presentation audit density`
- `presentation audit deck`
- render-backed variants

This gives the agent a coherent vocabulary early without recreating the current conceptual collapse.

## 29. Proposed Full CLI Taxonomy Beyond Audit (Revised: no Package Checkpoint Family)

Now that the audit family is more concrete, the package needs a fuller command taxonomy so the CLI does not collapse back into ambiguous verbs like `check`.

A major correction emerged in discussion:
- a package-level `checkpoint` concept is likely overkill
- the user does not interact with checkpoints directly
- the main practical value of checkpoints here is agent navigation through history and milestones
- git already provides that very well

So the current recommendation is:
- use a small number of package command families
- give each family one primary semantic job
- do **not** create a separate package checkpoint/memory system
- let agents use native git history/commit/diff operations as their internal milestone and reasoning substrate

### 29.1 Recommended top-level families

A strong first taxonomy would be:
- `presentation inspect ...`
- `presentation status ...`
- `presentation audit ...`
- `presentation finalize ...`
- `presentation export ...`
- `presentation explain ...` (optional but likely valuable)

This separates:
- structural understanding
- current package readiness/delivery state
- framework-compliance diagnostics
- canonical delivery boundary crossing
- direct artifact emission
- deterministic explanation

Important note:
- git history is intentionally **not** modeled here as a package command family
- agents should use native git commands directly for history traversal, diffs, rollback, and incremental understanding

### 29.2 Git as agent-internal substrate, not package semantics

Current strong recommendation:
- git is the durable history lane
- git is the milestone lane
- git is the comparison/rollback lane
- but git milestones should remain an agent/internal execution concern, not a first-class package noun

Reason:
- agents are already good at traversing git history
- git history gives agents a code-evolution narrative, not just a static snapshot
- creating a separate package checkpoint abstraction would duplicate that value and split the history model unnecessarily

So the package should not invent:
- a parallel checkpoint database
- a separate trusted-memory lane outside git
- a user-facing package checkpoint lifecycle

### 29.3 `presentation inspect ...`

Primary purpose:
- answer “what is here?”
- expose package structure without making judgments when possible

Typical subcommands:
- `presentation inspect package`
- `presentation inspect slides`
- `presentation inspect slide --slide <id>`
- `presentation inspect theme`
- `presentation inspect canvas`
- `presentation inspect artifacts`
- `presentation inspect evidence`
- `presentation inspect boundaries`

Questions this family should answer:
- what authored entities exist?
- what generated/evidence artifacts exist?
- what theme/canvas is active?
- what ownership boundaries apply?
- what files or slides are in scope for a given path?

Output posture:
- descriptive
- inventory-oriented
- low judgment unless the requested object cannot be understood structurally

Why this family matters:
- the agent often first needs orientation, not validation
- keeping `inspect` separate reduces pressure on `status` and `audit` to double as inventory tools

### 29.4 `presentation status ...`

Primary purpose:
- answer “where does the package stand right now?”
- provide package-state judgments that are broader than an audit finding

Typical subcommands:
- `presentation status`
- `presentation status slide --slide <id>`
- `presentation status package`
- `presentation status readiness`
- `presentation status finalize`

Questions this family should answer:
- is the package onboarding, authoring, blocked, ready for finalize, or finalized?
- are evidence/artifacts fresh relative to current source?
- do finalized outputs still correspond to current source?
- what major blockers currently matter most?

Output posture:
- summarized judgment
- package-state oriented
- may incorporate information from audit/evidence layers without rerunning everything implicitly

Important distinction:
- `status` is not a raw validator family
- it is a package-state interpretation family

### 29.5 `presentation audit ...`

Primary purpose:
- answer “what framework/policy/runtime drift is present?”
- run narrow deterministic checks and return structured findings

This family is now defined in the previous section and should remain:
- diagnostic-only
- non-mutating
- explicit in scope

Important distinction:
- `audit` should not become synonymous with “overall package status”
- it is one input into broader package understanding, not the whole story

### 29.6 `presentation finalize ...`

Primary purpose:
- cross the canonical package delivery boundary
- produce official package outputs and update the package’s delivery state

Typical subcommands:
- `presentation finalize`
- `presentation finalize --strict`
- `presentation finalize status`
- `presentation finalize explain-blockers`

Questions/actions this family should cover:
- is the package ready to finalize?
- if not, what delivery-boundary blockers remain?
- produce canonical review/delivery outputs
- update package finalize state deterministically

Important distinction:
- `finalize` is the canonical package handoff boundary
- it is not the same as arbitrary export

### 29.7 `presentation export ...`

Primary purpose:
- emit artifacts directly without necessarily crossing the package’s canonical delivery boundary

Typical subcommands:
- `presentation export pdf`
- `presentation export screenshots`
- `presentation export notes`
- `presentation export bundle`

Questions/actions this family should cover:
- produce specific artifacts on demand
- allow exploratory or ad hoc output generation
- avoid conflating every artifact-generation act with formal package finalization

Important distinction:
- `export` is artifact emission
- `finalize` is package delivery-state transition

### 29.8 `presentation explain ...` (optional but likely valuable)

Primary purpose:
- deterministically explain package concepts, issue codes, blocker states, and boundaries

Typical subcommands:
- `presentation explain issue <code>`
- `presentation explain boundary <boundary-id>`
- `presentation explain status <status-id>`
- `presentation explain finalize-blockers`

Why this may be valuable:
- it gives the agent a stable semantic help surface
- it reuses deterministic explanation definitions already discussed earlier in this document
- it keeps explanation separate from state mutation

This family is optional because:
- some of its value can be embedded into `audit` and `status`
- but a separate explanation family may improve discoverability and consistency

### 29.9 Recommended semantic split across families

A simple working model:

#### `inspect`
- inventory and structure
- “what exists?”

#### `status`
- package-state interpretation
- “where do we stand?”

#### `audit`
- deterministic diagnostics
- “what is wrong or drifting?”

#### `finalize`
- canonical delivery boundary
- “is this ready to become an official package delivery?”

#### `export`
- direct artifact emission
- “produce this output now”

#### `explain`
- deterministic conceptual help
- “what does this package concept or issue mean?”

#### native `git`
- internal agent history/milestones/diffs
- “how did we get here, what changed, and what should we compare against?”

This split is likely the cleanest way to avoid semantic collapse.

### 29.10 Example agent workflows across families

#### Early authoring loop
- `presentation inspect slide --slide 014`
- `presentation audit theme --slide 014`
- `presentation audit canvas --slide 014`
- `presentation audit boundaries --slide 014`
- `presentation status slide --slide 014`
- native git inspection when useful (`git log`, `git diff`, `git show`)

#### Before the agent creates an internal git milestone
- `presentation audit all`
- `presentation status`
- optional native git commit if the agent wants a clean history/milestone boundary

#### Before final delivery
- `presentation audit all`
- `presentation audit all --render`
- `presentation audit deck`
- `presentation status finalize`
- `presentation finalize`

#### When ad hoc artifacts are needed without full delivery transition
- `presentation export pdf`
- `presentation export screenshots`

### 29.11 Hook-safe vs explicit-only family guidance

#### Hook-safe by default
Best candidates:
- `presentation inspect ...`
- `presentation audit theme`
- `presentation audit canvas`
- `presentation audit boundaries`
- `presentation audit density`
- selected lightweight `presentation status ...` calls

Reason:
- descriptive or diagnostic only
- non-mutating
- cheap enough for frequent use

#### Explicit-only by default
Best candidates:
- `presentation finalize ...`
- `presentation export ...`
- `presentation audit deck`
- render-backed `presentation audit ... --render`

Reason:
- broader, more expensive, or state-committing
- riskier to run automatically
- better aligned with deliberate agent intent

### 29.12 Recommendation on naming discipline

Current strong recommendation:
- do not reintroduce `check` as the main umbrella verb
- do not introduce a package `checkpoint` family unless it gains a clear package meaning beyond git
- reserve verbs for distinct semantic jobs
- prefer one clear family name over overloaded convenience

If a compatibility alias must exist later, it should be a thin wrapper that maps to one or more explicit families, not the conceptual center of the architecture.

### 29.13 Current recommendation

The package’s coherent terminal-first operational language is probably:
- `inspect` for orientation
- `status` for interpreted package state
- `audit` for deterministic diagnostics
- `finalize` for canonical delivery
- `export` for direct artifact emission
- optionally `explain` for deterministic semantic help

Alongside that, agents should use native git as their internal history/milestone substrate.

This feels cleaner than modeling checkpoints as first-class package state.

## 30. Proposed Package State Machine and Status Vocabulary (Revised: no Checkpoint State)

Now that the CLI families are clearer, the package also needs a better status model.

The current code already hints at coarse states such as:
- `onboarding`
- `in_progress`
- `policy_error`
- `ready_to_finalize`
- `finalized`

A major correction from later discussion:
- the package probably does **not** need checkpoint as a first-class state boundary
- git already gives agents the milestone/history lane they need
- the user does not directly manage checkpoints as a product concept

So the package status model should focus on what the package itself owns:
- workflow readiness
- hard blockers
- evidence freshness
- delivery/finalize state

### 30.1 Design principle: status should be derived, not magical

Current strong recommendation:
- package status should be a derived summary over richer facts
- not an opaque stored enum that tries to be the entire truth model

Those richer facts include at least:
- source completeness/structure
- hard audit/policy blockers
- runtime/evidence freshness
- finalize/delivery state

So the package should likely expose:
- a **primary workflow state**
- plus **secondary status facets** such as evidence freshness and delivery state

This avoids forcing one word like `blocked` or `finalized` to carry too much meaning.

### 30.2 Recommended primary workflow states

A useful first primary workflow vocabulary is:
- `onboarding`
- `authoring`
- `blocked`
- `ready_for_finalize`
- `finalized`

These should be interpreted as follows.

#### `onboarding`
Meaning:
- the package does not yet have enough authored structure to participate in the normal workflow

Typical conditions:
- required source artifacts missing
- package identity or layout incomplete
- no meaningful slide/theme structure yet

#### `authoring`
Meaning:
- the package is actively being developed
- no delivery boundary has yet been reached

Typical conditions:
- authored structure exists
- current source is intelligible enough to work on
- no hard blocker is currently dominant
- not yet finalize-ready

This is the preferred replacement for the old coarse idea of `in_progress`.

#### `blocked`
Meaning:
- one or more hard blockers currently prevent normal forward progress toward finalize or reliable package use

Typical blocker families:
- structural errors
- hard ownership/policy violations
- severe runtime/render failures
- missing required prerequisites for the requested boundary

Important note:
- `blocked` should be reserved for meaningful hard blockers
- not every warning should push the package into `blocked`

#### `ready_for_finalize`
Meaning:
- the package is ready to cross the canonical delivery boundary

Typical conditions:
- no hard blockers
- finalize prerequisites satisfied
- required evidence/artifacts are current enough
- any package-defined pre-finalize audits have passed at the required severity level

Important note:
- this is about official delivery readiness, not agent-internal git milestones

#### `finalized`
Meaning:
- canonical delivery outputs exist and correspond to the current package state

Typical conditions:
- finalize command completed successfully
- official package outputs exist
- no authored-source divergence has occurred since finalize

Important note:
- if authored source changes afterward, the package should no longer remain simply `finalized`
- it should fall back to `authoring` plus stale delivery indicators

### 30.3 Recommended secondary status facets

To avoid overloading the primary workflow state, the package should also expose secondary facets.

#### Freshness facet
Suggested values:
- `current`
- `stale`
- `unknown`
- `missing`

Applied to:
- evidence
- finalized outputs

#### Delivery facet
Suggested values:
- `not_finalized`
- `finalized_current`
- `finalized_stale`
- `finalize_blocked`

Meaning:
- what is the current state of the package’s canonical delivery boundary?

#### Evidence facet
Suggested values:
- `current`
- `stale`
- `missing`
- `unsupported`

Meaning:
- are the package’s deterministic runtime/validation observations current enough to trust for the requested decision?

Important note:
- git cleanliness/history/milestones may matter to the agent operationally, but they should not be treated as package status facets unless the package truly needs them as product semantics

### 30.4 Why `stale` should usually be a modifier, not the whole state

A strong recommendation from this architecture direction:
- `stale` should usually not replace the primary workflow state
- it should modify evidence or delivery facets instead

Examples:
- primary state: `authoring`
  - delivery facet: `finalized_stale`
- primary state: `ready_for_finalize`
  - evidence facet: `current`
- primary state: `blocked`
  - evidence facet: `missing`

This is clearer than making `stale` a standalone top-level package state with ambiguous meaning.

### 30.5 Suggested status object shape

A working conceptual shape:

```json
{
  "workflow": "authoring",
  "summary": "Authoring in progress; current source has no hard blockers, but finalized outputs are stale relative to source.",
  "blockers": [],
  "facets": {
    "delivery": "finalized_stale",
    "evidence": "current"
  },
  "nextBoundary": "finalize",
  "nextFocus": [
    "presentation audit all",
    "presentation status finalize"
  ]
}
```

This keeps the package state:
- explainable
- compositional
- not trapped in a single overloaded enum

### 30.6 State-transition guidance by command family

#### `inspect`
Effect on state:
- observes only
- no state changes

#### `status`
Effect on state:
- observes/derives only
- no state changes

#### `audit`
Effect on state:
- observes/derives only
- no durable state changes
- may influence what `status` reports if `status` recomputes from current facts

#### `finalize`
Effect on state:
- may advance delivery state
- main transition into `finalized`

#### `export`
Effect on state:
- should not necessarily change canonical package delivery state
- may produce artifacts without making the package `finalized`

#### `explain`
Effect on state:
- observes only
- no state changes

Important note:
- native git operations may matter to the agent’s internal workflow, but they should not be treated as package-state transitions unless the package explicitly chooses to model them later

### 30.7 Suggested primary transitions

A useful first transition model:

#### `onboarding -> authoring`
When:
- minimum authored package structure becomes valid

#### `authoring -> blocked`
When:
- hard blockers appear

#### `blocked -> authoring`
When:
- hard blockers are cleared but finalize readiness is not yet achieved

#### `authoring -> ready_for_finalize`
When:
- finalize-level prerequisites are satisfied
- no hard blockers remain
- evidence/delivery preconditions are current enough

#### `ready_for_finalize -> finalized`
When:
- `presentation finalize` succeeds

#### `finalized -> authoring`
When:
- authored source changes after finalize

Important modifier update at the same time:
- delivery facet becomes `finalized_stale` until a new finalize occurs

### 30.8 How `status` commands should present this model

Suggested outputs:

#### `presentation status`
Should summarize:
- primary workflow state
- major blockers
- delivery facet
- evidence freshness
- next likely boundary

#### `presentation status finalize`
Should focus on:
- whether finalize is currently allowed
- what delivery blockers remain
- whether existing finalized outputs are current or stale

#### `presentation status slide --slide <id>`
Should focus on:
- local blockers/warnings
- slide-level freshness where relevant
- whether the slide contributes to package blockage

### 30.9 Recommended naming discipline for states

Current recommendation:
- prefer `authoring` over `in_progress`
  - more package-native and less vague
- prefer `ready_for_finalize`
  - explicit about the real package boundary that matters
- keep `stale` as a facet/modifier where possible
- avoid package states that merely mirror agent-internal git milestones

This produces a status vocabulary that reads more like package operations and less like generic workflow software.

### 30.10 Current recommendation

The strongest current status model is:
- a small primary workflow-state vocabulary
- plus secondary facets for delivery and evidence freshness
- with explicit command families controlling which package transitions are allowed

This matches the rest of the architecture well because it preserves the distinction between:
- observing state
- diagnosing problems
- crossing the delivery boundary
- and leaving agent-internal git milestones outside the package’s core semantics

## 31. Package Constitution Spec (First Implementation-Grade Cut)

Now that the command model, audit model, and state model are clearer, the next missing piece is the package constitution itself.

This section is the first implementation-grade cut at answering:
- what the package actually is on disk
- how it should be split into folders
- which files belong to which ownership class
- which boundaries must remain MECE so agents can reason safely

### 31.1 Current-code observations that matter

After re-checking the current code:
- `framework/runtime/deck-paths.js` now models `.presentation/project.json`, `.presentation/intent.json`, `.presentation/package.generated.json`, `.presentation/runtime/render-state.json`, and `.presentation/runtime/artifacts.json` as the core package files, and it splits delivery paths into `outputs/finalized/` and `outputs/exports/`
- `framework/runtime/presentation-package.js` treats `intent.json` as authored intent and `package.generated.json` as deterministic generated structure
- `framework/runtime/presentation-runtime-state.js` now manages `render-state.json` and `artifacts.json` only
- `framework/runtime/project-state.js` now derives workflow meaning through the dedicated status-service workflow/facet model
- `framework/runtime/presentation-cli.mjs` exposes the rebuilt command families: `inspect`, `status`, `audit`, `finalize`, and `export`
- `docs/presentation-package-spec.md` is intended to match this rebuilt package model directly

So the current codebase now has the right package nouns in place, but this constitution spec still matters because it keeps the ownership boundaries explicit between:
- package evidence
- delivery outputs
- agent history/milestones
- adapter/framework scaffolding

This constitution spec is meant to keep those concerns unblurred.

### 31.2 MECE boundary rule

A core design requirement for the rebuilt package:

> Every package file should belong to exactly one ownership zone.

That means a file should not be simultaneously treated as:
- authored truth
- generated structure
- runtime evidence
- deliverable output
- agent adapter state
- git history

This is important because agents need clean boundaries.
If folder meaning overlaps, agents will:
- edit protected files accidentally
- misread stale evidence as source truth
- confuse delivery outputs with authorable inputs
- blur internal git workflow with package semantics

### 31.3 Recommended top-level ownership zones

Current recommendation is to split the project into these zones.

#### Zone A — Authored presentation source
Purpose:
- the actual presentation source the agent authors

Contents:
- `brief.md`
- `theme.css`
- `outline.md` when required
- `slides/`
- root `assets/`
- slide-local `assets/`

Owner:
- human/agent authoring

#### Zone B — Authored structured intent
Purpose:
- structured semantic intent that cannot be reliably inferred from file layout alone

Contents:
- `.presentation/intent.json`

Owner:
- human/agent authoring

Important boundary:
- intent is not structural truth
- it may guide audits/status/explanations, but it should not define slide identity/order/package structure

#### Zone C — Deterministic generated package structure
Purpose:
- normalized structural view derived from authored source

Contents:
- `.presentation/package.generated.json`

Owner:
- deterministic package compiler only

Important boundary:
- this file is derived from source
- it is not directly authorable

#### Zone D — Deterministic runtime evidence
Purpose:
- remembered observations about package validation/render/output state

Contents:
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- future runtime/evidence files if added

Owner:
- deterministic package runtime/audit/finalize/export operations

Important boundary:
- evidence is remembered observation, not authored truth
- evidence may become stale relative to current source

#### Zone E — Deliverable outputs
Purpose:
- produced artifacts intended for review, export, or delivery

Contents:
- `outputs/`

Owner:
- explicit `finalize` or `export` operations

Important boundary:
- outputs are not source
- outputs are not package evidence, even if evidence may reference them

#### Zone F — Package identity/configuration
Purpose:
- stable package identity and protected configuration

Contents:
- `.presentation/project.json`

Owner:
- system/scaffold/runtime

Important boundary:
- this is boring, stable package identity/configuration
- it should not become an authoring scratchpad

#### Zone G — Agent adapter scaffolding (adjacent, not core package truth)
Purpose:
- vendor/tool-specific agent integration

Contents today may include:
- `.claude/`
- `AGENTS.md`
- any future agent-specific scaffold package

Owner:
- scaffold/framework tooling

Important boundary:
- this is adjacent to the package, but not the package’s core authored/generated/evidence/output truth model
- the core must not depend on one adapter’s presence

#### Zone H — Git history substrate (external to package semantics)
Purpose:
- history
- milestones
- diff/comparison
- rollback/navigation for agents

Contents:
- `.git/`

Owner:
- git / agent workflow

Important boundary:
- git is crucial operationally, but it is not a package-owned folder class inside the package constitution

### 31.4 Recommended canonical folder structure

Current recommended target layout:

```text
<project-root>/
  brief.md
  theme.css
  outline.md                      # optional; may become required by policy

  slides/
    010-intro/
      slide.html
      slide.css                   # optional
      assets/                     # optional
    020-problem/
      slide.html
      slide.css                   # optional
      assets/                     # optional

  assets/                         # shared authored assets

  outputs/
    finalized/                    # canonical delivery outputs
      deck.pdf
      report.json
      summary.md
      slides/
        010-intro.png
        020-problem.png
    exports/                      # ad hoc or direct export outputs
      <export-run-id>/
        ...

  .presentation/
    project.json                  # stable package identity/config
    intent.json                   # authored structured intent
    package.generated.json        # deterministic structural manifest
    runtime/
      render-state.json           # latest remembered render/audit evidence
      artifacts.json              # latest remembered artifact inventory

  .claude/                        # agent-adapter scaffold, not core package truth
  AGENTS.md                       # agent-adapter scaffold, not core package truth
  .git/                           # git history substrate
```

Important note:
- this is the recommended target constitution for the rebuild
- it intentionally drops `.presentation/runtime/last-good.json` from the core package model
- git should carry agent milestones/history instead of a parallel package checkpoint file

### 31.5 Folder-by-folder meaning

#### Root authored files
These should stay extremely legible.

Recommended meaning:
- `brief.md` = authored brief / request normalization / presentation purpose
- `theme.css` = authored deck-wide theme layer
- `outline.md` = authored long-deck narrative plan when required by policy

These are authored truth files.
They should remain editable.

#### `slides/`
This is the main authored slide corpus.

Recommended meaning:
- each valid slide directory is one authored slide source unit
- `slide.html` is required authored source
- `slide.css` is optional authored local styling
- `assets/` is optional slide-local authored asset scope

Recommended invariant:
- slide identity derives from folder naming + deterministic compiler rules
- not from `.presentation/intent.json`

#### `assets/`
Recommended meaning:
- shared authored asset scope available to the package

Boundary:
- shared assets live here
- slide-local assets live under each slide directory
- generated outputs must not be written here

#### `outputs/`
Recommended meaning:
- only produced artifacts live here
- nothing in this tree is authorable source

Recommended sub-split:
- `outputs/finalized/` = canonical delivery outputs corresponding to the package’s finalize boundary
- `outputs/exports/` = ad hoc/direct export outputs

This split is important because it makes `finalize` vs `export` visible in the file system itself.

#### `.presentation/`
Recommended meaning:
- package-owned internal package state and deterministic companions
- not creative authored slide source

This folder should itself stay internally MECE.

Recommended sub-split:
- `project.json` = stable identity/config
- `intent.json` = authored structured intent
- `package.generated.json` = deterministic structural manifest
- `runtime/` = remembered evidence only

This is much cleaner than mixing identity, intent, structure, evidence, outputs, and git-like trust state together.

### 31.6 File-level ownership matrix

#### Agent/human authorable
- `brief.md`
- `theme.css`
- `outline.md` when applicable
- `slides/**/slide.html`
- `slides/**/slide.css`
- `assets/**`
- `slides/**/assets/**`
- `.presentation/intent.json`

#### System-generated, readable but not directly authorable
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`

#### System-owned, stable/protected config
- `.presentation/project.json`

#### Explicit output-producing only
- `outputs/finalized/**`
- `outputs/exports/**`

#### Adapter-owned / adjacent
- `.claude/**`
- `AGENTS.md`

#### Agent-internal history substrate
- `.git/**`

### 31.7 Recommended removals or reclassifications from the current code

The current code implies some older concepts that should be revised during the rehaul.

#### `.presentation/runtime/last-good.json`
Recommendation:
- remove from the core package constitution

Reason:
- this was carrying checkpoint/trust-state meaning that is better handled by git for agent workflow
- if some evidence summary still needs to exist, it should be folded into normal evidence/delivery records rather than preserved as a separate trust lane

#### `historyPolicy: "checkpointed"` in `project.json`
Recommendation:
- remove or replace with a simpler statement that git is the history substrate

Reason:
- package config should not imply a separate package checkpoint system if that is no longer part of the architecture

#### `.presentation/framework-cli.mjs` and `.presentation/framework/`
Recommendation:
- treat as framework-distribution or adapter/scaffold implementation details, not package-core truth
- if they remain physically present in some scaffolds, classify them outside the authored/generated/evidence/output core model

Reason:
- they are operational support files, not central package nouns

### 31.8 Minimal valid package shape

A package should be considered minimally structurally valid when it has at least:
- `brief.md`
- `theme.css`
- `slides/`
- at least one valid slide directory containing `slide.html`
- `.presentation/project.json`
- `.presentation/intent.json`

A package may still be incomplete for workflow reasons even when structurally valid.
For example:
- `outline.md` may be required later by policy
- authored source may still contain TODO markers
- audits may still fail

So minimal validity is not the same as readiness.

### 31.9 Boundary rules agents should be able to learn immediately

The MECE boundary model should teach agents a few simple rules:

1. **Edit authored source and authored intent.**
2. **Read generated structure; do not hand-edit it.**
3. **Read runtime evidence as remembered observation, not current truth unless freshness says current.**
4. **Treat outputs as products, not inputs.**
5. **Treat adapter scaffolding as adjacent tooling, not package core truth.**
6. **Use git for internal history and milestones, not package-owned checkpoint files.**

If an agent can internalize those six rules, a lot of accidental boundary-crossing disappears.

### 31.10 Why this constitution is better than the current one

This revised constitution is stronger because it makes the package folder layout itself express the architecture.

It separates:
- authored truth
- authored intent
- generated structure
- remembered evidence
- produced outputs
- adapter scaffolding
- git history

That is exactly the kind of MECE boundary system agents need.

### 31.11 Current recommendation

Before the core rehaul starts, this package constitution should be treated as one of the required implementation-grade specs.

It gives the rewrite a concrete answer for:
- what belongs where
- what each folder means
- what the agent may edit
- what the runtime may write
- what should be removed from the older checkpointed model

## 32. Structural Compiler Spec (First Implementation-Grade Cut)

Now that the package constitution is clearer, the next implementation-grade spec is the structural compiler.

This section answers:
- how the package derives normalized structure from authored files
- what the canonical structural manifest should contain
- what counts as structural validity vs policy validity
- how this should stay MECE so agents can reason without guessing

### 32.1 Current-code observations that matter

After checking the current code:
- `framework/runtime/deck-source.js` currently derives slide entries from `slides/` directory names using `^(\d{3})-([a-z0-9-]+)$`
- each slide entry currently derives:
  - `orderLabel`
  - `orderValue`
  - `slideId`
  - paths for `slide.html`, optional `slide.css`, and optional `assets/`
- `framework/runtime/presentation-package.js` currently writes `.presentation/package.generated.json` from source and uses slide-entry validity to decide what enters the manifest
- `framework/runtime/deck-policy.js` currently enforces many structural rules separately from manifest generation
- this means the current system already has a split between:
  - structural derivation
  - structural/policy validation

That split is correct in principle and should be made clearer in the rehaul.

### 32.2 Compiler purpose

The structural compiler should do one thing well:

> deterministically turn authored package source into a normalized structural package model.

It should not:
- invent missing authored meaning
- silently fix invalid authored structure
- perform runtime/render judgment
- decide creative narrative structure
- absorb git milestone/history semantics

Its job is narrower:
- discover authored structural units
- normalize them into canonical package entities
- expose enough metadata for audits/status/finalize to work reliably

### 32.3 Structural compiler inputs

The compiler should read only package-authorable structural inputs and stable package identity/config inputs.

Primary inputs:
- `brief.md`
- `theme.css`
- `outline.md` when present
- `slides/`
- `assets/`
- `.presentation/project.json`
- `.presentation/intent.json` as optional semantic side-input

Important boundary:
- `.presentation/intent.json` may enrich meaning, but must not override structural truth such as slide existence, slide id, or ordering

The compiler should not require as inputs:
- runtime evidence files
- outputs
- adapter scaffolding
- git history

### 32.4 Structural compiler outputs

Primary output:
- `.presentation/package.generated.json`

The compiler may also return an in-memory structural result object for commands such as:
- `inspect`
- `audit`
- `status`
- `finalize`

But the canonical durable generated structure should be the manifest file.

### 32.5 Structural truth model

The structural compiler should define a small number of canonical structural truths.

#### Package-level truths
- project slug
- project title
- brief presence/completeness status
- outline presence/requirement/completeness status
- theme presence status
- shared asset-root presence status
- slide inventory
- slide count

#### Slide-level truths
For each structurally valid slide entity:
- stable slide id
- order label
- order value
- owning source directory
- HTML source path
- CSS source path if present
- slide-local assets directory path if present

Important boundary:
- the structural compiler should describe what exists and how it normalizes
- it should not collapse structural truth into workflow readiness or policy severity

### 32.6 Slide directory derivation rules

Current recommended canonical rule:
- a valid slide directory name must match:
  - `NNN-slug`
  - where `NNN` is exactly three digits
  - and `slug` is lowercase alphanumeric plus hyphen

Current derived fields:
- `orderLabel` = the three-digit prefix string
- `orderValue` = integer parse of `orderLabel`
- `slideId` = slug portion after the prefix

Example:
- `010-intro`
  - `orderLabel: "010"`
  - `orderValue: 10`
  - `slideId: "intro"`

Important recommendation:
- keep slide id derivation deterministic from directory naming
- do not let intent files redefine slide ids

### 32.7 Structural inclusion and exclusion rules

The compiler should make an explicit distinction between:
- **discoverable entries**
- **structurally valid slide entities**
- **invalid structural entries**

#### Discoverable entries
All directories immediately under `slides/`.

#### Structurally valid slide entities
Directories that:
- match the slide naming pattern
- are eligible to become normalized slide entities

#### Invalid structural entries
Directories under `slides/` that do not match the naming contract.

Important recommendation:
- invalid entries should still be surfaced in structural diagnostics
- but they should not silently become slide entities in the canonical manifest

This matches the current code tendency to filter invalid names out of the final manifest while leaving validation to report the error.

### 32.8 Required and optional members of a slide source unit

For each valid slide directory:

#### Required
- `slide.html`

#### Optional
- `slide.css`
- `assets/`

#### Forbidden or invalid extras
Any unexpected entries should be reported by structural/policy validation rather than normalized into the slide entity.

Important MECE rule:
- a slide directory should remain a tightly bounded authored source unit
- not a grab-bag for arbitrary side files

### 32.9 Structural compiler vs structural validator

A crucial boundary for the rebuild:

#### Compiler
Responsible for:
- discovery
- normalization
- canonical structure projection

#### Structural validator
Responsible for:
- missing required files
- malformed directory names
- duplicate ordering problems
- duplicate slide identity problems
- illegal extra entries
- required outline enforcement

This keeps the system MECE:
- the compiler says what the structure is
- the validator says what is wrong with it

### 32.10 Canonical manifest shape (recommended)

The manifest should stay compact, deterministic, and boring.

A recommended first implementation-grade shape:

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
      "hasCss": true,
      "assetsDir": "slides/010-intro/assets",
      "hasAssetsDir": false
    }
  ],
  "counts": {
    "slidesTotal": 1
  }
}
```

Important recommendation:
- keep workflow state out of the structural manifest
- keep runtime evidence out of the structural manifest
- keep outputs out of the structural manifest except perhaps stable output roots if absolutely necessary

The manifest should remain structural.

### 32.11 Recommended manifest fields to keep out

To preserve MECE boundaries, the structural manifest should not directly own:
- runtime pass/fail results
- freshness state
- finalize/export status
- artifact inventory details
- git commit or milestone info
- narrative judgments
- package-wide delivery readiness summaries

Those belong elsewhere:
- evidence
- status derivation
- delivery state
- git

### 32.12 Outline requirement rule

Current code already implies:
- outline becomes required when slide count exceeds `LONG_DECK_OUTLINE_THRESHOLD`

Current recommendation:
- keep the requirement as policy/validation logic
- allow the structural manifest to report `required: true|false` for `outline`
- but do not let the compiler itself turn missing outline into a malformed structure exception

This is another good MECE split:
- compiler reports the normalized fact
- validator interprets the requirement

### 32.13 Completeness flags in the structural manifest

A subtle but important design choice:
- the current code includes `complete` flags for `brief` and `outline`

Recommendation:
- keep basic completeness booleans for top-level source artifacts where they are deterministic and cheap
- do not let these completeness booleans balloon into full workflow-state logic

Good examples:
- brief exists / complete
- outline exists / required / complete
- theme exists

Risky examples to avoid here:
- slide is "ready"
- deck is "good"
- package is "finalizable"

Those are higher-layer judgments, not structural facts.

### 32.14 Structural error families the validator should consume

The structural validator layer should likely define issue families such as:
- invalid slide directory name
- duplicate `orderValue`
- duplicate derived `slideId`
- missing `slide.html`
- illegal extra slide entry
- missing `slides/` root
- missing required top-level authored file
- required outline absent for long deck

These should be structurally derived and validator-reported, but not patched silently by the compiler.

### 32.15 Intent-file relationship to structure

`.presentation/intent.json` should be allowed to reference structural entities, but not define them.

Recommended rule:
- intent may annotate known slide ids
- intent may not create unknown slide ids
- intent may not rename slide ids
- intent may not reorder slides
- intent may not substitute for missing authored slide source

So the dependency direction should be:
- structure -> constrains valid intent references
not:
- intent -> defines structure

This matches the current `validatePresentationIntent(...)` behavior and should remain a stable contract.

### 32.16 Structural compiler operating modes

A useful implementation distinction:

#### Compute mode
- derive structure in memory from current source
- return result plus structural diagnostics
- do not persist the manifest unless explicitly requested

#### Record mode
- derive structure in memory from current source
- write `.presentation/package.generated.json`
- only write if content changed

This maps well to the newer command model:
- `inspect` may rely on compute mode
- explicit regeneration paths may rely on record mode

### 32.17 Source fingerprints and structural fingerprints

The compiler should eventually expose enough identity for freshness reasoning, but should avoid bloating the manifest prematurely.

Recommendation:
- do not add heavyweight runtime-style fingerprints to the manifest unless they are truly needed
- if needed later, add a small deterministic source fingerprint at the package level
- do not mix runtime evidence fingerprints into the structural compiler output

This keeps the structural compiler narrow.

### 32.18 Why this compiler spec is MECE-friendly for agents

Agents work better when the file system and derived structures mean one thing each.

This compiler spec helps because it makes clear that:
- slide folders define slide identity
- the manifest mirrors normalized structure
- intent annotates structure but does not define it
- validation flags structure problems without redefining structure
- runtime evidence and delivery outputs live elsewhere

That is the kind of boundary clarity agents can reliably learn.

### 32.19 Current recommendation

Before the core rehaul begins, the structural compiler should be treated as a separate implementation unit with its own contract:
- inputs
- derivation rules
- canonical manifest shape
- record vs compute behavior
- clear boundary from validators and evidence

That is likely necessary to prevent the new core from collapsing structure, validation, runtime evidence, and workflow state back into one blurry layer.

## 33. Evidence + Delivery Spec (First Implementation-Grade Cut)

Now that the package constitution and structural compiler are clearer, the next missing implementation-grade spec is evidence and delivery.

This section answers:
- what remembered evidence the package should own
- what `finalize` should write
- what `export` should write
- how freshness should be computed
- how to keep evidence, outputs, and git history MECE

### 33.1 Current-code observations that matter

After checking the current runtime/export/finalize code:
- `validatePresentation(...)` writes `.presentation/runtime/render-state.json`
- `exportDeckPdf(...)` and `exportPresentation(...)` update `.presentation/runtime/artifacts.json` for latest export inventory
- `finalizePresentation(...)` now:
  - clears `outputs/finalized/`
  - runs capture into `outputs/finalized/`
  - exports the canonical PDF into `outputs/finalized/deck.pdf`
  - writes `outputs/finalized/report.json` and `outputs/finalized/summary.md`
  - refreshes `artifacts.json`
  - refreshes `render-state.json`
- `presentation-runtime-state.js` now treats `render-state.json` and `artifacts.json` as the runtime evidence set
- `deck-paths.js` now models delivery outputs as two explicit areas:
  - `outputs/finalized/`
  - `outputs/exports/`

This means the rebuilt core now cleanly separates:
- remembered evidence
- canonical delivery outputs
- ad hoc export tracking
- git-backed agent history

That separation is the intended evidence/delivery model.

### 33.2 Core distinction: evidence vs outputs vs git

A hard MECE boundary for the rebuilt core:

#### Evidence
- remembered observations about package state
- may become stale
- lives in `.presentation/runtime/`

#### Outputs
- produced artifacts intended for review/export/delivery
- live in `outputs/`
- are not themselves the evidence layer, even if evidence points to them

#### Git
- history/milestones/diffs for the agent
- not package evidence
- not package delivery state

This distinction is critical because agents otherwise confuse:
- “this file exists”
with
- “this is the current truth”
with
- “this is the trusted baseline”

### 33.3 Recommended evidence files

Current recommended package-owned evidence files:

#### `.presentation/runtime/render-state.json`
Purpose:
- remembered result of the latest explicit render/audit/finalize-style runtime judgment

Recommended contents:
- schema version
- evidence kind
- source fingerprint or equivalent source identity
- generated-at timestamp
- status
- slide ids inspected
- canvas contract result
- console error count
- overflow slide ids
- issue/failure summary
- how the judgment was produced (`audit-render`, `finalize`, etc.)

Important boundary:
- this is remembered runtime judgment
- not official delivery state
- not structural truth

#### `.presentation/runtime/artifacts.json`
Purpose:
- remembered inventory of the latest package-known output artifacts

Recommended contents:
- schema version
- source fingerprint or equivalent source identity
- generated-at timestamp
- artifact inventory grouped by delivery/export kind
- canonical finalized outputs if present
- latest ad hoc export outputs if remembered

Important boundary:
- this is inventory/evidence about outputs
- not the output files themselves

### 33.4 Recommended removal: `.presentation/runtime/last-good.json`

Recommendation:
- remove from the rebuilt core package model

Reason:
- it carries old checkpoint/trust semantics
- git already provides the agent’s milestone/history substrate
- package evidence should describe remembered observations and outputs, not maintain a parallel trust lane

If some useful fields from `last-good.json` survive, they should be folded into:
- `render-state.json`
- `artifacts.json`
- or derived delivery status

but not preserved as a separate file with checkpoint meaning.

### 33.5 Recommended output tree split

To make `finalize` vs `export` MECE in the file system, the output tree should be explicit.

Recommended target shape:

```text
outputs/
  finalized/
    deck.pdf
    report.json
    summary.md
    full-page.png
    slides/
      010-intro.png
      020-problem.png

  exports/
    <export-run-id>/
      pdf/
        selected-slides.pdf
      png/
        010-intro.png
        020-problem.png
```

Important recommendation:
- `finalized/` is the canonical delivery boundary
- `exports/` is direct artifact emission
- the two should not overwrite each other silently

This is a stronger filesystem expression of package semantics than the current flat `outputs/` tree.

### 33.6 `finalize` contract

`finalize` should mean:
- cross the canonical package delivery boundary
- produce the official deliverable artifact set
- refresh package evidence to reflect that finalize run

Recommended canonical finalized outputs:
- `outputs/finalized/deck.pdf`
- `outputs/finalized/report.json`
- `outputs/finalized/summary.md`
- `outputs/finalized/full-page.png`
- `outputs/finalized/slides/*.png`

Recommended `finalize` side effects:
- refresh `render-state.json`
- refresh `artifacts.json`
- update derived delivery state

Recommended `finalize` non-goals:
- do not create a separate package checkpoint/trust record
- do not encode git milestone semantics into package evidence

### 33.7 `export` contract

`export` should mean:
- emit requested artifacts directly
- do not by itself cross the canonical package delivery boundary

Examples:
- export selected slides as PDF
- export selected slides as PNG
- export non-canonical artifacts for review or sharing

Recommended `export` outputs:
- write under `outputs/exports/<export-run-id>/...`

Recommended `export` evidence behavior:
- may update `artifacts.json` with the latest known export inventory
- must not mark the package as finalized
- must not replace canonical `finalized/` outputs unless explicitly asked through a separate boundary command

### 33.8 Freshness model

Freshness should be computed by comparing remembered evidence/output state to current authored/generated source identity.

Recommended package-level freshness questions:
- is `render-state.json` current relative to source?
- does the current artifact inventory correspond to current source?
- do canonical finalized outputs correspond to current source?

Recommended freshness values:
- `current`
- `stale`
- `missing`
- `unknown`

Important recommendation:
- freshness should be computed from source/evidence relationship
- not guessed from timestamps alone when better source identity is available

### 33.9 Source identity for evidence freshness

The package needs some deterministic way to say what source state an evidence record corresponds to.

Current recommendation:
- add a lightweight package source fingerprint or source identity field to evidence files
- do not use git commit as the only identity mechanism, because package evidence must still work independently of any particular git workflow detail

Good candidates:
- deterministic fingerprint over authored source + structural manifest inputs
- possibly manifest identity plus selected authored file mtimes/hashes if implemented carefully

Important boundary:
- git may still help the agent reason historically
- but evidence freshness should remain a package-level source/evidence relation first

### 33.10 Recommended `render-state.json` shape

A recommended first cut:

```json
{
  "schemaVersion": 1,
  "kind": "render-state",
  "sourceFingerprint": "sha256:...",
  "generatedAt": "2026-04-12T12:34:56.000Z",
  "producer": "audit-render",
  "status": "pass",
  "slideIds": ["intro", "problem"],
  "previewKind": "slides",
  "canvasContract": {
    "valid": true,
    "violations": []
  },
  "consoleErrorCount": 0,
  "overflowSlides": [],
  "issues": [],
  "failures": []
}
```

Important note:
- keep it about render judgment
- do not turn it into a dump of every package concern

### 33.11 Recommended `artifacts.json` shape

A recommended first cut:

```json
{
  "schemaVersion": 1,
  "kind": "artifacts",
  "sourceFingerprint": "sha256:...",
  "generatedAt": "2026-04-12T12:35:10.000Z",
  "finalized": {
    "exists": true,
    "outputDir": "outputs/finalized",
    "pdf": { "path": "outputs/finalized/deck.pdf" },
    "report": { "path": "outputs/finalized/report.json" },
    "summary": { "path": "outputs/finalized/summary.md" },
    "fullPage": { "path": "outputs/finalized/full-page.png" },
    "slides": [
      { "id": "intro", "path": "outputs/finalized/slides/slide-intro.png" }
    ]
  },
  "latestExport": {
    "exists": true,
    "format": "pdf",
    "outputDir": "outputs/exports/2026-04-12T12-40-00Z/pdf",
    "pdf": { "path": "outputs/exports/2026-04-12T12-40-00Z/pdf/my-presentation.pdf" },
    "slides": [],
    "artifacts": [
      { "path": "outputs/exports/2026-04-12T12-40-00Z/pdf/my-presentation.pdf" }
    ]
  }
}
```

Important recommendation:
- prefer explicit sections like `finalized` and `latestExport`
- do not flatten canonical delivery and ad hoc exports into one ambiguous list

### 33.12 Delivery state derivation

The package should derive delivery state from:
- presence/absence of canonical finalized outputs
- freshness of those outputs relative to current source
- whether finalize-level blockers exist

Recommended delivery facet values:
- `not_finalized`
- `finalized_current`
- `finalized_stale`
- `finalize_blocked`

This matches the earlier status model and keeps delivery state derived rather than magical.

### 33.13 Evidence-writing rules by command family

#### `audit` (source-only)
- should usually not write runtime evidence
- may return fresh judgment without recording it

#### `audit --render` or equivalent render-backed audit
- may optionally write `render-state.json` if the command contract says it records evidence
- if not recording, it should still return fresh judgment as command output

#### `export`
- may update `artifacts.json` for the latest export inventory
- must not update delivery state to finalized

#### `finalize`
- should update both:
  - `render-state.json`
  - `artifacts.json`
- should also update derived delivery state by virtue of canonical finalized outputs existing/current

### 33.14 Keep evidence and outputs separate even when finalize writes both

A crucial MECE point:
- `finalize` may write both outputs and evidence
- but the outputs and evidence remain different ownership zones

Meaning:
- `outputs/finalized/report.json` is a deliverable/report artifact
- `.presentation/runtime/render-state.json` is remembered package evidence

Even if both are produced in one finalize run, they should not be conceptually merged.

### 33.15 Why this evidence model is better than the current one

This revised model is stronger because it separates:
- runtime judgment memory
- artifact inventory memory
- canonical delivery outputs
- ad hoc export outputs
- agent git milestones

The current code partially collapses those into:
- `render-state.json`
- `artifacts.json`
- `last-good.json`
- flat `outputs/`

The rebuild should uncollapse them.

### 33.16 Current recommendation

Before the core rehaul starts, the package should adopt this evidence/delivery split as a required implementation-grade spec.

That gives the rewrite concrete answers for:
- what runtime evidence files should exist
- what outputs should exist
- what finalize owns
- what export owns
- what should be deleted from the older `last-good` model

## 33A. Protected Headless Core Boundary Spec

Now that the package constitution and runtime model are clearer, the next architectural rule is the protected headless core boundary.

This section is intentionally simpler than a general-purpose extension platform design.

The goal is not to create a shell ecosystem.
The goal is to create a stable, protected headless kernel so UI shells can change rapidly without redefining package behavior.

### 33A.1 Boundary goal

The core should be the only place that knows how the presentation system works.

Shells should be thin viewers/controllers that:
- read package state through the core
- invoke core operations through a small programmatic surface
- render progress, findings, and outputs

Shells should not:
- mutate authored presentation content directly
- redefine workflow meaning
- reconstruct finalize/export/audit orchestration themselves
- write package truth or runtime evidence files directly

### 33A.2 Non-goals for this phase

This phase is not trying to provide:
- a third-party shell plugin ecosystem
- generic capability discovery for arbitrary external clients
- arbitrary extension hooks into package semantics
- shell-authored workflow semantics

Those may be revisited later if real use demands them.

### 33A.3 Minimal protected core surface

The protected headless core should expose only a small semantic surface.

#### Read/query surface
- inspect package
- get status
- get preview

#### Operation surface
- run audit
- finalize
- export presentation
- optionally scaffold project if project creation remains part of the protected core

This surface should be library-first.

CLI remains an adapter for agents.
Shells should consume the programmatic core directly rather than spawning the CLI.

### 33A.4 Core responsibilities

The core should own:
- package constitution and path semantics
- structural compilation and package manifest generation
- deterministic audits and issue envelopes
- status derivation
- preview assembly/document generation
- finalize/export orchestration
- runtime evidence and delivery artifact writes
- authored-content mutation boundaries

### 33A.5 Shell responsibilities

The shell should own:
- layout and visual presentation
- menu/button wiring
- dialogs and host interactions
- progress rendering
- preview framing around the core-produced document/session
- terminal embedding for agent use when needed

### 33A.6 Replaceability test

A shell is replaceable if the following is true:
- changing shell UX does not require changing core orchestration
- changing shell UX does not require changing core state semantics
- changing shell UX does not require changing the authored-content mutation boundary

If those conditions fail, the shell boundary is not yet strong enough.

### 33A.7 Core-first implementation order

Before any new shell work begins, the rehaul should complete a core-only hardening pass that:
- introduces a small protected programmatic core facade
- routes existing CLI and application adapters through that facade
- keeps Electron-specific behavior out of the core facade
- adds tests that lock the authored-content mutation boundary in place

Only after that core seam is stable should shell experimentation proceed.

## 34. CLI Contract Spec (First Implementation-Grade Cut)

Now that the package constitution, structural compiler, and evidence/delivery model are clearer, the next implementation-grade spec is the CLI contract.

This section answers:
- which command families should exist first
- what each command family is allowed to mean
- what output contracts should look like
- which commands mutate package-owned state vs only compute
- what exit codes should mean

### 34.1 Command-family contract rule

A top-level family should exist only if it answers one primary package question.

Current recommended top-level families:
- `presentation inspect ...`
- `presentation status ...`
- `presentation audit ...`
- `presentation finalize ...`
- `presentation export ...`
- `presentation explain ...` (optional but valuable)

Native git remains outside the package CLI contract.
Agents should use native git directly for:
- history
- diffs
- milestones
- rollback/navigation

### 34.2 Required common CLI rules

All package CLI families should follow these common rules.

#### Targeting
Commands should target a package via:
- `--project /abs/path`

Optional scope narrowing should then be family-specific, for example:
- `--slide <id>`
- `--path <path>`
- `--deck`

#### Output format
Every family should support at least:
- `--format text`
- `--format json`

Default recommendation:
- default to `text` for interactive agent work
- support `json` for machine integration and richer agent tooling

#### Determinism
For a given source state and command mode, output should be deterministic.

#### No hidden mutation
A command must not mutate package-owned state unless that mutation is part of its declared contract.

### 34.3 Family 1 — `presentation inspect ...`

Primary purpose:
- orientation and inventory

Recommended first subcommands:
- `presentation inspect package --project /abs/path`
- `presentation inspect slides --project /abs/path`
- `presentation inspect slide --project /abs/path --slide <id>`
- `presentation inspect theme --project /abs/path`
- `presentation inspect canvas --project /abs/path`
- `presentation inspect evidence --project /abs/path`
- `presentation inspect artifacts --project /abs/path`
- `presentation inspect boundaries --project /abs/path`

Implementation note:
- the first rebuilt-core cut currently ships `presentation inspect package`
- the remaining inspect scopes are still authoritative target architecture, but not all are implemented yet

Mutation contract:
- pure view by default
- no package-owned file writes

Recommended output envelope:

```json
{
  "command": "presentation inspect slide --project /abs/path --slide intro",
  "status": "ok",
  "scope": { "kind": "slide", "slideId": "intro" },
  "summary": {},
  "data": {},
  "evidence": [],
  "freshness": { "relativeToSource": "current" }
}
```

Recommended exit codes:
- `0` success
- `2` internal/runtime failure
- `3` requested scope unsupported or unavailable

### 34.4 Family 2 — `presentation status ...`

Primary purpose:
- interpreted package state

Recommended first subcommands:
- `presentation status --project /abs/path`
- `presentation status package --project /abs/path`
- `presentation status slide --project /abs/path --slide <id>`
- `presentation status readiness --project /abs/path`
- `presentation status finalize --project /abs/path`

Implementation note:
- the first rebuilt-core cut currently ships package-level, readiness, and finalize-oriented status views
- slide-scoped status remains planned extension over the same workflow/facet model

Mutation contract:
- pure view or view+fresh-derivation only
- must not write evidence or outputs

Recommended output envelope:

```json
{
  "command": "presentation status --project /abs/path",
  "status": "ok",
  "workflow": "authoring",
  "summary": "Authoring in progress; finalized outputs are stale relative to current source.",
  "blockers": [],
  "facets": {
    "delivery": "finalized_stale",
    "evidence": "current"
  },
  "nextBoundary": "finalize",
  "nextFocus": []
}
```

Recommended exit codes:
- `0` status successfully derived
- `2` internal/runtime failure
- `3` status could not be derived reliably because required package facts are unavailable

Important rule:
- `status` should summarize package meaning
- it should not become a synonym for re-running every audit by default

### 34.5 Family 3 — `presentation audit ...`

Primary purpose:
- deterministic diagnostics

Required first subcommands:
- `presentation audit theme --project /abs/path`
- `presentation audit canvas --project /abs/path`
- `presentation audit boundaries --project /abs/path`
- `presentation audit density --project /abs/path`
- `presentation audit deck --project /abs/path`
- `presentation audit all --project /abs/path`

Implementation note:
- the first rebuilt-core cut currently ships `theme`, `canvas`, `boundaries`, and `all`
- `density` and `deck` remain valid future family extensions in this architecture doc

Required common audit options:
- `--slide <id>`
- `--path <path>`
- `--deck`
- `--severity error|warning|advisory`
- `--strict`
- `--render` for render-backed audit modes

Mutation contract:
- source-only audits should default to view+computation only
- render-backed modes may optionally refresh evidence, but only if that recording behavior is explicit in the contract

Output contract:
- should use the issue/result model defined earlier in this document
- must include deterministic issues, nextFocus, and freshness

Recommended exit codes:
- `0` no hard violations
- `1` one or more hard violations found
- `2` internal/runtime failure
- `3` trustworthy judgment unavailable

Important rule:
- `audit` is diagnostics, not package-state interpretation
- `audit all` must not collapse back into an overloaded replacement for `check`

### 34.6 Family 4 — `presentation finalize ...`

Primary purpose:
- canonical delivery boundary

Recommended first subcommands:
- `presentation finalize --project /abs/path`
- `presentation finalize status --project /abs/path`
- `presentation finalize explain-blockers --project /abs/path`

Mutation contract:
- `finalize` is a boundary-crossing action
- it may write:
  - canonical finalized outputs
  - render-state evidence
  - artifact inventory evidence
- it must not create a parallel checkpoint/trust artifact

Recommended output envelope for the action command:

```json
{
  "command": "presentation finalize --project /abs/path",
  "status": "pass",
  "summary": "Canonical delivery outputs were produced.",
  "outputs": {
    "outputDir": "outputs/finalized",
    "pdf": "outputs/finalized/deck.pdf",
    "report": "outputs/finalized/report.json",
    "summary": "outputs/finalized/summary.md"
  },
  "evidenceUpdated": [
    ".presentation/runtime/render-state.json",
    ".presentation/runtime/artifacts.json"
  ],
  "issues": []
}
```

Recommended exit codes:
- `0` finalize succeeded
- `1` finalize completed but package failed finalize-level checks / blockers remain
- `2` internal/runtime failure
- `3` finalize unavailable because prerequisites or scope are unsupported

Important rule:
- `presentation finalize status` is a status/readiness view
- `presentation finalize` is the state-changing action

### 34.7 Family 5 — `presentation export ...`

Primary purpose:
- direct artifact emission

Recommended first subcommands:
- `presentation export pdf --project /abs/path [--slide <id> ...]`
- `presentation export screenshots --project /abs/path [--slide <id> ...]`

Optional later subcommands:
- `presentation export bundle`
- `presentation export notes`

Mutation contract:
- may write under `outputs/exports/...`
- may update artifact inventory evidence
- must not mark the package finalized

Recommended output envelope:

```json
{
  "command": "presentation export pdf --project /abs/path --slide intro",
  "status": "pass",
  "summary": "Requested export artifacts were produced.",
  "outputs": {
    "outputDir": "outputs/exports/2026-04-12T12-40-00Z/pdf",
    "artifacts": [
      "outputs/exports/2026-04-12T12-40-00Z/pdf/intro.pdf"
    ]
  },
  "issues": []
}
```

Recommended exit codes:
- `0` export succeeded
- `1` export request was valid but blocked by package/export issues
- `2` internal/runtime failure
- `3` requested export mode or scope unsupported

### 34.8 Family 6 — `presentation explain ...`

Primary purpose:
- deterministic semantic help

Recommended first subcommands:
- `presentation explain issue <code>`
- `presentation explain boundary <boundary-id>`
- `presentation explain status <status-id>`
- `presentation explain finalize-blockers --project /abs/path`

Mutation contract:
- pure view only

Recommended exit codes:
- `0` explanation returned
- `2` internal/runtime failure
- `3` unknown concept or unsupported explanation target

### 34.9 Text-output rules

Text mode should be:
- compact
- deterministic
- package-native
- easy for an agent to skim

Recommended text-output structure:
- command line echoed or implicit
- one-line status summary
- scope line
- compact issue/result sections
- inspect-next guidance when relevant

It should not read like:
- a parser stack trace
- generic logging noise
- improvised prose

### 34.10 JSON-output rules

JSON mode should be:
- fully structured
- stable enough for downstream tools/agents
- family-consistent at the top level

Recommended common top-level fields across families:
- `command`
- `status`
- `scope`
- `summary`
- `issues` when relevant
- `evidence`
- `freshness`
- `nextFocus` when relevant

Family-specific fields may then extend that base.

### 34.11 Mutation classes by family

#### Pure view
Examples:
- most `inspect`
- most `status`
- `explain`

#### View + computation
Examples:
- source-only `audit`
- some richer `status` derivations

#### Computation + evidence update
Examples:
- render-backed audit modes if explicit
- some export/finalize preparation steps when they record evidence

#### Boundary-crossing action
Examples:
- `finalize`
- `export`

Important recommendation:
- the package should expose this mutation class in command metadata or documentation
- the agent should not have to guess whether a command records evidence or creates outputs

### 34.12 Minimal v1 CLI

If only a small first CLI is implemented in the rehaul, the minimum coherent set is likely:
- `presentation inspect package`
- `presentation inspect slide --slide <id>`
- `presentation status`
- `presentation status finalize`
- `presentation audit theme`
- `presentation audit canvas`
- `presentation audit boundaries`
- `presentation audit all`
- `presentation finalize`
- `presentation export pdf`

This is likely enough to express the package’s core operational language without reproducing the old semantic overload.

### 34.13 Current recommendation

Before the core rehaul starts, this CLI contract should be treated as a required implementation-grade spec.

It gives the rewrite concrete answers for:
- which verbs exist
- what they mean
- what they may mutate
- what outputs they return
- how agents should distinguish diagnostics, status, finalize, and export

## 35. Rewrite / Migration Spec (First Implementation-Grade Cut)

Now that the package constitution, structural compiler, evidence/delivery model, and CLI contract are clearer, the remaining implementation-grade spec is the rewrite/migration plan.

This section answers:
- how the current core should be decomposed into the new one
- which current modules are kept, split, wrapped, or retired
- what order the rehaul should happen in
- how to reduce risk while changing the core semantics substantially

### 35.1 Historical pre-rebuild migration diagnosis

This section preserves the original migration diagnosis from before the rebuilt-core cut landed.
The point is historical context: why the rewrite was necessary and which old seams were being targeted.

Pre-rebuild hotspots were:
- `framework/runtime/services/presentation-ops-service.mjs`
  - mixed capture, validation, export, finalize, evidence writes, and older `last-good` semantics
- `framework/runtime/project-state.js`
  - compressed source completeness, policy validity, evidence, and output existence into coarse states
- `framework/runtime/presentation-package.js`
  - mixed manifest generation with package ensure/bootstrap behavior
- `framework/runtime/presentation-runtime-state.js`
  - carried the older `last-good.json` trust/checkpoint model
- `framework/application/presentation-action-adapter.mjs`
  - exposed action names whose semantics did not cleanly match the newer architecture, especially `export_presentation`
- CLI entrypoints:
  - `check-deck.mjs`
  - `deck-capture.mjs`
  - `export-pdf.mjs`
  - `finalize-deck.mjs`
  - reflected older, partially overloaded naming

So the rewrite needed to focus on:
- decomposition
- naming alignment
- explicit boundaries
- compatibility wrappers during transition

### 35.2 Migration design rule

A strong migration rule:

> Move semantics first, then names, then deletion.

Meaning:
1. first create the new internal boundaries
2. then adapt the external command/action surface to those boundaries
3. only then remove legacy shapes

This reduces the risk of a rewrite that renames everything before the new architecture actually exists.

### 35.3 Target internal module split

Current recommendation for the rebuilt core is to separate responsibilities into clearer units.

#### A. Package constitution / paths layer
Likely responsibilities:
- package path resolution
- package ownership zones
- stable package identity/config path mapping

Current sources to mine:
- `framework/runtime/deck-paths.js`

Likely outcome:
- keep much of the path knowledge
- revise constants and path helpers to match the new constitution
- remove `last-good` and flat-output assumptions

#### B. Structural compiler layer
Likely responsibilities:
- discover authored source units
- normalize slide identity/order
- compute structural manifest
- record structural manifest when requested

Current sources to mine:
- `framework/runtime/deck-source.js`
- `framework/runtime/presentation-package.js`

Likely outcome:
- keep core slide-discovery logic
- split compute vs record behavior more explicitly
- keep validation concerns out of the compiler

#### C. Structural/policy validation layer
Likely responsibilities:
- authored-source structural validation
- policy validation
- framework-boundary validation

Current sources to mine:
- `framework/runtime/deck-policy.js`
- pieces of `framework/runtime/project-state.js`

Likely outcome:
- preserve current rule knowledge
- re-express it through the new issue schema and audit families

#### D. Runtime/render audit layer
Likely responsibilities:
- render-backed auditing
- capture-driven diagnostics
- runtime issue derivation

Current sources to mine:
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/deck-capture.mjs`
- runtime/canvas contract modules

Likely outcome:
- split runtime judgment from export/finalize semantics
- make evidence recording explicit rather than incidental

#### E. Evidence / delivery-state layer
Likely responsibilities:
- read/write `render-state.json`
- read/write `artifacts.json`
- derive freshness and delivery state

Current sources to mine:
- `framework/runtime/presentation-runtime-state.js`
- output-path logic in `deck-paths.js`
- parts of `project-state.js`

Likely outcome:
- remove `last-good.json`
- reorganize output inventory around `finalized` vs `exports`

#### F. CLI orchestration layer
Likely responsibilities:
- implement `inspect`, `status`, `audit`, `finalize`, `export`, `explain`
- translate command options to internal operations
- normalize JSON/text output
- apply exit code contract

Current sources to mine:
- `check-deck.mjs`
- `finalize-deck.mjs`
- `export-pdf.mjs`
- `presentation-action-adapter.mjs`

Likely outcome:
- legacy CLIs become wrappers or are retired after cutover

### 35.4 Target external cutover model

The safest migration posture is:

#### Preserve old entrypoints temporarily
Keep current commands/actions working while internally redirecting them to the new core.

Examples:
- old `check` flow can temporarily wrap `presentation audit all` or the closest compatible new bundle
- old `export_presentation` action can temporarily wrap the new finalize operation
- old `export_presentation_artifacts` action can temporarily wrap the new export operation

#### Introduce the new semantic surface explicitly
Add the new CLI family in parallel rather than flipping everything at once.

#### Remove old names only after parity is demonstrated
This includes:
- old `check` semantics
- ambiguous action ids
- `last-good` state writes
- flat `outputs/` assumptions

### 35.5 Recommended migration phases

#### Phase 1 — Establish the new package constitution internally
Goals:
- update path/constants layer to match the new folder model
- add new output path helpers for:
  - `outputs/finalized/`
  - `outputs/exports/<run-id>/`
- prepare runtime-state layer to stop requiring `last-good.json`

Changes likely include:
- revise `deck-paths.js`
- revise `presentation-runtime-state.js`
- keep compatibility reads where necessary

Success criteria:
- the codebase can understand both current and target package structure during migration
- no user-facing semantic flip yet

#### Phase 2 — Extract structural compiler from package ensure/bootstrap logic
Goals:
- separate manifest computation from package bootstrapping
- make compute vs record explicit
- keep intent validation adjacent but structurally subordinate

Changes likely include:
- split `presentation-package.js`
- preserve `generatePresentationPackageManifest(...)` knowledge
- create clearer structural compiler interfaces

Success criteria:
- structure can be computed/recorded independently
- compiler output matches the new manifest contract

#### Phase 3 — Rebuild audit layer around issue schema
Goals:
- move current validator knowledge into the new audit families
- support at least:
  - `audit theme`
  - `audit canvas`
  - `audit boundaries`
  - `audit all`
- keep text/json result contracts aligned

Changes likely include:
- wrap/refactor `deck-policy.js`
- split source-side vs render-backed audit logic
- adapt `check-deck.mjs` to become a compatibility wrapper

Success criteria:
- new audit results are structured and deterministic
- old validation knowledge still works through the new issue taxonomy

#### Phase 4 — Rebuild evidence and delivery writing
Goals:
- remove `last-good.json` writes
- split artifact inventory into finalized vs export tracking
- make render-state/artifact updates match the new evidence model

Changes likely include:
- refactor `presentation-runtime-state.js`
- refactor finalize/export logic in `presentation-ops-service.mjs`

Success criteria:
- package evidence matches the new spec
- no parallel checkpoint/trust lane remains

#### Phase 5 — Introduce new CLI family
Goals:
- implement new commands:
  - `inspect`
  - `status`
  - `audit`
  - `finalize`
  - `export`
  - optional `explain`
- keep old entrypoints as wrappers where needed

Changes likely include:
- new CLI entrypoints or subcommand router
- action adapter remapping in `presentation-action-adapter.mjs`

Success criteria:
- new CLI is usable end-to-end
- old commands still function through compatibility shims

#### Phase 6 — Retire legacy naming and flat-output assumptions
Goals:
- stop centering `check`
- stop centering `capture` as a top-level semantic family unless still justified
- stop using flat `outputs/` assumptions in finalize/export flows
- update docs/specs/scaffolds to the new package model

Changes likely include:
- clean up old wrappers
- update `docs/presentation-package-spec.md`
- update scaffolding/templates where necessary

Success criteria:
- only the new semantic model remains primary
- legacy names are either removed or clearly compatibility-only

### 35.6 Recommended keep / split / retire table

#### Keep, but adapt
- `framework/runtime/deck-paths.js`
  - keep path knowledge, adapt folder/output/runtime assumptions
- `framework/runtime/deck-source.js`
  - keep slide-discovery and asset-resolution primitives
- `framework/runtime/deck-policy.js`
  - keep validator knowledge, refactor into clearer audit families

#### Split
- `framework/runtime/presentation-package.js`
  - split package bootstrap from structural compiler
- `framework/runtime/services/presentation-ops-service.mjs`
  - split runtime audit, export, finalize, and evidence writing responsibilities
- `framework/runtime/project-state.js`
  - split coarse status derivation from lower-level issue/evidence facts

#### Retire or remove from core semantics
- `.presentation/runtime/last-good.json`
- package-level checkpoint/trust concepts
- action naming where `export` really means `finalize`
- flat `outputs/` as the only output shape

### 35.7 Compatibility strategy for current commands

Recommended temporary compatibility mappings:

#### Old `check`
- temporarily map to a bundled new audit/readiness path
- but document that the new semantic home is `audit` + `status`

#### Old `capture`
- temporarily keep if current tooling depends on it
- but treat it as an implementation/runtime mechanism, not the center of the future CLI

#### Old `export`
- keep for direct artifact emission only
- remove ambiguous use where it really means finalize

#### Old `finalize`
- keep as the canonical boundary command
- change internals to match the new evidence/output model

#### Application actions
- `export_presentation` -> future finalize action
- `export_presentation_artifacts` -> future export action
- `validate_presentation` -> future audit/status-aligned action depending on exact UX need

### 35.8 Verification strategy during migration

A rewrite this large should not rely on intuition alone.

Recommended verification layers:

#### Structural parity checks
- old and new manifest generation should agree on slide inventory/order for representative projects

#### Audit parity checks
- existing known policy failures should still be detected after audit refactoring

#### Output parity checks
- finalize should still produce the expected canonical output set
- export should still produce requested artifacts

#### State-model checks
- status derivation should map correctly from current source/evidence/output facts

#### Compatibility checks
- legacy command wrappers should still behave acceptably until retired

### 35.9 Cutover risk to watch closely

The highest migration risks are likely:
- accidentally mixing evidence writes into source-only audit flows
- breaking current output-path assumptions in Electron/application integrations
- allowing old action names to keep old semantics alive too long
- leaving `last-good`/checkpoint logic partially alive in hidden places
- rebuilding status before evidence/delivery semantics are stable

So migration order matters.
The package should not try to rewrite all semantics simultaneously in one pass.

### 35.10 Current recommendation

The core rehaul should proceed as a phased extraction and semantic realignment, not as a single giant rewrite branch that replaces everything at once.

The safest order is:
1. constitution/path cleanup
2. structural compiler extraction
3. audit-layer normalization
4. evidence/delivery rewrite
5. CLI cutover
6. legacy deletion

That sequence best preserves correctness while moving the codebase toward the new MECE package core.

## 35A. Shell-less v1 Packaging, Project, and Init Model

This section captures the first shippable product model after stepping back from shell concerns.

It is intentionally simpler than the broader earlier exploration.
For the first shipped version, these shell-less v1 sections are authoritative where they differ from older output-tree or shell-adjacent ideas.

### 35A.1 Product posture

The first shipped product should be:
- one installed system
- containing the shared core and CLI
- usable without any shell

A shell may be added later, but the system must already work with:
- installed core
- installed CLI
- an agent operating inside a project folder

### 35A.2 Installed system vs project vs deliverable

The model is three-layered.

#### Installed system
The installed system is the sacred/common layer.

It owns:
- shared core semantics
- validators and audits
- preview/finalize/export orchestration
- init/scaffolding logic
- shared framework design-system rules
- CLI behavior

#### Project workspace
The project workspace is one mutable presentation.

It owns:
- authored source at the project root
- hidden project machinery under `.presentation/`
- local agent guidance/support files scaffolded by init

#### Deliverable
The user-facing deliverable is the exported PDF at the project root.

Users care about the final PDF, not the hidden package machinery.

### 35A.3 Root vs hidden-folder rule

The project root should contain:
- authored presentation files
- the final exported PDF

The hidden `.presentation/` folder should contain:
- project metadata
- intent
- generated structure
- runtime evidence
- the local project shim
- local agent guidance/support files

The hidden folder should not become the main authored workspace.

### 35A.4 Local shim rule

Every initialized project should get a hidden local shim in:
- `.presentation/framework-cli.mjs`

This shim is the preferred local project entrypoint for agents.

It should:
- anchor execution to the current project
- resolve the installed system through standard package resolution
- perform lightweight project checks
- forward commands into the installed core
- fail clearly with repair guidance if the installed system is missing or incompatible

It should not:
- duplicate core logic
- hold workflow semantics
- bake in machine-specific absolute install paths

### 35A.5 Init rule

`init` is a core-owned scaffolding operation.

It should create:
- root-level authored presentation files
- hidden `.presentation/` machinery
- the local shim
- local agent guidance/support files

It should not:
- require a shell
- copy the full sacred core into the project
- create final export artifacts up front
- make the agent guess where the local entrypoint is

### 35A.6 Minimal v1 project shape

The intended shell-less v1 shape is:

```text
<project-root>/
  brief.md
  theme.css
  outline.md                  # optional
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
    agent/**
```

### 35A.7 Failure posture for v1

If the shim cannot resolve the installed system, or if the project is obviously unsupported:
- fail hard
- provide clear repair guidance
- do not auto-repair in v1

This keeps the system honest and avoids hidden mutation or surprising environment changes.

## 35B. Design System Placement Spec

The Hardik-style design-system model should appear in this architecture, but it should be placed carefully.

### 35B.1 Core placement rule

The installed system holds the shared framework design system.

That includes:
- canvas/stage contract
- protected layout primitives
- token ownership rules
- shared structural affordances
- deterministic audit rules
- deterministic issue vocabulary
- preview/render behavior that interprets the framework correctly

This is the sacred/common design language.

### 35B.2 Project placement rule

The project workspace holds the deck-specific expression of that shared design system.

This primarily lives in:
- `theme.css`
- `slides/**/slide.html`
- optional `slides/**/slide.css`
- presentation assets

`theme.css` is the main editable deck-specific design-system file.

### 35B.3 Hidden-folder rule for design-system material

`.presentation/` is not the primary home of design-system authorship.

It should contain design-system-related information only as:
- generated structure
- remembered evidence
- validation outcomes
- operational metadata

It should not become the main place where the deck’s visual language is authored.

### 35B.4 Deliverable rule

The final PDF is the user-facing manifestation of the design system.

End users do not need to understand framework tokens or hidden package files.
They experience the design system through the rendered/exported deck.

### 35B.5 Agent boundary rule

The agent may edit:
- deck-specific design-system expression in `theme.css`
- slide structure/content in `slide.html`
- optional slide-local `slide.css`
- supporting assets

The agent may read but should not normally mutate:
- installed shared design-system logic
- hidden package-generated structure
- runtime evidence
- local shim implementation details

## 35C. Precise v1 Init Behavior Spec

### 35C.1 Purpose of init

`init` creates a valid presentation project that can be used immediately by:
- the installed system
- the CLI
- an agent
- later shells, if added

It must produce a mutable presentation workspace plus hidden project machinery.

### 35C.2 What init must create at project root

`init` must create templated authored files such as:
- `brief.md`
- `theme.css`
- starter `slides/**/slide.html`
- `assets/`
- optional `outline.md` only when the template/mode requires it

The starter slides should already satisfy the structural slide-root contract.

### 35C.3 What init must create in `.presentation/`

`init` must create:
- `.presentation/project.json`
- `.presentation/intent.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/framework-cli.mjs`
- `.presentation/agent/*` guidance/support files

### 35C.4 What init must never do

`init` must not:
- require the shell
- generate the final exported PDF
- copy the whole sacred core into the project
- hide the main authored source inside `.presentation/`
- record machine-specific absolute install paths in project files

### 35C.5 Init success criteria

A successful init guarantees:
- the project is structurally valid
- the local shim exists
- authored files exist at the project root
- hidden machinery exists under `.presentation/`
- inspect/status/audit/preview can operate immediately

## 36. Update Instructions for This Document

As the architecture discussion continues, this document should be updated rather than replaced.

Desired update style:
- preserve the stable decisions
- clearly mark provisional decisions
- record rejected models when helpful
- keep open questions explicit
- keep the package-only focus unless we intentionally widen scope
