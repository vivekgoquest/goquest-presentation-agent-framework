# Start Here

You only need the desktop app workflow.

## 1) Launch

```bash
npm run setup
npm run start
```

## 2) Create or open a project

- Click **New** to scaffold a presentation project
- Or click **Open** for an existing project folder

## 3) Build with Claude

1. In the integrated terminal, run `claude`
2. Tell Claude what presentation you want
3. Claude works inside that project folder and follows the project `.claude/` contract

## 4) Outputs

After finalize, look in:

- `outputs/deck.pdf`
- `outputs/slides/`
- `outputs/report.json`
- `outputs/summary.md`

The project also keeps presentation package state in `.presentation/`:

- `project.json` for stable package identity
- `intent.json` for authorable deck intent
- `package.generated.json` for deterministic structural truth
- `runtime/` for render state, artifacts, and last-good evidence

This repo no longer supports browser operator mode or legacy `--deck` / `--example` targets.
