# PRD: AI Agent (Deck Author)

Product Requirements Document for the AI agent that creates and revises presentations within a scaffolded project folder. This document is self-contained -- a new contributor can understand the full intent model without reading any other file in the repository.

---

## 1. Agent Identity & Role

### What the Agent Is

The AI agent is Claude, an LLM-powered assistant operating inside a scaffolded presentation project. It runs in the integrated terminal of the Electron desktop app (launched via the `claude` command after clicking into a project). It operates under a strict contract defined by the project's `.claude/` directory, which constrains its editable surfaces, CSS cascade rules, structural primitives, and verification workflows.

The agent receives a `.claude/CLAUDE.md` file plus a set of rule files under `.claude/rules/` at the time of scaffolding. These files are the agent's operating contract. They define what it can edit, what it must not touch, what CSS layer ordering to respect, which HTML patterns are legal, and which CLI commands to use for validation, capture, export, and finalization.

The agent also receives a set of skill files under `.claude/skills/` that define guided workflows for common tasks (new-deck, revise-deck, review-deck, fix-warnings, verify-deck, review-deck-swarm). These skills are invoked by the human via slash commands (e.g., `/new-deck`) and provide the agent with step-by-step instructions for each workflow type.

A stop hook (`.claude/hooks/check-slide-quality.mjs`) runs automatically after every agent response. This hook is the primary quality gate: it checks the deck for quality warnings and either auto-commits clean work or forces the agent to keep fixing issues before it can stop.

### What the Agent Is Not

The AI agent is NOT a framework maintainer. It is a deck author -- it creates and revises presentation content within a single project folder. Framework-level changes (canvas primitives, client behavior, runtime assembly, export logic, capture infrastructure, scaffolding templates) are outside its scope. The agent must never modify files under `framework/canvas/`, `framework/client/`, `framework/runtime/`, or `templates/`. If a task appears to require framework changes, the agent must stop and confirm with the human that the task is framework work, not deck work.

### Operating Environment

The agent operates within a project folder that has this structure:

```
my-deck/
  brief.md                        # Normalized user request
  theme.css                       # Deck-wide visual system (@layer theme)
  outline.md                      # Story arc + design decisions (required for 10+ slides)
  revisions.md                    # Feedback and change log
  assets/                         # Deck-shared images and media
  slides/
    010-intro/
      slide.html                  # Slide content (one root fragment)
      slide.css                   # Optional slide-local CSS (scoped to #intro)
      assets/                     # Optional slide-local assets
    020-overview/
      slide.html
    030-close/
      slide.html
  outputs/
    deck.pdf                      # Exported PDF
    report.json                   # Structured capture data
    full-page.png                 # Full-page screenshot
    slides/                       # Per-slide screenshot PNGs
    summary.md                    # Human-readable status report
  .presentation/
    project.json                  # System metadata (managed by runtime, not agent)
  .claude/
    CLAUDE.md                     # Agent contract
    rules/                        # Authoring constraints
    skills/                       # Guided workflows
    hooks/                        # Quality enforcement hooks
    settings.json                 # Claude Code settings
```

The project may be in "linked" mode (framework is referenced from its installed location) or "copied" mode (framework is vendored into the project via `--copy-framework`). The agent must report which mode a project uses at handoff.

---

## 2. Goals

### Primary Goals

1. **Transform plain-English requests into professional, visually varied presentation decks.** The agent receives a natural-language description of what the human wants and produces a complete deck -- theme, slides, assets, and exported artifacts.

2. **Design a cohesive visual system (theme) before any content.** The agent must finalize `theme.css` with the full palette, typography, shadows, radii, and component styles before writing any slide HTML. This prevents visual inconsistency and reduces rework.

3. **Make deliberate design decisions for every slide.** Each slide must be designed individually -- which structural primitives to use, how it differs from its neighbors, whether images are needed. The agent must not stamp the same layout on every slide.

4. **Maintain the cascade contract: content < theme < canvas.** The CSS cascade is the structural backbone of the framework. The agent must never bypass it with inline styles, `!important`, or unscoped selectors.

5. **Iterate on quality warnings until the deck passes clean.** The stop hook enforces a zero-warnings policy. The agent must fix every quality warning before it can stop responding.

6. **Produce exportable artifacts.** Every completed workflow must end with `npm run finalize`, which produces `outputs/deck.pdf`, `outputs/slides/`, `outputs/report.json`, and `outputs/summary.md`.

7. **Report exact output paths and open questions when done.** The human must know where to find every artifact and what decisions remain.

### Non-Goals

- The agent does not maintain the framework itself.
- The agent does not build the Electron desktop app or modify its behavior.
- The agent does not change canvas primitives, slide dimensions, grid semantics, or export logic.
- The agent does not create standalone HTML files outside the project folder structure.
- The agent does not push to git remotes or manage CI/CD pipelines.

---

## 3. User Stories

### A. Onboarding

As the AI agent, I need to read `.claude/CLAUDE.md` when I first start working in a project so that I understand my operating contract before making any edits.

As the AI agent, I need to read all rule files (`.claude/rules/framework.md`, `.claude/rules/authoring-rules.md`, `.claude/rules/file-boundaries.md`, `.claude/rules/slide-patterns.md`, `.claude/rules/tokens.md`) so that I understand every constraint that governs my work.

As the AI agent, I need to understand the CSS cascade contract (`content < theme < canvas`) so that I never write CSS that violates the layer ordering or overrides protected canvas selectors.

As the AI agent, I need to know which files are editable (`theme.css`, `slides/*/slide.html`, `slides/*/slide.css`, `brief.md`, `outline.md`, `revisions.md`, `assets/`, `slides/*/assets/`) and which are protected (`framework/canvas/`, `framework/client/`, `framework/runtime/`, `templates/`, `.presentation/project.json`) so that I never modify files outside my edit lane.

As the AI agent, I need to understand the structural primitives (`.g2`, `.g3`, `.g4`, `.icard`, `.stat-card`, `.badge`, `.tkwy`, `.flex`, `table`, `.img-round`, `.img-circle`) so that I can compose slides from the framework's existing components rather than inventing ad hoc structures.

As the AI agent, I need to know the slide modes (`.slide` for light backgrounds with dark text, `.slide.slide-hero` for dark backgrounds with light text) so that I use the correct mode for each slide's purpose.

As the AI agent, I need to understand token ownership -- theme-owned tokens (accent colors, semantic colors, card backgrounds, text colors, shadows, radii, font families, hero backgrounds) versus canvas-owned tokens (`--slide-max-w`, `--slide-wide-max-w`, `--slide-ratio`, `--slide-gap`, grid gaps, padding) -- so that I define the right variables in the right place.

As the AI agent, I need to check the project state (whether `.presentation/project.json` exists, whether `slides/` has content, whether `brief.md` and `theme.css` are present) so that I know whether this is a new scaffold, an in-progress project, or a project ready for finalization.

### B. Creation (new-deck)

As the AI agent, I need to run `npm run new -- --project /abs/path` (optionally with `--slides N` for large decks or `--copy-framework` for vendored mode) so that the project folder is properly scaffolded with all necessary metadata, `.claude/` configuration, and template files.

As the AI agent, I need to convert the user's plain-English request into `brief.md` so that the normalized request is captured as a persistent record and validated by the policy checker (empty or TODO-filled `brief.md` blocks validation).

As the AI agent, I need to fill every `[[TODO_...]]` marker in `outline.md` before building any slides (required for decks with more than 10 slides) so that the story arc is locked before slide-by-slide buildout and the policy checker does not reject the deck.

As the AI agent, I need to design `theme.css` FIRST -- defining the complete visual system including palette, typography scale, shadows, border radii, and component styles inside `@layer theme` -- so that all slides share a cohesive look from the start.

As the AI agent, I need to design each slide individually before writing HTML -- deciding which structural primitives to use (`.g2` for comparisons, `.g3`/`.g4` for feature grids, `table` for data, `.tkwy` for standalone insights, narrative text for argument slides), how each slide differs from its neighbors, and whether images are needed -- so that the deck has visual variety and each slide serves its content.

As the AI agent, I need to record per-slide design decisions in `outline.md` (for decks with 10+ slides) so that the design plan is auditable and the outline matches the actual slide sequence.

As the AI agent, I need to NOT build slide HTML until the theme is finalized and every slide has a design decision so that I avoid the rework cycle of building slides with inconsistent styling.

As the AI agent, I need to build slides in `slides/NNN-id/slide.html` where each file contains exactly one root fragment (a `<div>` with class `.slide` or `.slide.slide-hero`) without outer wrappers (`<html>`, `<head>`, `<body>`, `<section data-slide>`) so that the runtime can assemble the deck correctly.

As the AI agent, I need to build in batches of 5 slides for decks with 10+ slides, running `npm run check -- --project /abs/path` after each batch, so that policy violations and quality warnings are caught early rather than accumulating.

As the AI agent, I need to use optional `slide.css` files only when a slide needs local composition, scoping all selectors to `#slide-id` and wrapping them in `@layer content`, so that slide-local CSS cannot leak into other slides or override theme primitives.

As the AI agent, I need to use sparse numbering (`010`, `020`, `030`) for slide folders so that future insertions (e.g., `025-case-study`) do not require renumbering the entire deck.

As the AI agent, I need to inspect the preview, screenshots, and PDF myself before finalizing so that I can catch visual issues (cramped text, misaligned cards, monotonous layouts) that policy checks alone would not flag.

As the AI agent, I need to run `npm run finalize -- --project /abs/path` at the end so that the full pipeline (check, capture, export, report) executes and produces all output artifacts.

### C. Revision (revise-deck)

As the AI agent, I need to convert the user's feedback into `revisions.md` so that the change request is captured as a persistent record alongside the original `brief.md`.

As the AI agent, I need to refresh `outline.md` for decks with 10+ slides so that the story arc still matches the slide sequence after revisions.

As the AI agent, I need to re-evaluate the per-slide design plan in the outline when a revision affects 5+ slides so that variety rules (from slide-patterns) are still met and the deck does not become visually monotonous after changes.

As the AI agent, I need to revise `theme.css` and slide folders under `slides/` to implement the requested changes so that the deck reflects the user's feedback.

As the AI agent, I need to add, rename, or reorder slide folders with sparse numbering when revisions require inserting or restructuring slides so that the deck sequence is correct.

As the AI agent, I need to revise in batches of 5 for decks with 10+ slides, running `npm run check` between batches, so that errors from revisions are caught incrementally.

As the AI agent, I need to inspect the regenerated preview, screenshots, and PDF before finalizing so that I can confirm the revisions look correct visually, not just structurally.

As the AI agent, I need to run `npm run finalize -- --project /abs/path` after revisions so that fresh output artifacts are generated.

### D. Review (review-deck)

As the AI agent, I need to inspect the current theme, slide folders, brief, revisions, and latest outputs so that I have full context on the deck's current state.

As the AI agent, I need to verify that `outline.md` matches the slide sequence for decks with 10+ slides so that I can flag any drift between the planned story and the actual deck.

As the AI agent, I need to inspect the preview, screenshots, and PDF to decide whether the deck reads like a presentation or still needs CSS revision so that my review is based on visual output, not just source files.

As the AI agent, I need to run `npm run finalize -- --project /abs/path` if fresh outputs are needed so that the review is based on current artifacts.

As the AI agent, I need to summarize deck quality, weak points, and revision opportunities so that the user has actionable feedback.

As the AI agent, I need to convert the user's requested changes into `revisions.md` if changes are requested during the review so that the feedback is captured for the next revision cycle.

As the AI agent, I need to recommend an exact revision plan so that the user knows what specific changes would improve the deck.

As the AI agent, I need to report the current project folder path, PDF path, summary path, top issues, and recommended revision plan so that the handoff is complete.

### E. Verification (verify-deck, review-deck-swarm)

#### verify-deck (6-agent swarm)

As the AI agent, I need to ask the user which project to verify and who the target audience is so that the verification is grounded in context.

As the AI agent, I need to search for reference documents (style guides, brand docs, `.md` files) in the framework directory or its parent so that agents can cross-reference claims and verify branding.

As the AI agent, I need to launch 6 parallel verification agents -- visual-consistency, data-accuracy, content-quality, audience-calibration, typography-readability, slide-structure -- each with its own capture run so that the deck is analyzed from 6 independent angles simultaneously.

As the AI agent, I need to provide each agent with the absolute project path, framework directory, target audience, reference document paths, capture command, and its specific checklist so that each agent has full context for its analysis.

As the AI agent, I need to instruct each agent to read `report.json` and every slide screenshot PNG so that findings are based on both structured data and visual inspection.

As the AI agent, I need to instruct each agent to report findings with severity levels (CRITICAL / WARNING / NOTE) and slide IDs so that the synthesized report is actionable.

As the AI agent, I need to synthesize all findings into a single report with an overall score (average of 6 agent scores), grouped by severity, and present it to the user so that the user can triage.

As the AI agent, I need to ask the user "Should I fix the CRITICAL and WARNING issues?" and only fix what is approved so that the user retains triage authority.

As the AI agent, I need to fix CRITICAL issues first, then WARNING issues, and NOT fix NOTE-level issues unless specifically asked so that effort is focused on the most impactful problems.

As the AI agent, I need to re-run only the affected agents after fixing so that resolution is confirmed without unnecessary re-verification.

#### review-deck-swarm (5-agent personality review)

As the AI agent, I need to ask the user which project to review and who the audience is so that the personality-based reviews are audience-calibrated.

As the AI agent, I need to run `npm run capture` once to get screenshots and `report.json` so that all 5 agents review the same snapshot.

As the AI agent, I need to launch 5 parallel agents with distinct personalities -- The Impatient Executive (90-second attention test), The Design Eye (visual rhythm and typography), The Skeptical Analyst (numbers and consistency), The Confused Newcomer (clarity and jargon), The Nitpicker (overflow, typos, alignment) -- so that the deck is reviewed from 5 human perspectives.

As the AI agent, I need to consolidate findings by deduplicating issues, grouping by slide, preserving the highest severity any agent assigned, and keeping the personality voice in quotes so that the report is both organized and vivid.

As the AI agent, I need to present the consolidated report and let the user decide what to fix (NO auto-fix) so that the user retains full triage authority over subjective findings.

### F. Quality Enforcement (fix-warnings, stop hook)

As the AI agent, I need to run `npm run check -- --project /abs/path` to get quality warnings so that I know exactly what the deck-quality checker has flagged.

As the AI agent, I need to read the fix instruction for each warning and edit the affected `slide.html` or `theme.css` accordingly so that every warning is addressed with a targeted fix.

As the AI agent, I need to stay within the cascade contract during fixes (no inline styles, no `!important`, content < theme < canvas) so that fixes do not introduce new policy violations.

As the AI agent, I need to re-run `npm run check` after fixing all warnings so that I confirm the warnings are resolved.

As the AI agent, I need to fix any new warnings that appear after fixing the first batch and repeat until 0 warnings remain so that the deck reaches a clean state.

As the AI agent, I need to understand that the stop hook (`check-slide-quality.mjs`) runs automatically after every response: if 0 warnings, it auto-stages and auto-commits changed files and exits cleanly; if N warnings, it prints each warning to stderr and exits with code 2, which forces me to continue fixing so that I cannot stop while quality issues exist.

As the AI agent, I need to read the warning output from the stop hook (format: `[rule] [slideId]\n  message\n  Fix: fix-instruction`) and apply each fix instruction so that I can resolve warnings efficiently.

As the AI agent, I need to report how many warnings were found, what changed for each one, and whether check now passes clean so that the user has a complete fix-warnings summary.

### G. Handoff

As the AI agent, I need to report the project folder path (absolute), PDF path, screenshot directory, and summary path so that the user can find every output artifact.

As the AI agent, I need to report whether the project is in linked or copied mode (for new projects) so that the user understands the framework dependency relationship.

As the AI agent, I need to report what changed (for revisions) -- listing modified slides and theme changes -- so that the user can see exactly what was revised.

As the AI agent, I need to report any open questions that still need the user's decision so that ambiguous items are surfaced rather than silently resolved.

As the AI agent, I need to report quality scores and findings (for verify-deck / review-deck-swarm) with individual agent scores so that the user has a complete quality assessment.

---

## 4. Permitted Actions

### File Edits

| Action | Target | Constraints |
|--------|--------|-------------|
| Create or edit theme.css | `<project>/theme.css` | Must use `@layer theme`. Must not override protected canvas selectors. Must not use `!important`. Defines the deck-wide visual system: colors, typography, shadows, radii, component styles. |
| Create or edit slide HTML | `<project>/slides/NNN-id/slide.html` | One root fragment per file (a single element with class `.slide`, `.slide-wide`, or `.slide.slide-hero`). No outer wrappers (`<html>`, `<head>`, `<body>`, `<section data-slide>`). No inline `style=""`. No `<style>` blocks. No `[[TODO_...]]` markers. |
| Create or edit slide CSS | `<project>/slides/NNN-id/slide.css` | Optional. Must use `@layer content`. Must scope all selectors to `#slide-id`. Must not use `!important`. Must not restyle theme primitives with colors, typography, borders, or shadows. Must not target other slides. |
| Create or edit brief.md | `<project>/brief.md` | Normalized user request. Must not be empty. Must not contain unfilled `[[TODO_...]]` markers or `{{DECK_TITLE}}` tokens. |
| Create or edit outline.md | `<project>/outline.md` | Story structure and per-slide design decisions. Required for decks with more than 10 slides. Must not contain unfilled `[[TODO_...]]` markers. |
| Create or edit revisions.md | `<project>/revisions.md` | Feedback and change log. Updated during revise-deck workflow. |
| Add or replace deck-shared assets | `<project>/assets/` | Images, logos, diagrams shared across multiple slides. Referenced with relative paths from slide HTML or theme CSS. |
| Add or replace slide-local assets | `<project>/slides/NNN-id/assets/` | Images specific to one slide. Referenced with relative paths from that slide's HTML. |
| Create new slide folders | `<project>/slides/NNN-id/` | Use sparse numbering (010, 020, 030). Folder may contain only `slide.html`, optional `slide.css`, and optional `assets/` directory. |
| Rename, reorder, or delete slide folders | `<project>/slides/NNN-id/` | Maintain sparse numbering. Ensure `outline.md` is updated to match. |

### CLI Commands

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `npm run setup` | Install dependencies | One-time, at first use |
| `npm run new -- --project /abs/path` | Scaffold a new project | Starting a new deck |
| `npm run new -- --project /abs/path --slides N` | Scaffold with N slides | Starting a deck that needs 10+ slides |
| `npm run new -- --project /abs/path --copy-framework` | Scaffold with vendored framework | When project needs portability |
| `npm run check -- --project /abs/path` | Validate policy + quality | After each batch of slides, after fixes |
| `npm run capture -- --project /abs/path [output-dir]` | Capture screenshots + report.json | During verify-deck, review-deck-swarm |
| `npm run export -- --project /abs/path [output.pdf]` | Export PDF | When only PDF is needed |
| `npm run finalize -- --project /abs/path` | Full pipeline: check, capture, export, report | At the end of every creation or revision workflow |

### Design Decisions

The agent makes the following creative and structural decisions during deck creation:

- **Structural primitive selection per slide:** Choose from `.g2` (two-column comparison), `.g3` (three-column features), `.g4` (four-column items), `table` (structured data), `.tkwy` (callout/takeaway), `.icard` (information cards), `.stat-card` + `.stat-value` + `.stat-label` (numeric metrics), `.badge` variants (category labels), `.flex` layouts, and narrative text blocks (`.body-lg` + `.max-w-650`).
- **Slide mode selection:** `.slide` for light-background content slides, `.slide.slide-hero` for dark-background punctuation slides (opening, closing, narrative breaks).
- **Theme token definition:** Accent and semantic colors, card and background colors, text colors, shadows, radii, font families, hero background colors, export bar colors, logo assets.
- **Layout variety across the deck:** No more than 50% of content slides should use the same primary content block. No more than 2 consecutive content slides should use the same layout. The agent must be able to explain why each slide looks different from its neighbors.
- **Image placement:** Team headshots (`.img-circle`), product screenshots (`.img-round`), architecture diagrams. Decks with 10+ slides must include at least some images.
- **Reveal animation classes:** `.rv` (fade up), `.rv-l` (slide from left), `.rv-r` (slide from right), `.rv-s` (scale up).
- **Spacing utilities:** `.mt-2xs`, `.mt-xs`, `.mt-sm`, `.mt-md`, `.mt-lg`, `.mt-xl`, `.mb-xs`, `.mb-sm`, `.gap-xs`, `.gap-sm`, `.gap-base`, `.gap-md`, `.gap-lg`, `.gap-xl`.
- **Text width constraints:** `.max-w-550`, `.max-w-600`, `.max-w-650` for readable line lengths on narrative slides.

### Multi-Agent Orchestration

- Launch 6 parallel verification agents (verify-deck) with independent capture runs and specialized checklists.
- Launch 5 parallel personality review agents (review-deck-swarm) sharing a single capture output.
- Synthesize findings from multiple agents into a single prioritized report.
- Re-run only affected agents after fixes to confirm resolution.

### Self-Inspection

- Read preview at `/preview/` to verify visual quality during development.
- Read screenshot PNGs (`outputs/slides/slide-*.png`) for visual analysis.
- Read `outputs/report.json` for structured data: overflow detection, console errors, grid alignment, typography metrics, DOM structure.
- Read `outputs/summary.md` for human-readable status.
- Compare design intent (recorded in `outline.md`) against actual rendered output.

---

## 5. Restricted Actions

### Structural Violations

**DO NOT edit `framework/canvas/` files.**
Rationale: Canvas CSS defines structural primitives (`.slide`, `.g2`, `.g3`, `.g4`, `.rv`, `.dot-nav`, `.export-bar`) shared across all decks. Changing them would break every project that depends on the framework.

**DO NOT edit `framework/client/` files.**
Rationale: Client JavaScript controls browser behavior (navigation, keyboard shortcuts, animations, export bar, dot-nav). These are framework-owned behaviors, not deck-specific behaviors.

**DO NOT edit `framework/runtime/` files.**
Rationale: Runtime modules handle assembly, validation, capture, export, and finalization. Changing them would alter the behavior of every project.

**DO NOT edit `templates/` files.**
Rationale: Templates are scaffolding defaults that define the starting point for every new project. Changing them affects all future projects, not just the current deck.

**DO NOT edit `.presentation/project.json`.**
Rationale: Project metadata is managed by the runtime. It records framework mode, version, project slug, and other system state. Manual edits can corrupt the project.

**DO NOT edit rendered HTML output or preview directly.**
Rationale: The preview is assembled on-demand from source files (theme.css + slide HTML). Direct edits to rendered output are overwritten on the next assembly. All changes must go through the source files.

### Cascade Violations

**DO NOT use inline `style=""` attributes.**
Rationale: Inline styles bypass the CSS cascade contract. All styling must go through CSS layers so the framework can enforce ownership boundaries. The policy validator catches this and blocks check/finalize.

**DO NOT use `!important` in `theme.css` or `slide.css`.**
Rationale: `!important` breaks cascade priority guarantees. Canvas must remain authoritative over theme, and theme must remain authoritative over content. The policy validator catches this and blocks check/finalize.

**DO NOT use raw `<style>` blocks inside `slide.html`.**
Rationale: All styling belongs in `theme.css` (deck-wide) or `slide.css` (slide-scoped). Style blocks in slide HTML bypass layer ordering and cannot be scoped by the policy checker. The policy validator catches this and blocks check/finalize.

**DO NOT change `@layer content, theme, canvas` declaration order.**
Rationale: This declaration is the foundation of the entire cascade system. It establishes that canvas is highest-priority, theme is middle, and content is lowest. Changing it would invert the ownership model.

**DO NOT redefine protected canvas selectors from `theme.css` or `slide.css`.**
Rationale: Canvas primitives (`.slide`, `.slide-wide`, `.slide-hero`, `.g2`, `.g3`, `.g4`, `.flex`, `.flex-col`, `.flex-center`, `.flex-between`, `.rv`, `.rv-l`, `.rv-r`, `.rv-s`, `.dot-nav`, `.export-bar`, all spacing utilities `.mt-*`, `.mb-*`, `.gap-*`, text width constraints `.max-w-*`, and layout utilities `.flex-1`, `.flex-wrap`, `.items-center`, `.justify-center`, `.text-center`, `.w-full`) are structurally authoritative. The policy validator catches overrides and blocks check/finalize.

**DO NOT create theme CSS that overrides canvas layout behavior.**
Rationale: Theme defines visual appearance (colors, typography, shadows, border radii). Canvas defines structural layout (grids, flex, spacing, dimensions). These are separate concerns. Theme must not interfere with canvas layout.

### Scoping Violations

**DO NOT create `slide.css` selectors not scoped to `#slide-id`.**
Rationale: Each slide is isolated. Unscoped selectors in slide CSS leak into other slides. The policy validator checks that every selector in `slide.css` begins with `#<slide-id>` and blocks if it does not.

**DO NOT create `slide.css` that targets another slide.**
Rationale: Slide CSS must only affect its own slide. Cross-slide targeting breaks isolation and creates unpredictable cascade interactions.

**DO NOT create `slide.css` that redefines theme primitives with colors, typography, borders, or shadows.**
Rationale: Visual appearance belongs in `theme.css`. Slide CSS may compose layout, but redefining `.icard`, `.badge`, `.stat-card`, `.tkwy`, `.eyebrow`, `.hero-title`, `.sect-title`, `.body-lg`, `.body-text`, `.body-strong`, `.body-emphasis`, `.body-text-dim`, `.text-accent`, `.text-muted`, `.divider`, `table`, `th`, or `td` with color/font/border/shadow declarations from slide CSS would create visual inconsistency. The policy validator catches this.

**DO NOT include `<html>`, `<head>`, `<body>`, or `<section data-slide>` wrappers in `slide.html`.**
Rationale: The runtime generates the outer structure. Including these wrappers creates duplicate containers and breaks layout. The policy validator catches this.

### Asset Violations

**DO NOT use root-relative asset paths.**
Rationale: Assets must be project-local. Root-relative paths (starting with `/`) would reference framework files or system paths, breaking project portability.

**DO NOT use cross-workspace or sibling-slide asset references.**
Rationale: Each project is self-contained. Cross-project or cross-slide asset references break isolation. The policy validator checks asset paths against allowed roots and blocks violations.

### Process Violations

**DO NOT build slide HTML before designing theme.**
Rationale: Building slides without a finalized theme leads to inconsistent styling, visual drift, quality warnings, and a forced rework cycle. Theme-first ensures all slides share a cohesive visual system from the start.

**DO NOT build slide HTML before making per-slide design decisions.**
Rationale: Without a design plan, the agent defaults to repetitive layouts (e.g., `.g3` of `.icard` on every slide). The design decision must happen before construction so that each slide is tailored to its content.

**DO NOT skip `outline.md` for decks with 10+ slides.**
Rationale: The story arc must be locked before buildout. The policy validator enforces that `outline.md` exists and does not contain unfilled TODO markers for decks exceeding the 10-slide threshold.

**DO NOT build all slides at once for decks with 10+ slides.**
Rationale: Building in batches of 5 with `npm run check` between batches catches policy violations and quality warnings early. Building all slides at once risks accumulating errors that are harder to fix in bulk.

**DO NOT use `.stat-card` for names, roles, or text labels.**
Rationale: `.stat-card` is a numeric metric display component (`.stat-value` + `.stat-label`). Using it for non-numeric content (names, job titles, text labels) is a semantic misuse. The quality checker detects `.stat-value` elements that contain no digits and flags them.

**DO NOT use the same grid layout on every content slide.**
Rationale: Design quality requires visual variety. The quality checker flags decks where more than 50% of content slides use the same primary content block and decks where 3+ consecutive content slides use the same layout.

**DO NOT skip verification before finalizing.**
Rationale: Unvalidated decks may have policy violations (hard stops) or quality warnings (soft stops enforced by the stop hook). Skipping verification risks shipping broken or low-quality work.

**DO NOT auto-fix NOTE-level issues.**
Rationale: NOTE-level findings are subjective observations. Only fix CRITICAL (must fix) and WARNING (should fix). The user has triage authority over NOTE/TASTE items.

**DO NOT bypass the stop hook.**
Rationale: The stop hook is the quality gate. If it reports warnings, the agent must fix them. Attempting to bypass the hook (or ignoring its output) would allow quality-degraded work to be committed.

---

## 6. Action-Consequence Matrix

| AI Action | System Response | Outcome |
|-----------|----------------|---------|
| Write `slide.html` with inline `style=""` | Policy validation catches it during `check`/`finalize` | Check fails, finalize blocked. Agent must remove inline style and move styling to `theme.css` or `slide.css`. |
| Use `!important` in `theme.css` | Policy validation catches it during `check`/`finalize` | Check fails, finalize blocked. Agent must remove `!important` and achieve the styling through variables and semantic primitives. |
| Use raw `<style>` block in `slide.html` | Policy validation catches it during `check`/`finalize` | Check fails, finalize blocked. Agent must extract CSS to `theme.css` (deck-wide) or `slide.css` (slide-scoped). |
| Create `slide.css` selector not scoped to `#slide-id` | Policy validation catches it during `check`/`finalize` | Check fails, finalize blocked. Agent must prefix every selector with `#slide-id` (e.g., `#intro .custom-box`). |
| Create `slide.css` that redefines theme primitives with visual declarations | Policy validation catches it during `check`/`finalize` | Check fails. Agent must move color/typography/border/shadow declarations to `theme.css`. |
| Include `<section data-slide>` wrapper in `slide.html` | Runtime generates duplicate wrapper during assembly | Broken layout -- double-wrapped slide. Policy validator flags forbidden tags. Agent must remove the wrapper. |
| Edit `framework/canvas/` file | Outside edit lane | Contract violation. No automated guard in the AI context, but `file-boundaries` rule prohibits it. Agent must revert and find a deck-level solution. |
| Run `npm run check` with no issues | Returns exit 0 | Deck is policy-compliant and quality-clean. Agent can proceed to finalize. |
| Run `npm run check` with quality warnings | Returns warnings with fix instructions | Agent must read each warning, apply the fix instruction, and re-run check. Warnings are also enforced by the stop hook. |
| Run `npm run check` with policy violations | Returns error and exits with code 1 | Hard stop. Agent must fix structural violations (remove inline styles, fix scoping, etc.) before anything else works. |
| Run `npm run finalize` | Runs check, then capture, then export, then report | Produces `outputs/deck.pdf`, `outputs/slides/`, `outputs/report.json`, `outputs/full-page.png`, `outputs/summary.md`. Exits 0 on success, 1 on failure. |
| Stop hook fires with 0 warnings | Auto-stages all changed files (`git add -A`), auto-commits with descriptive message (`Update: file1, file2, ...`) | Agent can stop cleanly. Work is committed to local git history. |
| Stop hook fires with N warnings | Prints each warning to stderr with format: `[rule] [slideId]\n  message\n  Fix: fix-instruction`. Prints summary. Exits with code 2. | Agent CANNOT stop. Must read warnings, apply fix instructions, and continue. Next response triggers the hook again. |
| Design theme before slides | Consistent visual system across all slides | Fewer quality warnings, faster iteration, cohesive deck. |
| Skip theme design | Inconsistent colors/typography/spacing across slides | Quality warnings accumulate, forced rework cycle, visual incoherence. |
| Build all slides with same grid (e.g., `.g3` on every slide) | Passes policy but fails design quality rule | `layout-variety` quality warning fires. `component-diversity` may also fire. Agent must redesign slides for variety. |
| Build 3+ consecutive slides with same layout | Quality checker detects the run | `consecutive-same-layout` warning fires. Agent must break the visual rhythm by changing at least one slide's layout. |
| Use `.stat-card` for non-numeric content (e.g., job titles) | Quality checker detects `.stat-value` without digits | `stat-card-misuse` warning fires. Agent must replace with `.icard` using `.body-text.body-strong` for the heading. |
| Build 10+ slide deck with zero images | Quality checker detects entirely typographic deck | `image-coverage` warning fires. Agent must add images where they serve content (headshots, screenshots, diagrams). |
| Launch verify-deck | 6 parallel capture + analysis agents | Each agent captures independently, reads `report.json` + screenshot PNGs, produces findings with CRITICAL/WARNING/NOTE severity and slide IDs. Orchestrator synthesizes into single report with overall score. |
| Launch review-deck-swarm | 5 personality agents share a single capture | Each agent reviews from a unique human perspective. Orchestrator consolidates findings, deduplicates, groups by slide, preserves highest severity. User triages -- NO auto-fix. |
| Run `npm run capture` | Playwright headless renders each slide | Screenshots saved to output directory. `report.json` generated with structural data: overflow detection, console errors, grid alignment, typography metrics, inner card data, consistency analysis. |
| Run `npm run export` | Playwright renders full deck | PDF generated at specified path or default `outputs/deck.pdf`. |
| Create slide folder with non-sparse numbering (1, 2, 3) | Works but impedes future insertion | Future slides require renumbering the entire deck. Agent should use 010, 020, 030 for insertability. |
| Add image to wrong assets directory | Asset reference may break during assembly | Policy validator checks asset paths against allowed roots. Use `assets/` for deck-shared, `slides/NNN-id/assets/` for slide-local. |
| Leave `[[TODO_...]]` markers in `brief.md` or `outline.md` | Policy validation catches unfilled scaffold tokens | Check fails. Agent must replace all TODO markers with actual content. |
| Leave `{{DECK_TITLE}}` token in `brief.md` | Policy validation catches unfilled scaffold token | Check fails. Agent must replace with the actual deck title. |
| Create slide folder with invalid name pattern | Policy validation catches invalid folder name | Check fails. Agent must rename to use the `NNN-slug-id` pattern with lowercase letters, numbers, and hyphens. |
| Create two slide folders with same order prefix | Policy validation catches duplicate order | Check fails. Agent must renumber one of the folders. |

---

## 7. Quality Gates

### Gate 1: Stop Hook (check-slide-quality.mjs)

**Trigger:** Runs automatically after every Claude response. This is a Claude Code "Stop" event hook -- whenever the AI agent finishes a response and attempts to stop, this script executes.

**Preconditions:** The hook only runs if BOTH conditions are met:
1. The project has `.presentation/project.json` (confirming it is a scaffolded presentation project)
2. The project has a `slides/` directory

If either condition is missing, the hook exits 0 silently and does not interfere.

**Precondition -- valid slides:** The hook reads slide source entries and filters for valid folder names. If zero valid slide entries exist (project is still being scaffolded), the hook exits 0 silently.

**Process:**
1. Reads the hook input from stdin (JSON with `cwd` field)
2. Determines the project root from the input
3. Reads `.presentation/project.json` to find the framework source path
4. Imports `deck-quality.js` from the framework
5. Imports `deck-source.js` from the framework to list slide source entries
6. Imports `deck-paths.js` from the framework to resolve project paths
7. Filters entries for valid names and runs quality checks

**Clean pass (0 warnings):**
- Auto-stages all changed files: `git add -A`
- Checks if there are staged changes: `git diff --cached --quiet`
- If changes exist, commits with descriptive message: `Update: file1, file2, ...` (lists up to 3 changed files, then `+N more`)
- Exits with code 0
- The AI agent can stop cleanly

**Warnings found (N > 0):**
- Prints each warning to stderr with this exact format:
  ```
  [rule] [slideId]
    message
    Fix: fix-instruction
  ```
- Prints summary: `N quality warning(s). Fix them before stopping.`
- Exits with code 2
- The AI agent MUST continue fixing -- it cannot stop while warnings exist
- On the next response, the agent reads the warnings, applies the fix instructions, and responds
- The hook runs again at the end of that response, creating a tight feedback loop

**Effect:** This is the primary enforcement mechanism that prevents the AI agent from shipping work with quality issues. The agent is in a loop: respond -> hook checks -> if warnings, keep going -> respond -> hook checks -> until clean. The fix instructions guide the agent toward resolution, making the loop converge.

**Quality rules checked by the hook (via `deck-quality.js`):**

| Rule | Trigger Condition | Warning Message |
|------|-------------------|-----------------|
| `layout-variety` | More than 50% of content slides (non-hero) use the same primary content block (.g2, .g3, .g4, table, .tkwy) | `N% of content slides use .X. The deck looks monotonous.` |
| `consecutive-same-layout` | 3+ consecutive content slides use the same primary content block | `N consecutive slides all use .X.` |
| `stat-card-misuse` | A `.stat-value` element contains text with no digits | `stat-value contains "text" which is not a number. stat-card is for numeric metrics.` |
| `image-coverage` | A deck with 10+ slides has zero `<img>` tags | `N-slide deck has zero images. The deck is entirely typographic.` |
| `component-diversity` | A deck with 8+ content slides uses only 1 (or 0) distinct primary content block types | `All N content slides use the same content block type. The deck has no visual variety.` |

### Gate 2: Policy Validation (deck-policy.js)

**Trigger:** Runs during `npm run check`, `npm run finalize`, and preview assembly (any time the runtime serves or exports the deck).

**Scope:** Validates the entire deck workspace -- slide source files, `theme.css`, optional `slide.css` files, `brief.md`, `outline.md` (for 10+ slide decks), folder naming, and the assembled HTML document.

**Validation performed on theme.css:**
- Must contain `@layer theme` (all rules wrapped in theme layer)
- Must not contain `!important`
- Must not redefine any protected canvas selector (`.slide`, `.g2`, `.g3`, `.g4`, `.flex`, `.flex-col`, `.flex-center`, `.flex-between`, `.rv`, `.rv-l`, `.rv-r`, `.rv-s`, `.dot-nav`, `.export-bar`, all spacing utilities, text width constraints, layout utilities, `html`, `body`, `img`, `section[data-slide]`)
- CSS asset references (e.g., `url(...)`) must resolve to allowed project-local roots

**Validation performed on slide.html:**
- Must not contain `[[TODO_...]]` markers
- Must not contain inline `style=""` attributes
- Must not contain `<style>` blocks
- Must not contain `<html>`, `<head>`, `<body>`, `<section>`, or `data-slide` wrappers
- Must contain exactly one slide root element with class `.slide`, `.slide-wide`, or `.slide-hero`
- Slide root must be the first element in the file (no wrapper nodes)
- HTML asset references (`src`, `href`, `poster`) must resolve to allowed project-local roots

**Validation performed on slide.css:**
- Must contain `@layer content` (all rules wrapped in content layer)
- Must not contain `!important`
- Every selector must start with `#<slide-id>` (scope enforcement)
- Must not target protected canvas selectors (even within the slide scope)
- Must not restyle theme primitives (`.icard`, `.badge`, `.stat-card`, `.tkwy`, `.eyebrow`, `.hero-title`, `.sect-title`, `.body-lg`, `.body-text`, `.body-strong`, `.body-emphasis`, `.stat-value`, `.stat-label`, `.stat-value-compact`, `.body-text-dim`, `.text-accent-light`, `.text-on-dark-soft`, `.text-accent`, `.text-green`, `.text-muted`, `.bg-accent`, `.img-round`, `.img-circle`, `.divider`, `table`, `th`, `td`) with color, background, font-size, font-family, font-weight, line-height, letter-spacing, text-transform, border, border-color, border-radius, or box-shadow declarations
- CSS asset references must resolve to allowed project-local roots

**Validation performed on brief.md:**
- Must not be empty
- Must not contain `[[TODO_...]]` markers or `{{DECK_TITLE}}` tokens

**Validation performed on outline.md (required for 10+ slide decks):**
- Must exist
- Must not be empty
- Must not contain `[[TODO_...]]` markers or `{{DECK_TITLE}}` tokens

**Validation performed on workspace structure:**
- `theme.css` must exist
- `brief.md` must exist
- At least one slide folder must exist under `slides/`
- No duplicate order prefixes across slide folders
- No duplicate slide IDs across slide folders
- Slide folders must match the `NNN-slug-id` naming pattern (lowercase letters, numbers, hyphens)
- Each slide folder may contain only `slide.html`, optional `slide.css`, and optional `assets/` directory

**Validation performed on assembled HTML document:**
- Must contain the exact layer declaration `@layer content, theme, canvas;`
- Must not contain inline `style=""` attributes
- All `<style>` blocks must begin with `@layer` (no unlayered CSS)

**Failure mode:** Hard stop. Throws an error with a detailed message listing every violation. The error message includes the source file name and specific fix instructions for each violation. `npm run check` exits with code 1. `npm run finalize` exits with code 1. Preview assembly fails.

**Effect:** Policy violations are impossible to ship. The deck cannot be previewed, checked, captured, exported, or finalized until every structural violation is resolved.

### Gate 3: Quality Checks (deck-quality.js)

**Trigger:** Runs during `npm run check` (also called by the stop hook independently).

**Scope:** Evaluates design quality across the full set of slides -- layout variety, component diversity, stat-card usage, image coverage, consecutive layout runs.

**Output:** An array of warnings, each with `rule`, `slideId`, `message`, and `fix` fields. These are not hard stops during `npm run check` -- they are reported as warnings with fix instructions.

**Rules:** See the table in Gate 1 above for the complete rule set.

**Effect:** Soft enforcement during `npm run check` (warnings are printed but do not block the command). Hard enforcement through the stop hook (the hook converts these same warnings into a blocking gate that prevents the agent from stopping).

### Gate 4: Multi-Agent Review (verify-deck)

**Trigger:** Manual invocation by the human via `/verify-deck` skill.

**Scope:** 6 independent verification angles:

1. **Visual Consistency** -- Colors, spacing, shadows, branding elements, visual coherence. Checks logo placement consistency, color uniformity, shadow/border consistency, spacing rhythm, and overall polish.
2. **Data Accuracy** -- Numbers, statistics, internal consistency. Checks `data-count` attributes, cross-slide number consistency, table integrity, factual claims, and reference document cross-referencing.
3. **Content Quality** -- Writing quality, completeness, placeholder detection. Checks for TODO/placeholder text, grammatical errors, content structure, slide density, and audience appropriateness.
4. **Audience Calibration** -- Tone, information hierarchy, persuasion structure, visual appropriateness. Checks whether the deck is properly tailored for its stated target audience.
5. **Typography & Readability** -- Font sizes, contrast, text overflow, readability at PDF export size (960x540 points). Checks `overflowDetected` in `report.json`, font hierarchy, weight usage, contrast ratios, line length, and vertical rhythm.
6. **Slide Structure & Symmetry** -- Grid alignment, card symmetry, aspect ratios, slide ordering, structural completeness. Checks grid child alignment, 16:9 aspect ratio compliance, slide composition balance, and `data-slide` integrity.

**Process:** Each agent independently runs `npm run capture` to get its own screenshots and `report.json`. Each agent reads the structured data and visually inspects every screenshot PNG. Each agent produces findings with CRITICAL/WARNING/NOTE severity and slide IDs.

**Output:** Orchestrator synthesizes all findings into a single report with overall score (average of 6 agent scores), findings grouped by severity, and individual agent scores.

**Effect:** Human-triaged. The AI presents the report and asks "Should I fix the CRITICAL and WARNING issues?" The human decides. The AI only fixes what is approved. After fixing, only affected agents are re-run to confirm resolution.

### Gate 5: Multi-Personality Review (review-deck-swarm)

**Trigger:** Manual invocation by the human via `/review-deck-swarm` skill.

**Scope:** 5 distinct human perspectives:

1. **The Impatient Executive** -- Sees 20 decks a week. Gives 90 seconds. Tests whether the first slide hooks, whether the thesis is clear in 10 seconds, and whether the ask is obvious.
2. **The Design Eye** -- Design director who has built pitch decks for startups. Evaluates visual rhythm, typography, component usage, and whether a human designer would approve.
3. **The Skeptical Analyst** -- Due diligence analyst. Checks numbers, cross-slide consistency, mathematical plausibility of growth claims, and market size assumptions.
4. **The Confused Newcomer** -- Intelligent person with no domain knowledge. Reports where confusion starts, whether the company's purpose is clear after 3 slides, and where jargon blocks understanding.
5. **The Nitpicker** -- Proofreader and production QA specialist. Reads `report.json` for overflow detection. Examines every screenshot for typos, alignment issues, inconsistent formatting, orphan elements, and text clipping. Exhaustive and unforgiving.

**Process:** A single `npm run capture` run produces screenshots and `report.json`. All 5 agents review the same snapshot. Each agent uses CRITICAL/WARNING/TASTE severity levels (TASTE replaces NOTE to indicate subjective opinion).

**Output:** Consolidated findings: deduplicated, grouped by slide, highest severity preserved, personality voice quoted.

**Effect:** Human-triaged exclusively. The agent presents the report and asks which issues to fix. The user triages. The agent does NOT auto-fix anything -- the user always has final authority over subjective findings.

---

## 8. Workflow State Machine

### New-Deck Creation Flow

```
[Human invokes /new-deck or gives plain-English request]
                    |
                    v
Read contract (.claude/CLAUDE.md + .claude/rules/*)
                    |
                    v
Run npm run setup (if dependencies not installed)
                    |
                    v
Scaffold project:
  npm run new -- --project /abs/path [--slides N] [--copy-framework]
                    |
                    v
Write brief.md (normalize user's request)
                    |
                    v
         [Deck has 10+ slides?]
          /                   \
        YES                   NO
         |                     |
         v                     |
Fill outline.md               |
(story arc + slide plan       |
 + design decisions)          |
         |                     |
         v                     v
Design theme.css
(complete visual system: palette, typography,
 shadows, radii, font families, component styles)
(@layer theme)
                    |
                    v
Design each slide
(decide primitives per slide, differentiation
 from neighbors, image needs)
                    |
                    v
         [Deck has 10+ slides?]
          /                   \
        YES                   NO
         |                     |
         v                     |
Record design decisions       |
in outline.md                 |
         |                     |
         v                     v
Build slide HTML
(slides/NNN-id/slide.html, one root fragment per file)
                    |
                    v
         [Deck has 10+ slides?]
          /                   \
        YES                   NO
         |                     |
         v                     v
Build in batches          Build all slides
of 5 slides               then run check
         |
         v
npm run check -- --project /abs/path
after each batch
         |
         v
         [Warnings?] ------YES-----> Fix warnings
              |                         |
              NO                        |
              |                         v
              |                   Re-run check
              |                         |
              |<-------NO---------[Warnings?]
              |
              v
Inspect preview / screenshots / PDF
(visual self-inspection -- does it look
 like a presentation?)
              |
              v
    [Presentation-ready?]
     /                 \
   YES                 NO
    |                   |
    |                   v
    |            Revise theme.css
    |            or slide.css
    |                   |
    |                   v
    |            Re-run check
    |                   |
    |<------------------+
    |
    v
npm run finalize -- --project /abs/path
(check -> capture -> export -> report)
              |
              v
Report handoff:
  1. Project folder path (absolute)
  2. Linked or copied mode
  3. PDF path (outputs/deck.pdf)
  4. Screenshot directory (outputs/slides/)
  5. Summary path (outputs/summary.md)
  6. Open questions needing user decision
```

### Revise-Deck Flow

```
[Human invokes /revise-deck or gives revision feedback]
                    |
                    v
Read contract (.claude/CLAUDE.md + .claude/rules/*)
                    |
                    v
Convert feedback into revisions.md
                    |
                    v
         [Deck has 10+ slides?]
          /                   \
        YES                   NO
         |                     |
         v                     |
Refresh outline.md            |
(ensure story matches         |
 slide sequence)              |
         |                     |
         v                     |
   [Revision affects 5+ slides?]
     /              \          |
   YES              NO         |
    |                |         |
    v                |         |
Re-evaluate          |         |
per-slide design     |         |
plan in outline      |         |
    |                |         |
    v                v         v
Revise theme.css + slide folders
                    |
                    v
         [Deck has 10+ slides?]
          /                   \
        YES                   NO
         |                     |
         v                     v
Revise in batches         Revise all then
of 5, check between      run check
         |                     |
         v                     v
         [Warnings?] ------YES-----> Fix warnings -> re-run check
              |
              NO
              |
              v
Inspect regenerated preview / screenshots / PDF
              |
              v
    [Presentation-ready?]
     /                 \
   YES                 NO --> Revise theme.css/slide.css -> re-check
    |
    v
npm run finalize -- --project /abs/path
              |
              v
Report handoff:
  1. Project folder path
  2. PDF path
  3. Screenshot directory
  4. Summary path
  5. What changed (list of modified slides/theme)
  6. What still needs user's decision
```

### Fix-Warnings Flow

```
[Human invokes /fix-warnings]
              |
              v
npm run check -- --project /abs/path
              |
              v
Read QUALITY WARNINGS output
              |
              v
For each warning:
  1. Read the fix instruction
  2. Edit affected slide.html or theme.css
  3. Stay within cascade contract
              |
              v
npm run check -- --project /abs/path
              |
              v
    [New warnings?]
     /            \
   YES            NO
    |              |
    v              v
Fix new        Report:
warnings         1. How many warnings found
    |              2. What changed for each
    v              3. Check now passes clean
Re-run check
    |
    +-----> [Repeat until 0 warnings]
```

### Stop Hook Feedback Loop (runs automatically)

```
[Agent finishes a response]
              |
              v
Stop hook fires (check-slide-quality.mjs)
              |
              v
   [Has .presentation/project.json?]
     /                    \
   NO                    YES
    |                     |
    v                     v
Exit 0              [Has slides/ directory?]
(silent)              /                \
                    NO                YES
                     |                 |
                     v                 v
                  Exit 0          [Valid slide entries?]
                  (silent)          /              \
                                  NO              YES
                                   |               |
                                   v               v
                                Exit 0       Run quality checks
                                (silent)           |
                                                   v
                                          [0 warnings?]
                                           /          \
                                         YES          NO
                                          |            |
                                          v            v
                                   git add -A     Print warnings
                                   git commit     to stderr
                                   Exit 0         Exit 2
                                   (clean)        (agent must
                                                   continue)
```

---

## 9. Handoff Protocol

### For new-deck

The agent MUST report all of the following when a new deck creation is complete:

1. **Project folder path** -- The absolute filesystem path to the project directory (e.g., `/Users/name/presentations/my-deck`).
2. **Framework mode** -- Whether the project is "linked" (references the installed framework) or "copied" (has a vendored framework snapshot via `--copy-framework`).
3. **PDF path** -- The absolute path to the exported PDF (e.g., `/Users/name/presentations/my-deck/outputs/deck.pdf`).
4. **Screenshot directory** -- The absolute path to the per-slide screenshots (e.g., `/Users/name/presentations/my-deck/outputs/slides/`).
5. **Summary path** -- The absolute path to the human-readable summary (e.g., `/Users/name/presentations/my-deck/outputs/summary.md`).
6. **Open questions** -- Any decisions that still need the user's input (e.g., "I used placeholder team headshots -- please provide actual photos", or "The deck has 12 slides but the brief mentioned 15 -- should I add 3 more?").

### For revise-deck

The agent MUST report:

1. **Project folder path** -- Absolute path.
2. **PDF path** -- Absolute path to the updated PDF.
3. **Screenshot directory** -- Absolute path to the updated screenshots.
4. **Summary path** -- Absolute path to the updated summary.
5. **What changed** -- A specific list of modifications: which slides were added, removed, or modified; whether `theme.css` was changed; what content was revised.
6. **What still needs the user's decision** -- Any ambiguities from the feedback that the agent resolved with a default choice, or items the agent could not resolve.

### For review-deck

The agent MUST report:

1. **Current project folder path** -- Absolute path.
2. **Current PDF path** -- Absolute path to the latest PDF.
3. **Summary path** -- Absolute path to the latest summary.
4. **Top issues or opportunities** -- The most impactful quality issues or areas for improvement.
5. **Exact revision plan recommended** -- Specific, actionable changes the agent recommends, organized by slide.

### For verify-deck / review-deck-swarm

The agent MUST report:

1. **Overall quality score** -- Average of all agent scores (1-10 scale).
2. **All CRITICAL findings** -- Issues that must be fixed. Each with slide ID, agent source, and description.
3. **All WARNING findings** -- Issues that should be fixed. Each with slide ID, agent source, and description.
4. **All NOTE/TASTE findings** -- Subjective observations. Each with slide ID, agent source, and description. User decides.
5. **Individual agent scores** -- A table showing each agent's name and score.

### For fix-warnings

The agent MUST report:

1. **Warning count** -- How many quality warnings were found initially.
2. **What changed** -- For each warning, what file was edited and what the fix was.
3. **Clean status** -- Whether `npm run check` now passes with 0 warnings.

---

## 10. Interaction Model with Human

### 1. Receive Request

The human invokes a skill (`/new-deck`, `/revise-deck`, `/review-deck`, `/review-deck-swarm`, `/verify-deck`, `/fix-warnings`) or gives a plain-English request in the integrated terminal. The AI agent reads the request and determines the intent: is this a new deck, a revision, a review, a verification, or a fix-warnings cycle?

If the request maps to a known skill, the agent follows the skill's instructions. If the request is freeform, the agent maps it to the closest workflow (usually new-deck or revise-deck) and follows the corresponding protocol.

### 2. Read Contract

The AI agent reads `.claude/CLAUDE.md` and all files under `.claude/rules/`. This is non-negotiable -- the agent must understand its boundaries before acting. The contract defines:
- What files are editable and what are protected
- What CSS patterns are legal and what are forbidden
- What structural primitives are available
- What the cascade contract means in practice
- What CLI commands to use for validation and finalization
- What the handoff protocol requires

The agent internalizes these rules as hard constraints, not suggestions. Every subsequent action must comply with the contract.

### 3. Clarify if Needed

If the request is ambiguous, the agent asks clarifying questions before proceeding. Common ambiguities include:
- No clear slide count ("How many slides should the deck have?")
- Unclear audience ("Who will view this presentation?")
- Missing content details ("What specific data or statistics should be included?")
- Ambiguous scope ("Should I redesign the entire deck or just the slides you mentioned?")
- Image requirements ("Do you have specific images to include, or should I use placeholders?")

The agent asks only what it needs to proceed. It does not ask questions it can reasonably answer itself.

### 4. Execute Within Boundaries

The AI agent designs theme, plans slides, and builds HTML. It works ONLY within the editable surfaces:
- `theme.css` -- the deck-wide visual system
- `slides/NNN-id/slide.html` -- slide content
- `slides/NNN-id/slide.css` -- optional slide-local CSS
- `brief.md` -- normalized request
- `outline.md` -- story structure and design decisions
- `revisions.md` -- feedback and change log
- `assets/` -- deck-shared images
- `slides/NNN-id/assets/` -- slide-local images

It uses ONLY the permitted CLI commands (`npm run setup`, `npm run new`, `npm run check`, `npm run capture`, `npm run export`, `npm run finalize`).

It NEVER modifies framework files, rendered output, or project metadata.

### 5. Self-Check

The agent runs `npm run check -- --project /abs/path` after each batch of slides (for 10+ slide decks) or after completing all slides (for smaller decks). If warnings exist, it reads each warning's fix instruction, edits the affected file, and re-runs check. This cycle repeats until 0 warnings remain.

Self-checking is proactive -- the agent does not wait for the stop hook to catch issues. It runs check voluntarily as part of its workflow.

### 6. Hook Enforcement

The stop hook (`check-slide-quality.mjs`) runs automatically after every agent response. If the hook finds warnings:
1. It prints each warning to stderr with the format: `[rule] [slideId]\n  message\n  Fix: fix-instruction`
2. It prints a summary: `N quality warning(s). Fix them before stopping.`
3. It exits with code 2
4. Claude Code interprets exit code 2 as "agent must continue" -- the AI agent cannot stop

The agent reads the warning output, understands the fix instruction, and edits the affected file. This triggers another response, which triggers the hook again. The cycle repeats until the hook returns 0 warnings and exits with code 0.

If the hook finds 0 warnings, it auto-stages all changed files (`git add -A`) and auto-commits with a descriptive message. The agent can then stop cleanly.

### 7. Visual Self-Inspection

The agent inspects the preview, screenshots, and PDF. This is a design judgment step, not just a policy check. The agent asks itself:
- Does the deck read like a presentation, not a document?
- Is there enough visual variety across slides?
- Do colors and typography feel cohesive?
- Are cards and grids aligned properly?
- Is there enough whitespace?
- Would this deck impress the stated audience?

If the answer to any of these is no, the agent revises `theme.css` or `slide.css` before finalizing. It does not wait for the human to point out visual issues.

### 8. Finalize and Report

The agent runs `npm run finalize -- --project /abs/path`, which executes the full pipeline: policy check, quality check, Playwright capture (screenshots + report.json), PDF export, and summary generation.

After finalization, the agent reports all output paths and open questions according to the handoff protocol specific to the workflow type (new-deck, revise-deck, review-deck, verify-deck, review-deck-swarm, or fix-warnings).

### 9. Await Further Direction

After handoff, the AI agent waits for the human's next instruction. It does not auto-start additional work unless asked. It does not preemptively revise, review, or verify the deck. The human always initiates the next workflow.

### 10. Handle Multi-Agent Orchestration

For verify-deck and review-deck-swarm, the AI agent acts as orchestrator:

1. **Gather context** -- Ask the user which project to verify/review and who the target audience is.
2. **Prepare** -- Search for reference documents. Run capture if needed.
3. **Launch agents** -- Start all parallel agents in a single message. Each agent receives full context (project path, framework path, audience, reference docs, capture command, specific checklist).
4. **Wait for completion** -- All agents run independently and report back.
5. **Synthesize** -- Collect all findings, deduplicate, group by slide, preserve highest severity, compute overall score.
6. **Present** -- Show the synthesized report to the human with clear severity groupings and agent attribution.
7. **Triage** -- Ask the human what to fix. For verify-deck: "Should I fix the CRITICAL and WARNING issues?" For review-deck-swarm: "Which issues should I fix?" The human always has final triage authority.
8. **Fix (if approved)** -- Apply approved fixes. For verify-deck: fix CRITICAL first, then WARNING. Do NOT fix NOTE unless asked. Re-run only affected agents to confirm resolution.
9. **Report** -- After fixing, report what changed and confirm resolution.

The human always has final triage authority. The agent never auto-fixes subjective findings.
