---
name: new-deck
description: Create a new presentation from a plain-English request. Use when the user wants to build a new deck from scratch.
user-invocable: true
---

Use the public CLI before the project exists.
Choose a good absolute folder path and run:
`presentation init --project /abs/path-to-project`

If you want a different initial size within the supported v1 range, use:
`presentation init --project /abs/path-to-project --slides <count>`

Shell-less v1 init currently supports 1-10 slides. If the project later grows beyond 10 slides, add `/abs/path-to-project/outline.md` before validation and continue buildout in batches of 5.

If the project needs a vendored framework snapshot, add:
`--copy-framework`

After scaffolding the project, read `/abs/path-to-project/.claude/AGENTS.md` first, then `/abs/path-to-project/.claude/CLAUDE.md` for Claude-specific helper guidance.

Then:
- follow `/abs/path-to-project/.claude/AGENTS.md` as the project contract and `/abs/path-to-project/.claude/CLAUDE.md` as the Claude adapter
- convert my request into `/abs/path-to-project/brief.md`
- if the project later grows beyond 10 slides, add `/abs/path-to-project/outline.md`, lock the story there, and remove any TODO markers before validation
- design the theme first: finalize `/abs/path-to-project/theme.css` with the full visual system (palette, typography, components) before writing any slide HTML
- design each planned slide before implementation: decide which primitives it will use, how it differs from neighbors, and whether it needs images; if an outline exists, record the design notes there
- do not start building slide HTML until the theme is finalized and every planned slide has a design decision
- build the source slides in `/abs/path-to-project/slides/<NNN-id>/slide.html` following the per-slide design decisions
- if the project later grows beyond 10 slides, build in batches of 5 and run `node .presentation/framework-cli.mjs audit all` after each batch
- use optional `/abs/path-to-project/slides/<NNN-id>/slide.css` only when a slide needs local CSS
- keep assets either deck-shared in `/abs/path-to-project/assets/` or slide-local in each slide folder
- keep framework changes out of scope unless truly necessary
- inspect the preview, screenshots, and downloaded PDF yourself; if it does not read like a presentation yet, revise `theme.css` or slide-local `slide.css` before finalizing
- run `node .presentation/framework-cli.mjs finalize`

At the end, tell me:
1. the project folder path
2. whether the project is linked or copied mode
3. the PDF path
4. the screenshot path
5. the summary path
6. any open questions that still affect the deck
