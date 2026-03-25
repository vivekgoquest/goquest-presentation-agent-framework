# PRD: Human Agent

Product requirements for the human operator of the Goquest Presentation Framework. This document is self-contained. No other file is required to understand the full intent model.

---

## 1. Persona & Role

The human is the **creative director and operator**. They use an Electron desktop application to create, preview, and export presentation decks. They may author slides manually -- writing HTML, CSS, and markdown files in their preferred editor -- or delegate execution to an AI agent (Claude) via an integrated terminal embedded in the desktop app.

The human makes all final decisions about content, design direction, and quality acceptance. The AI agent proposes and executes; the human reviews and approves. The human can override any AI decision at any time by editing project files directly.

The human is not expected to understand the framework internals. They work exclusively within a **project folder** -- an independent directory scaffolded by the framework that contains all source files, assets, and outputs for a single presentation deck.

### Key characteristics

- Thinks in terms of story, audience, and visual impact -- not in terms of HTML/CSS mechanics
- May be a designer, a founder preparing a pitch, a team lead building an internal deck, or a consultant building a client deliverable
- Values speed (AI does the heavy lifting) and control (human makes the final call)
- Expects professional-quality output: PDF, screenshots, structured reports
- Uses the Electron desktop app as their primary workspace, with a live preview pane on the left and an integrated terminal on the right

---

## 2. Goals

### Primary goals

- **Create professional presentation decks** from scratch or from a plain-English brief
- **Preview slides live** during authoring -- every file save triggers an immediate preview refresh
- **Validate deck quality** before delivery using automated policy checks and multi-agent review swarms
- **Export selected slides** as one combined PDF or individual PNGs, plus screenshot artifacts suitable for distribution, printing, or embedding
- **Collaborate with an AI agent** to accelerate deck creation -- from zero to finalized deck in minutes
- **Maintain creative control** while delegating execution -- the human can intervene at any point in the process

### Secondary goals

- Build a revision history through automatic git commits (the stop hook auto-commits on clean check passes)
- Iterate rapidly on feedback -- provide plain-English revision notes, let the AI update the deck
- Support both small decks (3-5 slides) and large decks (20+ slides) with appropriate workflow scaffolding
- Keep presentation source files simple and portable -- plain HTML, CSS, and markdown

---

## 3. User Stories

### A. Project Lifecycle

1. As a human operator, I want to **click "New" in the toolbar** so that a native file chooser opens and I can select a directory for my new presentation project.

2. As a human operator, I want to **select an empty directory in the file chooser** so that the framework scaffolds a complete project structure (brief.md, theme.css, slides/, assets/, outputs/, .claude/, .presentation/) into that directory.

3. As a human operator, I want to **specify a slide count during project creation** (default 3, up to 99) so that the scaffold generates the right number of slide folders with sparse numbering (010, 020, 030, ...).

4. As a human operator, I want to **choose between linked and copied framework mode** so that I can either share the framework across projects (linked, the default) or vendor a framework snapshot into the project itself (--copy-framework) for portability.

5. As a human operator, I want to **click "Open" in the toolbar** so that a native file chooser opens and I can select an existing project directory to load.

6. As a human operator, I want to **switch between projects** by clicking "Open" and selecting a different project folder so that I can work on multiple decks during a session.

7. As a human operator, I want the **terminal to auto-start** in the project directory when I create or open a project so that I can immediately run commands or start the AI agent without manual navigation.

8. As a human operator, I want to **see the project name in the toolbar** after loading a project so that I always know which deck I am working on.

### B. Content Authoring

1. As a human operator, I want to **write brief.md** describing what the deck should be (audience, purpose, key messages) so that the AI agent or a future collaborator understands the creative intent.

2. As a human operator, I want to **fill out outline.md** for decks with more than 10 slides (story arc, slide plan with design notes) so that the narrative structure is locked before slide-by-slide buildout begins.

3. As a human operator, I want to **design theme.css** defining the visual system (palette, typography, component styles, accent colors, card backgrounds, shadows, radii) so that every slide in the deck shares a consistent look.

4. As a human operator, I want to **write slide.html files** containing only content (no wrappers, no inline styles, no raw style blocks) so that the runtime can assemble them into a complete deck with proper layer separation.

5. As a human operator, I want to **add optional slide.css files** for slide-specific visual tweaks so that I can customize individual slides without polluting the global theme -- knowing that all selectors must be scoped to the generated #slide-id.

6. As a human operator, I want to **add images and assets** either deck-shared in assets/ or slide-local in slides/NNN-id/assets/ so that visual content is organized logically and referenced with project-local paths.

7. As a human operator, I want to **use sparse numbering** (010, 020, 030) for slide folders so that I can insert new slides (e.g., 025-case-study) between existing ones without renumbering the entire deck.

8. As a human operator, I want to **use reveal animation classes** (.rv for fade-up, .rv-l for slide-left, .rv-r for slide-right, .rv-s for scale) so that slides animate during preview and PDF export captures the final state.

9. As a human operator, I want to **use structural primitives** (.g2, .g3, .g4 grids; .icard information cards; .stat-card + .stat-value + .stat-label metrics; .badge category labels; .tkwy takeaway blocks; .flex layouts; table structures; .img-round, .img-circle image utilities; .max-w-550/600/650 text constraints; spacing utilities) so that I compose slides from well-tested building blocks rather than inventing ad hoc layouts.

10. As a human operator, I want to **choose between .slide (light) and .slide.slide-hero (dark) modes** for each slide so that hero, opening, and closing slides can break the visual rhythm of the deck.

11. As a human operator, I want to **write revisions.md** to record feedback and change requests so that the AI agent can parse structured revision instructions during the next iteration cycle.

### C. Preview & Navigation

1. As a human operator, I want to **see a live preview** of my assembled deck in the canvas iframe so that every file save triggers an automatic reassembly and refresh without manual intervention.

2. As a human operator, I want to **navigate via filmstrip thumbnails** on the left side of the preview pane so that I can click any slide to jump to it instantly.

3. As a human operator, I want to **navigate via keyboard** (Arrow Right/Down for next slide, Arrow Left/Up for previous, Page Down/Up for jump, Home for first slide, End for last slide) so that I can browse the deck without touching the mouse -- but only when the terminal does not have focus.

4. As a human operator, I want to **navigate via dot navigation** inside the preview iframe (a fixed vertical nav on the right side of the viewport) so that I can click dots to jump between slides within the rendered deck itself.

5. As a human operator, I want to **see a slide counter** (e.g., "3 / 15") in the bottom-right corner of the preview pane so that I always know my position in the deck.

6. As a human operator, I want to **resize the preview and terminal panes** by dragging the split handle so that I can allocate more space to whichever pane I need at the moment.

7. As a human operator, I want the **filmstrip to highlight the active slide** with an accent border and to auto-scroll the thumbnail into view so that the filmstrip always tracks my current position.

8. As a human operator, I want the **filmstrip to update automatically** when slides are added, removed, or reordered so that it always reflects the current deck structure.

### D. Quality & Validation

1. As a human operator, I want to **run `npm run check`** (or click the "Validate presentation" action) so that the framework validates deterministic source rules and rendered integrity without mixing in subjective review.

2. As a human operator, I want to **see deterministic validation failures with fix detail** (file or rendered contract, message, and repair guidance) so that I know exactly what must change for the deck to pass.

3. As a human operator, I want to **run capture** to get per-slide screenshots and a structured report.json so that I can inspect the visual output without scrolling through the preview.

4. As a human operator, I want to **view overflow detection results** so that I can identify slides where content exceeds the slide boundaries and would be clipped in PDF export.

5. As a human operator, I want to **view console error reports** from the headless Playwright capture so that I can identify JavaScript errors or missing assets that break the rendered deck.

6. As a human operator, I want to **run Review visuals** so that a fixed artifact-only reviewer swarm inspects the exported PDF and writes one canonical visual issue list.

7. As a human operator, I want to **run Review narrative** so that a fixed artifact-only reviewer swarm inspects the exported PDF, brief, and outline and writes one canonical narrative issue list.

8. As a human operator, I want to **apply visual or narrative fixes separately** so that review stays judgment-only and implementation happens only when I explicitly trigger the corresponding apply action.

### E. Export & Delivery

1. As a human operator, I want to **click "Export presentation"** in the toolbar so that the full finalize pipeline runs (deterministic validation, capture, export, report generation) in a single action.

2. As a human operator, I want to **use the export modal** so that a separate direct artifact export action can write PDF or PNG files to a chosen destination without changing the canonical finalize outputs.

3. As a human operator, I want to **click the "Capture screenshots" menu item** so that per-slide PNG screenshots are saved to outputs/electron-capture/.

4. As a human operator, I want to **find all outputs in the project outputs/ folder** so that I always know where to look for deck.pdf, slides/ screenshots, report.json, and summary.md.

5. As a human operator, I want to **use the Export button in the preview iframe** to trigger a PDF download directly from the rendered deck so that I have a quick-access export path without leaving the preview.

6. As a human operator, I want the **finalize pipeline to produce a summary.md** confirming pass/fail status so that I can quickly verify the deck is ready for delivery.

7. As a human operator, I want to **run `npm run finalize` from the CLI** so that I can trigger the complete build pipeline from the terminal when I prefer command-line workflows.

8. As a human operator, I want the **finalize pipeline to exit with a non-zero code** when quality checks fail so that CI systems or scripts can detect failures automatically.

### F. AI Collaboration

1. As a human operator, I want to **run `claude` in the integrated terminal** to start the AI agent so that I can begin a collaborative authoring session without leaving the desktop app.

2. As a human operator, I want to **give plain-English requests** describing the desired presentation (audience, purpose, tone, content) so that the AI agent translates my intent into a professional deck.

3. As a human operator, I want to **invoke /new-deck** to create a new presentation from scratch so that the AI handles project scaffolding, brief writing, theme design, outline planning, and slide buildout in a guided workflow.

4. As a human operator, I want to **invoke /fix-validation-issues** to repair deterministic validation failures so that the AI reads the current validation output, fixes the concrete failures, and re-runs validation until it passes cleanly.

5. As a human operator, I want to **invoke /review-visual-presentation** to generate a visual issue list so that visual critique stays separate from deterministic validation and separate from implementation.

6. As a human operator, I want to **invoke /apply-visual-review-changes** to implement the visual issue list so that the AI consumes the canonical review JSON and makes only the requested non-narrative visual changes.

7. As a human operator, I want to **invoke /review-narrative-presentation** to generate a narrative issue list so that message, sequencing, audience fit, and argument quality are reviewed independently from visual polish.

8. As a human operator, I want to **invoke /apply-narrative-review-changes** to implement the narrative issue list so that the AI consumes the canonical review JSON and revises only the message-level issues I asked it to address.

9. As a human operator, I want to **provide feedback** in plain English so that the AI converts my notes into structured revisions.md entries and revises the affected slides accordingly.

10. As a human operator, I want to **review issue lists before applying them** so that the AI does not auto-fix subjective review findings without my explicit approval.

11. As a human operator, I want to **review the AI's work** via the live preview, per-slide screenshots, and the exported PDF so that I can visually confirm the output meets my standards before accepting it.

12. As a human operator, I want to **override AI decisions** by editing files directly after the AI stops so that I always retain final creative control -- the file watcher will detect my changes and refresh the preview.

### G. Desktop App Interactions

1. As a human operator, I want to **see a welcome panel on first launch** with a "P" logo mark, "New presentation" and "or open an existing project" actions so that I have clear entry points when no project is loaded.

2. As a human operator, I want to **use toolbar buttons** (Open, New, Export presentation, Validate presentation, ellipsis menu, Stop, Clear) so that all primary actions are accessible from a single toolbar row at the top of the window.

3. As a human operator, I want to **see the project name** displayed in the toolbar center so that I always know which project is active.

4. As a human operator, I want to **use the developer diagnostics drawer** (toggled via the info icon in the toolbar) so that I can inspect JSON panels for project meta, project state, file tree, last action result, terminal metadata, and error log.

5. As a human operator, I want to **see toast notifications** (error/red, success/green, info/blue, auto-dismiss after 4 seconds with manual dismiss button) so that I get non-intrusive feedback about action results without interrupting my workflow.

6. As a human operator, I want to **watch the status indicator** in the toolbar showing the last saved file name so that I can confirm the file watcher detected my latest edit.

7. As a human operator, I want to **use the integrated terminal** (xterm.js, dark theme, Menlo/monospace font at 14px, block cursor, 5000-line scrollback, resizable via the split handle) so that I can run commands, launch the AI agent, and see output without switching to a separate terminal app.

8. As a human operator, I want to **see loading spinners on buttons** during long-running actions (Export, Validate, Capture, and agent-triggered review/apply actions) so that I know the system is working and can wait for completion.

9. As a human operator, I want the **"Stop" button to appear only when a terminal process is alive** so that I can kill a runaway process but the button does not clutter the toolbar when there is nothing to stop.

10. As a human operator, I want the **"Clear" button to clear terminal scrollback** without killing the process so that I can reset the terminal display while keeping the session alive.

---

## 4. Permitted Actions

### Electron UI Actions

| Action | UI Element | Precondition |
|--------|-----------|--------------|
| Create a new project | "New" button or "New presentation" welcome button | None -- opens native file chooser, user selects empty directory |
| Open an existing project | "Open" button or "or open an existing project" welcome link | None -- opens native file chooser, user selects project directory |
| Export presentation | "Export presentation" button (toolbar, primary accent) | Project loaded |
| Validate presentation | "Validate presentation" button (toolbar) | Project loaded |
| Capture screenshots | Ellipsis menu > "Capture screenshots" | Project loaded |
| Stop terminal process | "Stop" button (toolbar, red/danger) | Terminal process alive |
| Clear terminal scrollback | "Clear" button (toolbar, dim) | Terminal exists (alive or stopped) |
| Navigate to slide via filmstrip | Click filmstrip thumbnail | Project loaded, slides exist |
| Navigate to slide via keyboard | Arrow keys, Page Up/Down, Home, End | Project loaded, terminal not focused |
| Navigate via dot nav | Click dot in preview iframe | Preview loaded |
| Drag split handle | Click and drag the 4px handle between panes | Project loaded (split view visible) |
| Toggle diagnostics drawer | Click info icon in toolbar | None |
| Close diagnostics drawer | Click X button in drawer header | Drawer open |
| Dismiss a toast notification | Click X button on toast | Toast visible |

### File System Actions

| Action | File/Path | Notes |
|--------|-----------|-------|
| Create/edit brief.md | `<project>/brief.md` | Replace [[TODO_...]] markers with plain-English brief |
| Create/edit outline.md | `<project>/outline.md` | Required for 10+ slide decks; lock story arc before buildout |
| Create/edit theme.css | `<project>/theme.css` | Defines the visual system: palette, typography, component styles |
| Create/edit slide.html | `<project>/slides/NNN-id/slide.html` | Content fragment only, no wrappers |
| Create/edit slide.css | `<project>/slides/NNN-id/slide.css` | Optional; must scope all selectors to #slide-id |
| Add/replace deck-shared assets | `<project>/assets/` | Images, logos, icons shared across slides |
| Add/replace slide-local assets | `<project>/slides/NNN-id/assets/` | Images specific to one slide |
| Create/edit revisions.md | `<project>/revisions.md` | Feedback for the AI agent's next revision cycle |
| Create new slide folders | `<project>/slides/NNN-id/` | Use sparse numbering (010, 020, 025, 030) |
| Rename/reorder slide folders | `<project>/slides/` | Numeric prefix determines presentation order |
| Delete slide folders | `<project>/slides/NNN-id/` | Removes the slide from the deck |
| Read output artifacts | `<project>/outputs/` | deck.pdf, slides/*.png, report.json, summary.md |

### CLI Actions (via terminal)

| Command | Purpose |
|---------|---------|
| `npm run setup` | Install dependencies (Playwright, node-pty, xterm, etc.) |
| `npm run start` | Launch the Electron desktop app |
| `npm run new -- --project /abs/path` | Scaffold a new project with 3 slides (default) |
| `npm run new -- --project /abs/path --slides N` | Scaffold with N slides (1-99) |
| `npm run new -- --project /abs/path --copy-framework` | Scaffold with vendored framework snapshot |
| `npm run check -- --project /abs/path` | Validate deterministic deck policy + rendered integrity (Playwright headless) |
| `npm run capture -- --project /abs/path [output-dir]` | Capture per-slide screenshots + report.json |
| `npm run export -- --project /abs/path [output.pdf]` | Export a PDF artifact to a chosen path |
| `npm run finalize -- --project /abs/path` | Generate canonical presentation outputs (`outputs/deck.pdf`, screenshots, `report.json`, `summary.md`) |
| `npm test` | Run framework test suite |
| `claude` | Start the AI agent in the project context |

### AI Delegation Actions

| Action | Skill | What Happens |
|--------|-------|-------------|
| Create a new deck from scratch | `/new-deck` | AI scaffolds project, writes brief, designs theme, plans slides, builds HTML, runs finalize |
| Fix validation issues | `/fix-validation-issues` | AI reads deterministic validation failures, fixes each concrete issue, and re-runs validation until it passes clean |
| Review visuals | `/review-visual-presentation` | AI exports a fresh PDF, runs the artifact-only visual reviewer swarm, and writes `.presentation/runtime/reviews/visual/visual-review-issues.json` |
| Apply visual fixes | `/apply-visual-review-changes` | AI reads the visual issue list JSON and implements the requested non-narrative visual changes |
| Review narrative | `/review-narrative-presentation` | AI exports a fresh PDF, reads `brief.md` and `outline.md`, runs the artifact-only narrative reviewer swarm, and writes `.presentation/runtime/reviews/narrative/narrative-review-issues.json` |
| Apply narrative fixes | `/apply-narrative-review-changes` | AI reads the narrative issue list JSON and implements the requested message and sequencing changes |
| Give plain-English creative direction | (direct conversation) | AI interprets intent and executes accordingly |
| Provide revision feedback | (direct conversation) | AI updates revisions.md and revises affected slides |
| Review issue lists before applying | (direct conversation) | User decides whether to run the corresponding apply action; AI does not auto-fix subjective review findings |
| Accept or reject AI proposals | (direct conversation) | User reviews preview/screenshots/PDF and confirms |
| Override AI by editing files | (file system) | User edits files directly; watcher detects changes and refreshes preview |

---

## 5. Restricted Actions / Guardrails

### Framework file restrictions

| Restriction | Why |
|-------------|-----|
| DO NOT edit `framework/canvas/` files | These define structural primitives (.slide, .g2, .g3, .g4, .rv, .dot-nav, etc.) shared across every deck. A change here affects every project that links to this framework. |
| DO NOT edit `framework/client/` files | Browser-side behavior (navigation, counters, animations, export) is framework-owned. Modifications could break the preview, PDF export, or keyboard navigation for every project. |
| DO NOT edit `framework/runtime/` files | Assembly, validation, capture, export, and finalize logic is framework-owned. These pipelines must produce deterministic output. Modifying them during deck work could corrupt the build system. |
| DO NOT edit `electron/` files | The desktop host (main process, preload, renderer, worker) is framework infrastructure. Editing it during deck work could break the app for all projects. |

### Rendered output restrictions

| Restriction | Why |
|-------------|-----|
| DO NOT edit rendered HTML output | The preview is assembled on demand from source files (theme.css + slide.html fragments). Any direct edit to rendered HTML is overwritten on the next reassembly. |
| DO NOT edit `.presentation/project.json` | System metadata (framework mode, project name, framework source path) is managed by the runtime. Manual edits could desynchronize the project state. |

### Authoring restrictions

| Restriction | Why |
|-------------|-----|
| DO NOT use inline `style=""` attributes in slide.html | Breaks the cascade contract. The framework enforces `content < theme < canvas` through CSS layers. Inline styles bypass layers entirely and create unpredictable rendering. |
| DO NOT use `!important` in theme.css or slide.css | Breaks cascade priority guarantees. The layer system ensures canvas > theme > content. Using !important overrides this ordering, making the visual system unpredictable. |
| DO NOT use raw `<style>` blocks inside slide.html | All styling belongs in theme.css (deck-wide) or slide.css (slide-scoped). Embedding style blocks in content fragments breaks the separation of content and presentation. |
| DO NOT include `<html>`, `<head>`, `<body>`, or `<section data-slide>` wrappers in slide.html | The runtime generates these wrappers during assembly. Including them in source fragments creates duplicate elements, breaks slide discovery, and corrupts the rendered output. |
| DO NOT create slide CSS that targets other slides | CSS in slide.css must be scoped to the generated `#slide-id` for that slide. Cross-slide selectors create hidden dependencies and make slide reordering or deletion dangerous. |
| DO NOT use root-relative or cross-workspace asset paths | Assets must be project-local (in `assets/` or `slides/NNN-id/assets/`). Absolute paths or references to other projects break portability and copied-framework mode. |
| DO NOT change `@layer content, theme, canvas` declaration order | This declaration is the foundation of the CSS cascade contract. Changing it inverts the priority system and breaks every theme and canvas rule. |
| DO NOT redefine protected canvas selectors from theme.css or slide.css | Canvas selectors (.slide, .g2, .g3, .g4, .rv, .dot-nav, .export-bar) define framework structure. Redefining them from theme or content layers undermines the structural guarantees every slide depends on. |

---

## 6. Action-Consequence Matrix

| Action | System Response | Result |
|--------|----------------|--------|
| Click "New" | Native file chooser opens (directories only, with create option) | User selects or creates an empty directory |
| Select directory in New flow | Scaffold runs: creates brief.md, theme.css, slides/, assets/, outputs/, .claude/, .presentation/project.json; initializes git repo; auto-commits scaffold | Project structure created with sparse-numbered slide folders; terminal auto-starts in project directory; welcome panel transitions to split view (preview + terminal) |
| Click "Open" | Native file chooser opens (directories only) | User selects an existing project directory |
| Select directory in Open flow | Project validated: .presentation/project.json must exist; project loaded; file tree indexed | Terminal auto-starts in project directory; preview iframe loads assembled deck; filmstrip populates with slide thumbnails |
| Save slide.html in external editor | File watcher detects change; deck reassembled from all slide sources + theme.css; preview iframe reloaded; filmstrip rebuilt | Preview shows updated slide content; watch status indicator shows the saved filename; filmstrip re-renders if slide structure changed |
| Save theme.css | File watcher detects change; all slides re-render with updated visual system; preview iframe reloaded | Every slide reflects the new palette, typography, component styles; preview refreshes automatically |
| Save slide.css | File watcher detects change; affected slide re-renders with updated local styles; preview iframe reloaded | Slide-specific visual tweaks take effect; other slides are not affected |
| Click filmstrip thumbnail | postMessage sent to preview iframe with target slide ID; iframe smooth-scrolls to that slide section | Preview navigates to the selected slide; active thumbnail highlighted with accent border; slide counter updates |
| Press Arrow Right/Down (terminal not focused) | selectSlide(currentSlide + 1) called; postMessage sent to iframe | Preview navigates to the next slide; filmstrip updates active thumbnail; slide counter increments |
| Press Arrow Left/Up (terminal not focused) | selectSlide(currentSlide - 1) called; postMessage sent to iframe | Preview navigates to the previous slide; filmstrip updates; slide counter decrements |
| Press Home (terminal not focused) | selectSlide(0) called | Preview jumps to the first slide |
| Press End (terminal not focused) | selectSlide(slideEntries.length - 1) called | Preview jumps to the last slide |
| Click "Export presentation" | Canonical finalize/export pipeline starts: deterministic validation, Playwright capture (screenshots + report.json), PDF export, summary generation | Toast notification on completion; canonical outputs appear in `outputs/` |
| Use the export modal | Dedicated direct artifact export action runs via Playwright headless browser for selected slides and chosen format | Toast notification on completion; chosen PDF or PNG artifacts are written to the selected destination |
| Click "Validate presentation" | `npm run check` runs: deterministic policy validation + Playwright headless rendered-integrity checks | Validation results displayed; deterministic failures listed with fix detail; exit 0 if clean |
| Click ellipsis > "Capture screenshots" | `npm run capture` runs: Playwright captures every slide as PNG + extracts structural data into report.json | Screenshots saved to outputs/electron-capture/; report.json contains per-slide metrics (dimensions, grids, typography, overflow, text content) |
| Run `npm run check -- --project /abs/path` | Deterministic validation + Playwright headless rendered-integrity capture | JSON summary output with slide count, console errors, overflow slides, failure count, and pass/fail status |
| Run `npm run finalize -- --project /abs/path` | Generate canonical deck outputs | `outputs/deck.pdf` + `outputs/slides/*.png` + `outputs/report.json` + `outputs/summary.md`; exit 0 on pass, exit 1 on failure |
| Run `claude` in terminal | AI agent starts; reads .claude/CLAUDE.md and all rules in .claude/rules/; ready for natural-language requests | AI agent is context-aware: knows the project structure, authoring constraints, file boundaries, structural primitives, cascade contract, and available skills |
| Give AI plain-English feedback | AI updates revisions.md with structured revision entries; AI revises affected slides in slides/NNN-id/; AI re-runs validation as needed | Stop hook (`run-presentation-stop-workflow.mjs`) runs deterministic validation, then local checkpointing only when validation passes |
| Invoke /review-visual-presentation | AI exports a fresh PDF, launches the fixed visual reviewer swarm in parallel, and synthesizes one canonical issue list | `.presentation/runtime/reviews/visual/visual-review-issues.json` is written; terminal reports the overall visual judgment and issue count; AI does not auto-fix |
| Invoke /apply-visual-review-changes | AI reads `.presentation/runtime/reviews/visual/visual-review-issues.json`, maps artifact-space references into project files, edits source, and re-validates | Visual issue list is implemented in source; deterministic validation re-runs before completion |
| Invoke /review-narrative-presentation | AI exports a fresh PDF, reads `brief.md` and `outline.md`, launches the fixed narrative reviewer swarm in parallel, and synthesizes one canonical issue list | `.presentation/runtime/reviews/narrative/narrative-review-issues.json` is written; terminal reports the overall narrative judgment and issue count; AI does not auto-fix |
| Invoke /apply-narrative-review-changes | AI reads `.presentation/runtime/reviews/narrative/narrative-review-issues.json`, maps artifact-space references into project files, edits source, and re-validates | Narrative issue list is implemented in source; deterministic validation re-runs before completion |
| Edit a framework file (canvas, client, runtime) | No immediate guard or system response -- the framework does not block edits at the filesystem level | Subsequent check/finalize may fail if the edit introduced inconsistencies; other projects sharing the same framework installation may break; the human should only do this as explicit framework maintenance work |
| Use inline `style=""` in slide.html | Policy check catches the violation | check and finalize are blocked; warning printed with fix instruction: "Remove inline style and move to theme.css or slide.css" |
| Use `!important` in theme.css | Policy check catches the violation | check and finalize are blocked; warning printed with fix instruction: "Remove !important; use layer ordering instead" |
| Include `<section data-slide>` wrapper in slide.html | Policy check catches the violation | check and finalize are blocked; warning printed: "Remove outer wrapper; runtime generates it" |
| Toggle diagnostics drawer | Drawer slides in from the right (max 400px or 36% viewport width) | JSON panels visible: Meta (project metadata), State (project state), Files (file tree), Action (last action result), Terminal (terminal metadata), Errors (error log) |
| Click "Stop" | Terminal process killed via SIGTERM | Terminal shows exit status; Stop button hides; Clear button remains visible |
| Click "Clear" | Terminal scrollback cleared (term.clear()); process not affected | Terminal display resets; if process is alive, it continues running; if process exited, empty terminal shown |
| Drag split handle | Pane widths adjust proportionally | Preview pane and terminal pane resize; terminal re-fits to new dimensions; split handle follows mouse cursor |

---

## 7. Interaction Model with AI Agent

The human-AI collaboration follows a defined lifecycle. Each phase has clear ownership and handoff points.

### Phase 1: Human Initiates

The human starts the AI agent by running `claude` in the integrated terminal, or by invoking a skill directly (`/new-deck`, `/fix-validation-issues`, `/review-visual-presentation`, `/apply-visual-review-changes`, `/review-narrative-presentation`, `/apply-narrative-review-changes`). The human provides creative direction in plain English -- describing the audience, purpose, tone, content focus, and any specific requirements for the deck.

The human can be as brief or as detailed as they want. "Make me a 10-slide investor pitch for a fintech startup" is a valid starting point. "Revise slide 3 to emphasize the regulatory moat and add a comparison table" is an equally valid mid-cycle instruction.

### Phase 2: AI Reads Contract

When the AI agent starts in a scaffolded project, it reads `.claude/CLAUDE.md` (the project-level agent contract) and all rules in `.claude/rules/`:

- **framework.md** -- ownership model, layer contract, deck anatomy, structural primitives, runtime assumptions
- **authoring-rules.md** -- allowed and banned patterns, verification workflow, heuristics for large decks
- **file-boundaries.md** -- which files are safe to edit, which are protected, escalation examples
- **slide-patterns.md** -- source model, slide modes, available primitives, design quality rules
- **tokens.md** -- theme-owned vs canvas-owned tokens, consumption patterns, escalation path for new tokens

This contract is non-negotiable. The AI must follow these constraints regardless of what the human asks. If the human asks for something that violates the contract (e.g., "use inline styles"), the AI should explain why it cannot and offer a compliant alternative.

### Phase 3: AI Proposes and Executes

The AI designs the theme first -- finalizing theme.css with the complete visual system before writing any slide HTML. For larger decks (10+ slides), the AI locks the story in outline.md with per-slide design notes before beginning buildout.

The AI builds slide HTML using structural primitives from the canvas layer, composing each slide to serve its content purpose. It varies layouts across slides -- a deck where every content slide uses the same .g3 + .icard pattern has failed as a design.

For decks with more than 10 slides, the AI works in batches of 5 and runs `npm run check` after each batch to catch issues early.

### Phase 4: Stop Hook Enforces Quality

After the AI finishes each response, the `run-presentation-stop-workflow.mjs` stop hook runs automatically. This hook:

1. Checks whether the project has valid slides
2. Runs deterministic presentation validation through the canonical validate action
3. If validation passes: auto-commits the current state via git (for edit history) and exits 0 -- the AI can stop
4. If validation fails: prints the failures to stderr and exits non-zero -- the AI must continue fixing

This creates an automatic deterministic gate. The AI cannot "finish" until the deck passes validation. The human does not need to manually run validation after every AI response -- the hook does it.

### Phase 5: Human Reviews

The human inspects the AI's work through multiple channels:

- **Live preview** in the Electron canvas iframe -- auto-refreshes as the AI saves files
- **Filmstrip navigation** -- click thumbnails to jump between slides
- **Keyboard navigation** -- arrow keys when the terminal is not focused
- **Per-slide screenshots** -- captured during finalize, available in outputs/slides/
- **PDF export** -- the final deliverable, available in outputs/deck.pdf
- **Diagnostics drawer** -- JSON view of project state, file tree, action results
- **report.json** -- structured data including slide dimensions, grid alignment, typography metrics, overflow detection, consistency analysis

### Phase 6: Human Triages

For visual and narrative reviews, the human receives one canonical issue list per lane. Each issue contains:

- what is wrong
- what should be fixed
- an optional artifact-space target (page number, visible title, outline label, description)

The human reads the issue list and decides whether to run the corresponding apply action. The AI does NOT auto-fix subjective review findings unless the human explicitly approves. This is the key boundary: reviewer swarms surface judgment, but the human holds the triage authority.

The human can say:
- "Apply the visual fixes"
- "Apply the narrative fixes after I review the issue file"
- "Only fix the issues on pages 3 and 5"
- "Leave it as is"

### Phase 7: Human Overrides

The human can always edit files directly, overriding any AI decision:

- Edit slide.html to change content the AI wrote
- Edit theme.css to adjust colors, typography, or component styles
- Add or remove slide folders to change the deck structure
- Replace assets the AI selected
- Delete revisions.md entries the AI generated

The file watcher detects these changes and refreshes the preview immediately. The AI, if still active in the terminal, will see the updated file state on its next read. There is no conflict resolution mechanism -- the last write wins, and the human's direct edits always take precedence.

### Phase 8: Iteration

The human can start another cycle at any time:

- Invoke /review-visual-presentation again after fixes to confirm visual issues are resolved
- Invoke /review-narrative-presentation again after fixes to confirm message issues are resolved
- Give direct feedback in the terminal to trigger another targeted revision pass
- Give ad hoc instructions in the terminal ("make the hero slide darker", "add a slide about pricing between slides 5 and 6")
- Run /fix-validation-issues if the check reports new deterministic failures after manual edits

Each cycle follows the same loop: human initiates, AI reads context, AI executes, hook enforces quality, human reviews, human triages. The cycle repeats until the human is satisfied with the output.

---

## 8. Success Criteria

A presentation project is considered "done" when all of the following conditions are met.

### Output artifacts exist

- `outputs/deck.pdf` exists and is a professional, readable PDF presentation
- `outputs/slides/` contains PNG screenshots of every slide in the deck
- `outputs/report.json` contains structured capture data (dimensions, grids, typography, overflow, text content, consistency metrics)
- `outputs/summary.md` confirms pass status with zero failures

### Quality checks pass

- `npm run check -- --project /abs/path` passes cleanly with 0 deterministic validation failures
- No console errors reported during Playwright capture
- No overflow detected on any slide (overflowDetected: false for every slide)
- No slides with missing content, placeholder text ([[TODO_...]], Lorem ipsum, TBD), or empty sections

### Visual quality standards met

- Preview shows all slides rendering correctly with proper cascade (content < theme < canvas)
- Theme is consistent across all slides -- same palette, typography, component styles, spacing
- Slide layouts are varied -- no repetitive use of the same structural primitive pattern across multiple consecutive slides
- Hero slides (slide-hero mode) create clear visual rhythm breaks within the deck
- Text is readable at export size (960x540 points) -- no text too small, no insufficient contrast
- No text overlapping edges, logos, branding elements, or card boundaries
- Grid children are properly aligned (equal widths, tops aligned)
- Images and assets load correctly -- no broken references

### Content quality standards met

- The deck tells a coherent story matching the brief.md
- Each slide has a clear purpose -- one main idea per slide
- The opening hooks, the middle informs, the closing calls to action
- Writing is clear, concise, and appropriate for the target audience
- Data is internally consistent -- same numbers wherever they appear
- No grammatical errors, typos, or awkward phrasing

### Project structure is sound

- All slide folders use sparse numbering (010, 020, 030, ...)
- brief.md contains no [[TODO_...]] markers
- outline.md (if present) contains no [[TODO_...]] markers
- theme.css defines a complete visual system (not just defaults)
- No inline styles, !important, raw style blocks, or outer wrappers in slide.html files
- All slide.css files are scoped to their respective #slide-id
- All asset references are project-local
