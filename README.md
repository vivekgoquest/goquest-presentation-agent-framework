# Goquest Presentation Agent Framework

Electron-native presentation builder with project-folder scaffolding, strict deck policy checks, screenshot capture, and PDF export.

## Quickstart

```bash
npm run setup
npm run start
```

`npm run start` launches the desktop app.

1. Click **New** to scaffold a project (or **Open** to use an existing one).
2. Type `claude` in the integrated terminal.
3. Describe the deck you want.

Scaffolded projects now include a root `AGENTS.md` contract plus structured
state in `.presentation/`. Agents should start from `AGENTS.md`, not from the
vendor adapter layer.

## Project contract

Each presentation is an independent project folder:

```text
my-deck/
├── AGENTS.md
├── brief.md
├── theme.css
├── outline.md
├── slides/
│   ├── 010-intro/slide.html
│   ├── 020-slide-02/slide.html
│   └── 030-close/slide.html
├── assets/
├── outputs/
├── .presentation/
│   ├── project.json
│   ├── intent.json
│   ├── package.generated.json
│   ├── runtime/
│   │   ├── render-state.json
│   │   ├── artifacts.json
│   │   └── last-good.json
│   └── framework-cli.mjs
└── .claude/
    ├── CLAUDE.md
    ├── rules/
    ├── skills/
    ├── hooks/
    └── settings.json
```

The cascade contract is enforced as `content < theme < canvas`.

The presentation package model is:

- source is authored
- intent is authored
- structure is deterministic
- runtime evidence is deterministic
- git is the history lane

The `.claude/` folder is a vendor-specific adapter package. Its hooks are local
entrypoints only; the actual workflow orchestration lives in the framework
application layer. The project itself is self-describing through `AGENTS.md`
plus `.presentation/*`. Named product actions now follow one canonical
application-owned workflow per action, regardless of whether the trigger is the
Electron UI, a hook, or an agent adapter.

## Commands (project-only)

```bash
npm run setup
npm run start
npm run new -- --project /abs/path
npm run new -- --project /abs/path --slides 20
npm run check -- --project /abs/path
npm run capture -- --project /abs/path /tmp/out
npm run export -- --project /abs/path /tmp/out.pdf
npm run finalize -- --project /abs/path
npm test
```

## Source layout

```text
electron/          # Desktop app host
framework/         # Canvas/client/runtime core
framework/templates/ # Source of scaffolded deck content files
project-agent/     # Source of scaffolded project AGENTS.md and .claude assets
.claude/           # Repo maintainer agent context
docs/
```

## Contributor guidance

See [AGENTS.md](/Users/vivek/Goquest%20Media%20Dropbox/Vivek%20Lath/Tech%20and%20Code/presentation-framework/AGENTS.md) for maintainer rules and boundaries.
