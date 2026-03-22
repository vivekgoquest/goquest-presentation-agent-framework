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
3. Claude works inside that project folder and starts from the project `AGENTS.md` contract
4. Claude then uses the project `.claude/` adapter for vendor-specific hooks and skills

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

The `.claude/` directory is adapter glue, not the source of project truth.
Its hook scripts are local entrypoints that delegate to framework-owned
workflow orchestration.

This repo no longer supports browser operator mode or legacy `--deck` / `--example` targets.
