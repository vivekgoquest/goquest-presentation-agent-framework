# Start Here

This repo is meant to be used through an agent such as Codex, Claude Code, or another coding agent.

You do not need to understand the codebase to use it.

## What You Do

Tell the agent:

- what the presentation is for
- who it is for
- what tone you want
- what facts, proof points, or messages must be included
- any docs, notes, or assets it should use

Then, when you want to watch the work live:

- run `npm run start`
- open `http://127.0.0.1:3000/`
- use `Open Folder` to open an existing project or `Create Presentation` to initialize a new one
- browse the project files in the left column
- use `Launch Codex`, `Launch Claude`, or `Open Shell` in the Agent panel
- if you want, type a task into the Agent panel and use `Send to Claude` or `Send to Codex`
- watch the live preview on the right

## What The Agent Does

The agent should follow the full contract in `AGENTS.md`.

At a high level it should:

- run `npm run setup` only when dependencies are missing
- create or update a presentation project folder
- convert your request into `brief.md` or `revisions.md`
- create `outline.md` first for decks with more than 10 slides
- keep the reusable deck visual system in `theme.css`
- build the slide content in `slides/<NNN-id>/slide.html`
- keep assets either deck-shared in `assets/` or slide-local in each slide folder
- use the project workspace at `/` to keep project files, agent controls, and preview visible together
- preview `/preview/` inside that console and use the Export PDF button for quick downloads
- inspect the preview, screenshots, and PDF, then revise CSS until it reads like a presentation
- run finalize
- hand back the finished PDF and review assets

## What You Will Get Back

You should receive everything inside that project folder:

- source files such as `brief.md`, `theme.css`, `slides/`, and `assets/`
- a PDF in `outputs/deck.pdf`
- screenshots in `outputs/slides/`
- a structured report in `outputs/report.json`
- a human-readable summary in `outputs/summary.md`

## Copy-Paste Prompt For Any Agent

```text
Read START-HERE.md and AGENTS.md in this repo.
Run npm run setup if dependencies are not installed yet.
Create or update a presentation project folder for my request.
Use one opened project folder as the source workspace and that same folder's outputs/ directory as the generated output folder.
If the project does not exist yet, pick a good folder path and run npm run new -- --project /abs/path-to-project.
If the project needs more than 10 slides, scaffold it with npm run new -- --project /abs/path-to-project --slides <count>.
If the project needs a local framework snapshot, add --copy-framework.
Follow AGENTS.md as the source of truth for the edit contract and validation rules.
Normalize my plain-English request into brief.md for new work or revisions.md for review changes.
For decks with more than 10 slides, replace every TODO marker in outline.md before building slides.
Keep the deck-wide visual authority in theme.css.
Use slides/<NNN-id>/slide.html as the source of truth for slide content.
Use optional slides/<NNN-id>/slide.css only for slide-local styling.
Keep assets either deck-shared in assets/ or slide-local in each slide folder.
For decks with more than 10 slides, build in batches of 5 and run npm run check -- --project /abs/path-to-project after each batch.
View the assembled deck at `/preview/` and download via the Export PDF button before running finalize.
Inspect the preview, downloaded PDF, and screenshots yourself. If it does not look like a presentation yet, revise theme.css or slide-local slide.css before finalizing.
Do not change the shared framework core unless it is truly required and you explain why.
Run npm run finalize -- --project /abs/path-to-project.
At the end, tell me:
1. the project folder path
2. the PDF path
3. the screenshot path
4. the summary path
5. what changed
6. any issues that still need my decision
```

## Example Requests

New deck:

```text
Create a 7-slide deck for enterprise buyers explaining our AI dubbing workflow.
Audience: media executives.
Tone: premium, credible, concise.
Must include: turnaround time, language coverage, QA process, and a clear CTA.
Use the attached case study PDF as source material.
```

Long deck:

```text
Create a 20-slide deck explaining how cities work after midnight.
Audience: municipal innovation teams and urban operations leaders.
Tone: clear, grounded, and presentation-ready.
Must include: transit, logistics, public safety, utilities, healthcare, and a closing operating model.
Use an outline-first workflow and build the slides in batches.
```

Revision:

```text
Update the existing deck to feel more premium.
Keep the slide order and the proof points.
Shorten slide 2.
Add one stronger CTA slide at the end.
```

Legacy note for existing workspaces:

- the old `decks/<slug>/` and `examples/<name>/` flows still work during migration
- new human-facing work should prefer `npm run new -- --project /abs/path` and `npm run start -- --project /abs/path`
