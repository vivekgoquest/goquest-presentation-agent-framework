# Start Here

You do not need to understand the codebase to use this.

## What you do

1. Open the desktop app: `npm run desktop:start`
2. Click **New** to create a project (or **Open** for an existing one)
3. Type `claude` in the terminal
4. Tell Claude what you want the presentation to be about

That's it. Claude reads the project's `.claude/` directory automatically and knows the rules, skills, and quality hooks.

## What the agent does

- Converts your request into `brief.md`
- Designs `theme.css` (the visual system)
- Builds each slide in `slides/<NNN-id>/slide.html`
- Runs `npm run finalize` to validate, capture screenshots, and export PDF
- Hands back the finished deck

The preview pane updates live as files change. The filmstrip shows each slide. You can click slides to navigate or use arrow keys.

## What you get back

Inside the project folder:

- `outputs/deck.pdf` — the finished PDF
- `outputs/slides/` — per-slide screenshots
- `outputs/report.json` — structured data
- `outputs/summary.md` — human-readable summary

## Skills

With Claude running in the terminal, type any of these:

- `/new-deck` — guided workflow for a new presentation
- `/revise-deck` — update an existing deck
- `/review-deck` — inspect and plan revisions
- `/review-deck-swarm` — 5 parallel reviewers with different perspectives
- `/fix-warnings` — resolve quality check warnings

## Example requests

New deck:

```
Create a 7-slide deck for enterprise buyers explaining our AI dubbing workflow.
Audience: media executives.
Tone: premium, credible, concise.
Must include: turnaround time, language coverage, QA process, and a clear CTA.
```

Long deck:

```
Create a 20-slide deck explaining how cities work after midnight.
Audience: municipal innovation teams.
Tone: clear, grounded, presentation-ready.
Must include: transit, logistics, public safety, utilities, healthcare, and a closing model.
```

Revision:

```
Update the existing deck to feel more premium.
Keep the slide order and the proof points.
Shorten slide 2.
Add one stronger CTA slide at the end.
```

## Browser mode

If you prefer browser mode instead of the desktop app:

```bash
npm run start
```

Opens at `http://127.0.0.1:3000/`. Provides live preview and PDF export but no integrated terminal or filmstrip.
