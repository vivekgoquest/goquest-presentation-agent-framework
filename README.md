# Goquest Presentation Agent Framework

A presentation framework where you describe the deck in plain English and an AI agent builds it. The framework handles slide assembly, policy validation, screenshot capture, and PDF export.

## Two ways to use it

### Desktop app (recommended)

```bash
npm run setup
npm run desktop:start
```

The desktop app opens with a welcome screen. Click **New** to create a project or **Open** to open an existing one. Once a project is open, you see three panes:

- **Filmstrip** (left) — numbered slide thumbnails, click to navigate
- **Preview** (center) — live slide rendering with snap-to-slide navigation
- **Terminal** (right) — a shell session already in the project folder

Type `claude` in the terminal to start building your deck. The preview updates automatically as files change.

### Browser mode (compatibility)

```bash
npm run setup
npm run start
```

Opens a preview server at `http://127.0.0.1:3000/`. The browser mode provides live preview, hot reload, and PDF export. It does not include the terminal or filmstrip.

## How it works

You describe the presentation. The agent builds it. The framework enforces structure.

Each project is a folder:

```
my-deck/
├── brief.md              # What the deck is about
├── theme.css             # Visual system (colors, typography, components)
├── slides/
│   ├── 010-intro/
│   │   └── slide.html    # Each slide is a standalone HTML fragment
│   ├── 020-problem/
│   │   └── slide.html
│   └── 030-close/
│       └── slide.html
├── assets/               # Images, logos
├── outputs/              # Generated PDF, screenshots, report
├── .presentation/
│   └── project.json      # Project metadata
└── .claude/              # Agent configuration (auto-discovered)
    ├── CLAUDE.md          # Editing rules
    ├── rules/             # Framework specs
    ├── skills/            # Workflows (/new-deck, /revise-deck, etc.)
    ├── hooks/             # Quality checks
    └── settings.json      # Hook config
```

## Agent configuration

Every scaffolded project includes a `.claude/` directory with:

- **CLAUDE.md** — the editing contract (cascade rules, banned patterns, required commands)
- **rules/** — framework specs loaded automatically at session start
- **skills/** — invocable workflows as slash commands:
  - `/new-deck` — create a new presentation from scratch
  - `/revise-deck` — update an existing deck
  - `/review-deck` — inspect a deck and plan revisions
  - `/review-deck-swarm` — multi-agent review with 5 parallel reviewers
  - `/fix-warnings` — resolve quality warnings
- **hooks/** — `check-slide-quality.mjs` runs after each agent response
- **settings.json** — hook configuration

When you type `claude` in the terminal, Claude Code reads all of this automatically.

## Layer contract

The CSS cascade is enforced:

`content < theme < canvas`

- `framework/canvas/` is structural and protected
- `theme.css` defines the deck-wide visual system
- `slides/*/slide.html` and optional `slides/*/slide.css` are content

Validation fails on inline styles, `!important`, unscoped CSS, and other violations. The full list is in `specs/authoring-rules.md`.

## Commands

```bash
npm run setup                                          # Install dependencies
npm run desktop:start                                  # Launch desktop app
npm run start                                          # Start browser preview server
npm run new -- --project /path/to/deck                 # Create a new project
npm run new -- --project /path/to/deck --slides 20     # With slide count
npm run check -- --project /path/to/deck               # Validate
npm run capture -- --project /path/to/deck /tmp/out    # Screenshot slides
npm run export -- --project /path/to/deck /tmp/out.pdf # Generate PDF
npm run finalize -- --project /path/to/deck            # Check + capture + export
npm test                                               # Run tests
```

## Repo structure

```
electron/          # Desktop app (Electron)
  main.mjs         #   App shell, protocol handler
  preload.cjs      #   IPC bridge
  renderer/        #   HTML, CSS, JS (filmstrip, preview, terminal)
  worker/          #   Worker process (project, terminal, watch services)

framework/         # Slide framework (host-agnostic)
  canvas/          #   Protected slide structure CSS
  client/          #   Browser JS (nav, animations, counters, export)
  runtime/         #   Assembly, validation, capture, export, services

templates/         # Scaffolding templates
  claude-*         #   Agent config templates (→ per-project .claude/)

specs/             # Framework specifications (source of truth)
prompts/           # Agent prompts (source of truth for skills)
examples/          # Example projects
```

## For contributors

Read `AGENTS.md` for the framework-level editing contract. The protected core (`framework/canvas/`, `framework/client/`, `framework/runtime/`) should not be edited during normal deck work.

The desktop app architecture is documented in `docs/electron-native-host-plan.md`.
