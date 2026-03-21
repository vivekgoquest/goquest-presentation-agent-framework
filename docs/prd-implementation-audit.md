# PRD Implementation Status Audit

Comprehensive analysis of every user story across both PRDs, verified against the codebase.

---

## Executive Summary

| PRD | Total Stories | Fully Done | Partial | Not Done |
|-----|-------------|-----------|---------|----------|
| **Human Agent** | 65 | 62 (95%) | 2 (3%) | 1 (2%) |
| **AI Agent** | 45 | 37 (82%) | 6 (13%) | 2 (4%) |
| **Combined** | 110 | 99 (90%) | 8 (7%) | 3 (3%) |

**Key finding:** The framework is substantially complete. The dominant gap is `revisions.md` — a concept referenced heavily in both PRDs but never implemented (no template, no scaffolding, no skill instructions). The only other notable gap is the split-handle drag-to-resize (DOM + CSS ready, no JS drag handlers).

---

## HUMAN AGENT PRD — Story-by-Story Status

### A. Project Lifecycle (8/8 FULL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| A1 | Click "New" → native file chooser | **FULL** | `electron/main.mjs:129-138` IPC handler, `electron/renderer/app.js:321-333` createProject() |
| A2 | Select directory → scaffold project | **FULL** | `scaffold-service.mjs:195-364` creates brief.md, theme.css, slides/, assets/, outputs/, .claude/, .presentation/ |
| A3 | Specify slide count (default 3, up to 99) | **FULL** | `scaffold-service.mjs:62-64` sparse numbering (index+1)*10, `new-deck.mjs:46` validates 1-99 |
| A4 | Choose linked vs copied framework | **FULL** | `scaffold-service.mjs:26-28` --copy-framework flag, `lines 129-146` copyFrameworkSnapshot() |
| A5 | Click "Open" → file chooser for existing | **FULL** | `electron/renderer/app.js:335-338` toolbarOpen() |
| A6 | Switch between projects | **FULL** | `app.js:309-319` openProject() unloads previous, loads new |
| A7 | Terminal auto-starts in project dir | **FULL** | `app.js:318` (open), `app.js:332` (create) — both call terminal.start('shell') |
| A8 | Project name in toolbar | **FULL** | `app.js:130-134` updates projectNameLabel with state.meta.title/slug |

### B. Content Authoring (10/11 FULL, 1 NOT DONE)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| B1 | Write brief.md | **FULL** | `framework/templates/brief.md` template exists, `deck-policy.js:255-269` validates |
| B2 | Fill outline.md for 10+ slides | **FULL** | `framework/templates/outline.md` exists, `scaffold-service.mjs:203` threshold enforced |
| B3 | Design theme.css | **FULL** | `framework/templates/theme.css` (229 lines) — palette, typography, components |
| B4 | Write slide.html (no wrappers) | **FULL** | Template slides exist, `deck-policy.js:354-393` forbids html/head/body/section wrappers |
| B5 | Optional slide.css scoped to #id | **FULL** | `deck-assemble.js:87-90` includes slide.css, `deck-policy.js:395-439` enforces #id scoping |
| B6 | Add images in assets/ or slides/NNN/assets/ | **FULL** | `deck-source.js:70-71` getSlideAssetRoots() supports both |
| B7 | Sparse numbering (010, 020, 030) | **FULL** | `scaffold-service.mjs:62-64` formatSlidePrefix() |
| B8 | Reveal animation classes (.rv, .rv-l, .rv-r, .rv-s) | **FULL** | `canvas.css:196-209` all 4 classes defined with transitions |
| B9 | Structural primitives (.g2-.g4, .icard, .stat-card, etc.) | **FULL** | `canvas.css:145-194` grids/flex/spacing, `templates/theme.css:104-228` components |
| B10 | .slide (light) vs .slide-hero (dark) | **FULL** | `canvas.css:71-85` (light), `canvas.css:118-143` (dark hero) |
| B11 | Write revisions.md for feedback | **NOT DONE** | No template in templates/. Scaffold test explicitly asserts revisions.md is NOT created (`runtime-services.test.mjs:58`). Not referenced in any scaffolding code. |

### C. Preview & Navigation (7/8 FULL, 1 PARTIAL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| C1 | Live preview in canvas iframe | **FULL** | `watch-service.mjs` watches files, `app.js:394-398` refreshPreview() on change |
| C2 | Filmstrip thumbnails | **FULL** | `index.html:75` filmstrip div, `app.js:169-205` buildFilmstrip(), `app.css:131-182` styling |
| C3 | Keyboard navigation | **FULL** | `app.js:233-249` handles Arrow, PageDown/Up, Home, End; skips when terminal focused |
| C4 | Dot navigation in iframe | **FULL** | `client/nav.js` builds dot-nav, `canvas.css:211-241` fixed-right styling |
| C5 | Slide counter ("3 / 15") | **FULL** | `index.html:78` counter div, `app.js:225-231` updateSlideCounter() |
| C6 | Resize panes via drag handle | **PARTIAL** | DOM element exists (`index.html:87`), CSS ready (cursor:col-resize, .dragging class at `app.css:203-207`), but **NO JavaScript drag event handlers**. Handle is visible but non-functional. |
| C7 | Filmstrip highlights active slide | **FULL** | `app.js:212-214` toggles .active, `app.css:155` accent border, scrollIntoView() |
| C8 | Filmstrip auto-updates on change | **FULL** | watch/change event → refreshProjectPanels() → buildFilmstrip() with change detection |

### D. Quality & Validation (8/8 FULL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| D1 | npm run check | **FULL** | `package.json` check script, `check-deck.mjs` → runDeckCheck() |
| D2 | Warnings with fix instructions | **FULL** | `check-deck.mjs:34-38` outputs rule/slideId/message/fix format |
| D3 | Capture screenshots + report.json | **FULL** | `capture-service.mjs` uses Playwright, creates per-slide PNGs + report.json |
| D4 | Overflow detection | **FULL** | Per-slide `overflowDetected` boolean via getBoundingClientRect vs viewport |
| D5 | Console error reports | **FULL** | `capture-service.mjs:48-56` captures console.error + pageerror events |
| D6 | /verify-deck 6-agent swarm | **FULL** | `project-agent/skills/verify-deck/SKILL.md` defines all 6 agents |
| D7 | /review-deck-swarm 5-agent | **FULL** | `project-agent/skills/review-deck-swarm/SKILL.md` defines all 5 personalities |
| D8 | Triage by severity | **FULL** | Both skills define CRITICAL/WARNING/NOTE (or TASTE) levels |

### E. Export & Delivery (8/8 FULL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| E1 | Click Build → finalize pipeline | **FULL** | `index.html:27` Build button, `app.js:376` wired to runtime.finalize() |
| E2 | Click PDF → export | **FULL** | `index.html:28` PDF button, exports to outputs/electron-export.pdf |
| E3 | Capture screenshots menu item | **FULL** | `index.html:37` menu item, outputs to outputs/electron-capture/ |
| E4 | All outputs in outputs/ folder | **FULL** | finalize produces deck.pdf, slides/*.png, report.json, summary.md |
| E5 | Export button in preview iframe | **FULL** | `deck-assemble.js:53-60` injects .export-bar, `client/export.js` handles click |
| E6 | Finalize produces summary.md | **FULL** | `finalize-service.mjs` calls buildSummary() from templates/summary.md |
| E7 | npm run finalize from CLI | **FULL** | `package.json` finalize script, `finalize-deck.mjs` parses --project |
| E8 | Non-zero exit on failure | **FULL** | `finalize-deck.mjs:37-39` exits 1 on status !== 'pass' |

### F. AI Collaboration (11/12 FULL, 1 PARTIAL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| F1 | Run claude in terminal | **FULL** | `terminal-core.mjs:19` VALID_MODES includes 'claude', sends `claude --add-dir` |
| F2 | Plain-English requests | **FULL** | AI capability; CLAUDE.md + rules provide full operating contract |
| F3 | /new-deck skill | **FULL** | `project-agent/skills/new-deck/SKILL.md` exists with complete workflow |
| F4 | /revise-deck skill | **FULL** | `project-agent/skills/revise-deck/SKILL.md` exists |
| F5 | /review-deck skill | **FULL** | `project-agent/skills/review-deck/SKILL.md` exists |
| F6 | /verify-deck 6-agent | **FULL** | Skill defines all 6 agents with checklists |
| F7 | /review-deck-swarm 5-agent | **FULL** | Skill defines all 5 personalities |
| F8 | /fix-warnings skill | **FULL** | `project-agent/skills/fix-warnings/SKILL.md` exists |
| F9 | Feedback → AI converts to revisions.md | **PARTIAL** | revise-deck skill handles feedback-driven changes but does NOT explicitly instruct creating/updating revisions.md (tied to B11 gap) |
| F10 | Triage reports, no auto-fix | **FULL** | Both swarm skills explicitly say "Do NOT auto-fix" |
| F11 | Review via preview/screenshots/PDF | **FULL** | All three channels functional |
| F12 | Override AI by editing files | **FULL** | `watch-service.mjs` detects external edits, preview refreshes |

### G. Desktop App Interactions (10/10 FULL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| G1 | Welcome panel on first launch | **FULL** | `index.html:57-71` welcome mark + buttons, `app.css:94-117` styling |
| G2 | Toolbar buttons (Open, New, Build, PDF, ..., Stop, Clear) | **FULL** | `index.html:15-45` all buttons present, `app.js:370-382` all wired |
| G3 | Project name in toolbar center | **FULL** | `index.html:22` label, `app.js:130-134` updates text, `app.css:61-67` ellipsis overflow |
| G4 | Developer diagnostics drawer | **FULL** | `index.html:92-107` 6 panels (Meta, State, Files, Action, Terminal, Errors) |
| G5 | Toast notifications (error/success/info, 4s dismiss) | **FULL** | `app.js:93-101` showToast(), `app.css:210-226` 3 color themes, 4s setTimeout |
| G6 | Status indicator (last saved file) | **FULL** | `index.html:49` watch-status span, `app.js:394-399` updates on watch/change |
| G7 | Integrated terminal (xterm.js, all specs) | **FULL** | `app.js:50-64` block cursor, Menlo 14px, dark theme, 5000-line scrollback |
| G8 | Loading spinners on buttons | **FULL** | `app.js:86-91` setLoading(), `app.css:251-257` spin animation |
| G9 | Stop button visible only when process alive | **FULL** | `app.js:272` conditional display based on alive boolean |
| G10 | Clear clears scrollback without kill | **FULL** | `app.js:382` term.clear(), `terminal-core.mjs:286` clearBacklog() |

---

## AI AGENT PRD — Story-by-Story Status

### AI-A. Onboarding (7/8 FULL, 1 PARTIAL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| A.1 | Read .claude/CLAUDE.md on start | **FULL** | `project-claude-md.md` exists, instructs reading rules |
| A.2 | Read all 5 rule files | **FULL** | All exist: framework.md, authoring-rules.md, file-boundaries.md, slide-patterns.md, tokens.md |
| A.3 | Understand CSS cascade (content < theme < canvas) | **FULL** | `framework.md:23-26` explains cascade, also in CLAUDE.md:24 |
| A.4 | Know editable vs protected files | **FULL** | `file-boundaries.md:3-35` lists both categories with escalation examples |
| A.5 | Understand structural primitives | **FULL** | `slide-patterns.md:30-39` lists all primitives |
| A.6 | Know slide modes | **FULL** | `slide-patterns.md:18-24` explains .slide vs .slide-hero |
| A.7 | Understand token ownership | **FULL** | `tokens.md:7-35` distinguishes theme-owned vs canvas-owned |
| A.8 | Check project state (.presentation/project.json) | **PARTIAL** | CLAUDE.md and rules do NOT explicitly instruct checking project.json on startup. The hook does it, but onboarding contract doesn't mention it. |

### AI-B. Creation / new-deck (10/11 FULL, 1 PARTIAL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| B.1 | Run npm run new | **FULL** | new-deck/SKILL.md:10-14 |
| B.2 | Convert request to brief.md | **FULL** | SKILL.md:18-19 |
| B.3 | Fill outline.md for 10+ slides | **FULL** | SKILL.md:12-13, 20 |
| B.4 | Design theme FIRST | **FULL** | SKILL.md:21-22 |
| B.5 | Design each slide individually | **FULL** | SKILL.md:22-23 |
| B.6 | Record per-slide design decisions | **FULL** | SKILL.md:22 "record design notes in outline" |
| B.7 | Don't build HTML until theme done | **FULL** | SKILL.md:23 explicit instruction |
| B.8 | Build in batches of 5 for 10+ | **FULL** | SKILL.md:25 |
| B.9 | Use sparse numbering (010, 020, 030) | **PARTIAL** | CLAUDE.md:43 mentions sparse numbering, but new-deck SKILL.md does NOT repeat the instruction. Agent must rely on reading CLAUDE.md, which it should — but the skill itself doesn't reinforce it. |
| B.10 | Run finalize at end | **FULL** | SKILL.md:30 |
| B.11 | Self-inspect preview/screenshots/PDF | **FULL** | SKILL.md:29 |

### AI-C. Revision / revise-deck (5/6 FULL, 1 NOT DONE)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| C.1 | Convert feedback to revisions.md | **NOT DONE** | revise-deck/SKILL.md does NOT reference creating or updating revisions.md. The entire revisions.md concept is absent from the skill. |
| C.2 | Refresh outline.md for 10+ slides | **FULL** | SKILL.md:13 |
| C.3 | Re-evaluate design for 5+ slide changes | **FULL** | SKILL.md:14 |
| C.4 | Batch revision for 10+ slides | **FULL** | SKILL.md:17 |
| C.5 | Run finalize after revisions | **FULL** | SKILL.md:21 |
| C.6 | Visual self-inspection | **FULL** | SKILL.md:20 |

### AI-D. Review / review-deck (5/6 FULL, 1 NOT DONE)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| D.1 | Inspect current state | **FULL** | review-deck/SKILL.md:12 |
| D.2 | Run finalize if needed | **FULL** | SKILL.md:15 |
| D.3 | Summarize quality + weak points | **FULL** | SKILL.md:16 |
| D.4 | Convert changes to revisions.md | **NOT DONE** | Skill says "provide the revision plan directly in your response" — does NOT instruct creating revisions.md |
| D.5 | Recommend exact revision plan | **FULL** | SKILL.md:17 |
| D.6 | Report paths and issues | **FULL** | SKILL.md:19-24 |

### AI-E. Verification (10/11 FULL, 1 PARTIAL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| E.1 | verify-deck: Ask for project + audience | **FULL** | SKILL.md:13-25 |
| E.2 | Define all 6 agent types | **FULL** | SKILL.md:52-372 (visual, data, content, audience, typography, structure) |
| E.3 | Each agent runs capture independently | **FULL** | Each agent template includes capture command |
| E.4 | Synthesize with overall score | **FULL** | SKILL.md:376-415 |
| E.5 | Ask user before fixing | **FULL** | SKILL.md:417-421 |
| E.6 | Re-run only affected agents after fixes | **PARTIAL** | SKILL.md:430 instructs it but does NOT detail how to determine which agents are affected |
| E.7 | review-deck-swarm: Ask for project + audience | **FULL** | SKILL.md:11-17 |
| E.8 | Define all 5 personalities | **FULL** | SKILL.md:44-62 (executive, design, analyst, newcomer, nitpicker) |
| E.9 | Run capture once before launch | **FULL** | SKILL.md:20-27 |
| E.10 | Consolidate: dedup + slide grouping | **FULL** | SKILL.md:64-70 |
| E.11 | NO auto-fix | **FULL** | SKILL.md:72-76 explicit |

### AI-F. Quality Enforcement (4/4 FULL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| F.1 | Hook reads quality warnings | **FULL** | `check-slide-quality.mjs:58-92` calls checkDeckQuality() |
| F.2 | Hook auto-commits on clean pass | **FULL** | Lines 60-84: git add -A, git commit |
| F.3 | Hook exits 2 on warnings | **FULL** | Line 92: process.exit(2) |
| F.4 | deck-quality.js has all 5 rules | **FULL** | `deck-quality.js:26-155` — layout-variety, consecutive-same-layout, stat-card-misuse, image-coverage, component-diversity |

### AI-G. Handoff (0/3 FULL, 3 PARTIAL)

| # | Story | Status | Evidence |
|---|-------|--------|----------|
| G.1 | new-deck handoff: all 6 items | **PARTIAL** | Skill instructs reporting project path, mode, PDF, screenshots, summary, open questions — but says "screenshot path" not "screenshot directory (outputs/slides/)" |
| G.2 | revise-deck handoff: all 6 items | **PARTIAL** | Same ambiguity: "screenshot path" instead of directory reference |
| G.3 | review-deck handoff: all 5 items | **PARTIAL** | Missing screenshot directory from handoff report entirely |

---

## Gap Analysis: The 11 Non-FULL Stories

### NOT DONE (3 stories — all related to revisions.md)

| Story | Issue | Impact |
|-------|-------|--------|
| **Human B11** | No revisions.md template, no scaffolding, test explicitly asserts NOT created | Users cannot write structured feedback per PRD workflow |
| **AI C.1** | revise-deck skill does not instruct creating revisions.md | AI agent won't create revisions.md during revision cycles |
| **AI D.4** | review-deck skill does not instruct saving revision plan to revisions.md | Revision plans stay in chat, not persisted to file |

**Root cause:** `revisions.md` was designed in the PRD but intentionally (or accidentally) excluded from implementation. The test at `runtime-services.test.mjs:58` explicitly asserts it is NOT created — suggesting a deliberate deferral.

### PARTIAL (8 stories)

| Story | Issue | Severity |
|-------|-------|----------|
| **Human C6** | Split-handle drag: DOM + CSS ready, no JS handlers | Medium — users see the cursor change but can't resize |
| **Human F9** | Feedback → revisions.md not guaranteed (tied to B11) | Low — covered by B11 root cause |
| **AI A.8** | Onboarding doesn't instruct checking project.json | Low — hook does it anyway |
| **AI B.9** | new-deck skill doesn't repeat sparse numbering instruction | Low — CLAUDE.md covers it |
| **AI E.6** | verify-deck: no guidance on which agents to re-run | Low — agent can infer |
| **AI G.1** | new-deck handoff: "screenshot path" ambiguous | Low — minor wording |
| **AI G.2** | revise-deck handoff: same ambiguity | Low — minor wording |
| **AI G.3** | review-deck handoff: missing screenshot dir | Low — minor wording |

---

## Verified Infrastructure (report.json)

The PRD claims report.json contains extensive analysis. **All claims verified:**

| report.json Field | Status | Evidence |
|-------------------|--------|----------|
| Overflow detection per slide | **Present** | `capture-service.mjs:174` overflowDetected boolean |
| Console errors | **Present** | Lines 49-56 captures console.error + pageerror |
| Grid alignment (widthsEqual, topsAligned) | **Present** | Lines 119-134 |
| Typography (fontSizes, fontWeights) | **Present** | Lines 224-226 |
| DOM structure (headings, cards, tables, images) | **Present** | Lines 75-115 |
| Consistency analysis (logos, overflow, aspectRatios) | **Present** | Lines 263-272 |

---

## Scoring Summary

**Human Agent PRD: 62/65 FULL = 95.4%**
- 8/8 Project Lifecycle
- 10/11 Content Authoring (revisions.md missing)
- 7/8 Preview & Navigation (split drag missing)
- 8/8 Quality & Validation
- 8/8 Export & Delivery
- 11/12 AI Collaboration (revisions.md gap)
- 10/10 Desktop App

**AI Agent PRD: 37/45 FULL = 82.2%**
- 7/8 Onboarding
- 10/11 Creation
- 5/6 Revision (revisions.md)
- 5/6 Review (revisions.md)
- 10/11 Verification
- 4/4 Quality Enforcement
- 0/3 Handoff (all minor wording)

**Overall: 99/110 FULL (90%), 8 PARTIAL (7%), 3 NOT DONE (3%)**
