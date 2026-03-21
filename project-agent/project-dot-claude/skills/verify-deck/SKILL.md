---
name: verify-deck
description: Multi-agent deck verification. Launches 6 parallel agents that each open the rendered presentation in a browser and analyze it from a different angle (visual consistency, data accuracy, content quality, audience fit, typography, slide structure). Use for thorough QA before finalizing.
user-invocable: true
---

## INSTRUCTIONS FOR CLAUDE CODE

You are orchestrating a multi-agent verification swarm for an HTML presentation built with this framework.

### Step 1: Gather Context

Use AskUserQuestion to ask the user TWO questions:

**Question 1 — "Which project folder should I verify?"**
List the available project folders (directories containing `brief.md` and `slides/`). If only one candidate exists, confirm it.

Note for project folders:

- verify the preview at `/preview/` after runtime assembles the HTML in memory
- fix issues in `theme.css`, `slides/<NNN-id>/slide.html`, or optional `slides/<NNN-id>/slide.css`
- rely on `/preview/` for the rendered deck instead of touching any rendered HTML output directly

**Question 2 — "Who is the target audience for this presentation?"**
Let the user type freely. Examples: "investors", "enterprise clients", "conference attendees", "internal team", "potential buyers", etc. This context shapes the tone and calibration checks.

### Step 2: Locate Reference Documents

Search for any reference or guidelines documents the user may have placed in the framework directory or its parent (`.md` files, style guides, brand docs). If found, read them — they provide context for what the presentation should contain.

If a reference doc is found, pass its path to each agent. If not, agents will verify against universal presentation best practices only.

### Step 3: Launch Verification Agents

Launch ALL 6 agents IN PARALLEL in a single message. Each agent runs independently with its own Playwright browser session.

Every agent prompt MUST include:
- The absolute path to the project folder being verified
- The absolute path to the framework directory (for running the capture script)
- The target audience description from Step 1
- Path to any reference documents found in Step 2 (or "none")
- The command to run: `cd "<FRAMEWORK_DIR>" && npm run capture -- --project "<PROJECT_DIR>" "/tmp/deck-verify-<agent-name>-$(date +%s)"`
- Instructions to READ the resulting `report.json` after capture completes
- Instructions to READ the screenshot PNGs (Claude can read images) for visual analysis
- The specific checklist for that agent (copy the full checklist from the agent definition below)
- Instructions to output findings as: `CRITICAL / WARNING / NOTE` with slide IDs
- The agent MUST report even if everything passes — confirm what was checked

---

## AGENT DEFINITIONS

### Agent 1: VISUAL CONSISTENCY

**Name:** `visual-consistency`
**Focus:** Colors, spacing, shadows, branding elements, and visual coherence across all slides.

**Prompt template:**
```
You are a visual consistency auditor for a presentation deck. Your job is to verify that every slide looks polished, professional, and visually consistent.

1. Run the capture script to get screenshots and structured data:
   cd "<FRAMEWORK_DIR>" && npm run capture -- --project "<PROJECT_DIR>" "/tmp/deck-verify-visual-$(date +%s)"

2. Read the report.json from the output directory.

3. Read EVERY slide screenshot PNG file (slide-*.png) — you can view images. Examine each one carefully.

4. Check the following — report EVERY finding with severity (CRITICAL / WARNING / NOTE):

BRANDING ELEMENT PLACEMENT:
- If slides have logo pseudo-elements (::before / ::after), check they appear consistently on all non-hero slides
- Check report.json → consistency.slidesWithoutRightLogo and slidesWithoutLeftLogo
- Hero slides (with dark backgrounds) typically should NOT show logos — verify this is intentional
- Visually confirm branding elements are not overlapping content

COLOR CONSISTENCY:
- Eyebrow/label text should use a consistent accent color throughout
- Badge colors should be used meaningfully and consistently (same category = same color)
- Card backgrounds should be uniform across all slides
- The page background should be consistent
- No unexpected color variations between slides

SHADOW & BORDER CONSISTENCY:
- All slide cards should have the same shadow treatment
- Inner cards (.icard) should have consistent borders and backgrounds
- Border radius should be uniform across slides and inner elements

SPACING:
- Padding within slides should feel consistent
- Gap between grid items should be uniform within each grid type
- Vertical spacing between elements should feel rhythmic and intentional
- No cramped or awkwardly sparse areas

VISUAL POLISH:
- No text overlapping edges, logos, or other elements
- No orphaned elements or awkward whitespace
- All slides should look like they belong to the same presentation
- Overall professional quality — would this impress the target audience?

TARGET AUDIENCE: <AUDIENCE>

Output findings as a structured list with slide IDs. End with a visual quality score (1-10) and top 3 things to fix.
```

### Agent 2: DATA ACCURACY

**Name:** `data-accuracy`
**Focus:** Numbers, statistics, and internal consistency of all data points.

**Prompt template:**
```
You are a data accuracy auditor for a presentation deck. Your job is to verify every number, statistic, and data point for internal consistency.

1. Run the capture script:
   cd "<FRAMEWORK_DIR>" && npm run capture -- --project "<PROJECT_DIR>" "/tmp/deck-verify-data-$(date +%s)"

2. Read the report.json from the output directory.

3. If a reference document was provided at "<REFERENCE_DOC_PATH>", read it to cross-reference facts and figures.

4. Check the following — report findings with severity:

INTERNAL CONSISTENCY:
- Numbers mentioned in text should match data-count attribute values
- If the same statistic appears on multiple slides, it should be identical everywhere
- Table data should be internally consistent (e.g., totals should add up)
- Percentages should not exceed 100% or contradict each other

DATA-COUNT VERIFICATION:
- Check every [data-count] element: does the displayed text match the data-count value?
- Are prefix/suffix attributes rendering correctly?
- Do animated counter final values make sense?

FACTUAL CLAIMS:
- Flag any statistics or claims that seem unusually specific but unverifiable
- Flag round numbers that might be estimates presented as facts
- Flag any data that contradicts other data on a different slide
- If reference documents were provided, cross-reference all claims

TABLE INTEGRITY:
- Column headers should match the data below them
- No empty cells where data is expected
- Consistent formatting within columns (e.g., all dates in same format)

CROSS-SLIDE CONSISTENCY:
- Key numbers (counts, dates, names) should be identical wherever they appear
- If a name is spelled one way on one slide, it should be spelled the same everywhere
- Timeline or sequence data should be chronologically consistent

Output findings as a structured list with slide IDs. End with a data integrity score (1-10).
```

### Agent 3: CONTENT QUALITY

**Name:** `content-quality`
**Focus:** Writing quality, completeness, and absence of placeholder content.

**Prompt template:**
```
You are a content quality auditor. Your job is to check the presentation for writing quality, completeness, and professionalism.

1. Run the capture script:
   cd "<FRAMEWORK_DIR>" && npm run capture -- --project "<PROJECT_DIR>" "/tmp/deck-verify-content-$(date +%s)"

2. Read the report.json — focus on allText, headings, bodyTexts, and takeaways for each slide.

3. If a reference document was provided at "<REFERENCE_DOC_PATH>", read it to check content alignment.

4. Check the following — report findings with severity:

PLACEHOLDER & INCOMPLETE CONTENT (CRITICAL):
- Any text that says "Lorem ipsum", "[placeholder]", "TBD", "TODO", "insert here", "your text"
- Any slide with suspiciously generic content that looks like template boilerplate
- Empty sections or slides with only headings and no body content
- Image placeholders without actual images

WRITING QUALITY:
- Headings should be clear and informative (not vague like "Overview" without context)
- Body text should be complete sentences or intentional fragments (not truncated)
- No grammatical errors, typos, or awkward phrasing
- Consistent voice and tone throughout the deck
- No unnecessarily jargon-heavy language (unless the audience expects it)

CONTENT STRUCTURE:
- Each slide should have a clear purpose — one main message per slide
- Eyebrow labels should accurately categorize the slide content
- The narrative should flow logically from slide to slide
- The opening should hook, the middle should inform, the close should call to action

SLIDE CONTENT DENSITY:
- No slide should be overloaded with text (wall of text = unreadable in a presentation)
- No slide should be empty or underutilized
- Balance between text, visuals, and whitespace

CALLS TO ACTION:
- The closing slide should have a clear next step or call to action
- Contact information or follow-up details should be present if appropriate

TARGET AUDIENCE: <AUDIENCE>
Does the content match what this audience needs to see? Is the level of detail appropriate?

Output findings as a structured list with slide IDs. End with a content quality score (1-10).
```

### Agent 4: AUDIENCE CALIBRATION

**Name:** `audience-calibration`
**Focus:** Is the presentation properly tailored for its intended audience?

**Prompt template:**
```
You are an audience calibration specialist. Your job is to verify that this presentation is properly tailored for its target audience.

1. Run the capture script:
   cd "<FRAMEWORK_DIR>" && npm run capture -- --project "<PROJECT_DIR>" "/tmp/deck-verify-audience-$(date +%s)"

2. Read the report.json.

3. Read each slide screenshot to understand the visual impression.

4. If a reference document was provided at "<REFERENCE_DOC_PATH>", read it for audience context.

TARGET AUDIENCE: <AUDIENCE>

5. Check the following — report findings with severity:

TONE CALIBRATION:
- Is the language register appropriate for this audience?
  - Executive audience: confident, concise, outcome-focused
  - Technical audience: detailed, precise, evidence-based
  - Creative audience: visual, story-driven, inspiring
  - General audience: accessible, clear, no jargon
- Is the deck too formal or too casual for this audience?
- Does it avoid being condescending or assuming too much knowledge?

INFORMATION HIERARCHY:
- Does the deck lead with what THIS audience cares about most?
- Is the most important information above the fold (early slides)?
- Are supporting details appropriately subordinated (later slides, smaller text)?
- Would this audience need more or fewer slides?

PERSUASION STRUCTURE:
- Does the opening create enough interest for this audience to keep reading?
- Is the evidence type appropriate? (data for analysts, stories for creatives, outcomes for executives)
- Does the closing give this audience a clear, easy next step?

VISUAL APPROPRIATENESS:
- Is the design sophistication matched to the audience?
- Are charts/tables/data visualizations appropriate for this audience's data literacy?
- Does the color scheme and typography feel right for this context?

MISSING ELEMENTS:
- What would this audience expect to see that is not present?
- Is there content that would be irrelevant or off-putting for this audience?
- Are credentials/social proof/testimonials appropriate and present?

Output findings as a structured list. End with an audience-fit score (1-10) and top 3 recommendations to better serve this audience.
```

### Agent 5: TYPOGRAPHY & READABILITY

**Name:** `typography-readability`
**Focus:** Font sizes, contrast, text overflow, and readability at PDF export size (960x540 points).

**Prompt template:**
```
You are a typography and readability auditor. Your job is to ensure every slide is legible and well-typeset, especially when exported to PDF.

1. Run the capture script:
   cd "<FRAMEWORK_DIR>" && npm run capture -- --project "<PROJECT_DIR>" "/tmp/deck-verify-typo-$(date +%s)"

2. Read the report.json — focus on typography, overflowDetected, and styles fields.

3. Read EVERY slide screenshot PNG (slide-*.png) — examine text rendering carefully.

4. Check the following — report findings with severity:

TEXT OVERFLOW & CLIPPING (CRITICAL if found):
- Check report.json → each slide's overflowDetected field — any true = problem
- Visually inspect: is any text cut off at slide boundaries?
- Are any words running into logos or branding elements?
- Is any text hidden behind card edges?

FONT SIZE HIERARCHY:
- Hero/title text should be the largest on any slide
- Section titles should be clearly distinguished from body text
- Labels and eyebrows should be small but readable
- Body text should never be below ~14px equivalent
- Statistical numbers should be prominent
- At 960x540 PDF size (~13"x7.5"), would all text remain readable?

FONT WEIGHT USAGE:
- Headings bold (700-900), body regular (400-500)
- No text using weight 300 or lighter at small sizes (illegible)
- Weight should create clear visual hierarchy

CONTRAST:
- Dark text on light backgrounds: sufficient contrast
- Light text on dark backgrounds (hero slides): sufficient contrast
- Badge text readable against badge background colors
- Muted/secondary text not TOO muted to read

LINE LENGTH & WRAPPING:
- Body text lines ideally under 80 characters wide
- Headings should wrap gracefully — no single orphan words on a line
- Table cells should not have awkward mid-word wrapping

VERTICAL RHYTHM:
- Consistent spacing between heading → body → next element
- Inner cards should have matching internal padding
- No jarring spacing inconsistencies between slides

Output findings as a structured list with slide IDs. End with a readability score (1-10) and the most critical fixes.
```

### Agent 6: SLIDE STRUCTURE & SYMMETRY

**Name:** `slide-structure`
**Focus:** Grid alignment, card symmetry, aspect ratios, slide ordering, and structural completeness.

**Prompt template:**
```
You are a structural integrity auditor. Your job is to verify layout symmetry, grid alignment, and overall presentation structure.

1. Run the capture script:
   cd "<FRAMEWORK_DIR>" && npm run capture -- --project "<PROJECT_DIR>" "/tmp/deck-verify-structure-$(date +%s)"

2. Read the report.json — focus on grids, dimensions, innerCards, and the consistency section.

3. Read EVERY slide screenshot PNG (slide-*.png) — examine layouts carefully.

4. Check the following — report findings with severity:

GRID SYMMETRY:
- For every grid (.g2, .g3, .g4), check grids → widthsEqual — all children should have equal widths
- Check grids → topsAligned — grid children should be top-aligned
- Inner cards within the same grid should have visually balanced heights
- If a .g3 grid has only 2 items, flag as WARNING — use .g2 or add a third
- If a .g2 grid has only 1 item, flag as WARNING — remove the grid wrapper

CARD CONSISTENCY:
- Inner cards within the same grid should have matching internal structure
- No card should be dramatically taller or shorter than its siblings
- Card content should follow a consistent pattern (e.g., badge → title → text)

SLIDE DIMENSIONS (CANVAS IS SACROSANCT):
- ALL slides must maintain 16:9 aspect ratio (dimensions.aspectRatio should be ~1.778)
- All slides should have consistent max-width
- Flag any slide with non-16:9 aspect ratio as CRITICAL
- Flag any slide with unusual dimensions

SLIDE COMPOSITION:
- Each slide should have a clear visual focal point
- No slide should be more than ~30% empty space (underutilized)
- No slide should be so packed that content feels cramped
- Visual weight should be balanced (not all content shoved to one side)

REQUIRED STRUCTURE:
- First slide should be a hero/title slide
- Last slide should be a closing/CTA slide
- The narrative flow between slides should be logical
- Every <section> with content should have the data-slide attribute (otherwise it won't export to PDF)
- Flag any orphan sections missing data-slide

DATA-SLIDE INTEGRITY:
- Count of data-slide sections should match expected slide count
- Each data-slide section should contain a .slide element
- No nested data-slide sections

Output findings as a structured list with slide IDs. End with a structural integrity score (1-10) and top fixes.
```

---

### Step 4: Synthesize Results

After ALL 6 agents complete, synthesize their findings into a single report:

1. **Collect all CRITICAL findings** — these MUST be fixed
2. **Collect all WARNING findings** — these SHOULD be fixed
3. **Collect all NOTE findings** — nice-to-have improvements
4. **Compute an overall score** — average of all 6 agent scores

Present to the user:

```
## Verification Report: <filename>
### Target Audience: <audience>
### Overall Score: X.X / 10

### CRITICAL Issues (must fix)
1. [visual-consistency] Slide "intro" — Logo overlaps heading text
2. [slide-structure] Slide "data" — Aspect ratio is 1.5, not 16:9
...

### WARNINGS (should fix)
1. [typography] Slide "details" — Body text too small for PDF export
2. [data-accuracy] Slides "hero" vs "summary" — Employee count differs (150 vs 120)
...

### NOTES (nice to have)
1. [slide-structure] Slide "features" — g3 grid has only 2 items
...

### Agent Scores
| Agent | Score |
|-------|-------|
| Visual Consistency | X/10 |
| Data Accuracy | X/10 |
| Content Quality | X/10 |
| Audience Calibration | X/10 |
| Typography & Readability | X/10 |
| Slide Structure & Symmetry | X/10 |
```

### Step 5: Fix Issues

After presenting the report, ask the user:

**"Should I fix the CRITICAL and WARNING issues?"**

If yes:
- Fix CRITICAL issues first, then WARNING
- Do NOT fix NOTE-level issues unless the user specifically asks
- Edit `slides/<NNN-id>/slide.html` for content or structure changes
- Edit optional `slides/<NNN-id>/slide.css` for slide-local styling fixes
- Edit `theme.css` only when the fix belongs to the deck-wide visual system
- NEVER rewrite the rendered deck directly; keep fixes in project `slides/<NNN-id>/` folders instead of touching rendered HTML output or framework files
- After fixing, re-run ONLY the affected agents to confirm resolution
