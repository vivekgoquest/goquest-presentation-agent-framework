# Trace: Project Creation

**Use this when:** you need to understand or change how `presentation init` creates a new project.

**Read this after:** `docs/repo-call-flows.md` and `docs/repo-architecture-overview.md`.

**Do not confuse with:**
- later authoring inside an existing project
- preview/export/finalize flows after scaffolding is complete

**Key files:**
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/presentation-core.mjs`
- `framework/runtime/services/scaffold-service.mjs`
- `framework/runtime/deck-paths.js`
- `framework/shared/project-claude-scaffold-package.mjs`
- `framework/templates/*`
- `project-agent/*`

**Verification:**
- `npm test`
- `node framework/runtime/presentation-cli.mjs init --project /abs/path --format json`
- when the project can resolve the installed `pitch-framework` package: `node /abs/path/.presentation/framework-cli.mjs status --format json`
- when the project can resolve the installed `pitch-framework` package: `node /abs/path/.presentation/framework-cli.mjs preview serve`

---

## What this flow is responsible for

Project creation must produce a complete shell-less presentation project that contains:

- authored source files at the root
- hidden package state in `.presentation/`
- a project-local CLI entrypoint at `.presentation/framework-cli.mjs`
- a scaffolded Claude adapter package in `.claude/`
- a git repository when available

## The full trace

## 1. The operator invokes `init`

Typical commands:

```bash
presentation init --project /abs/path/to/my-deck --slides 3
```

Or from this repository checkout:

```bash
node framework/runtime/presentation-cli.mjs init --project /abs/path/to/my-deck --slides 3
```

## 2. The CLI parses arguments

Primary file:
- `framework/runtime/presentation-cli.mjs`

Entry path:
- `parsePresentationCliArgs(argv)`
- `runInitCommand(parsed, command, core)`

What it validates:
- a command family exists
- `--project` is present
- `--slides` is a whole number when provided
- `--copy-framework` is a boolean flag

## 3. The runtime core receives the request

Primary file:
- `framework/runtime/presentation-core.mjs`

Entry path:
- `core.initProject(projectRoot, options)`

What it does:
- forwards to the scaffold service
- keeps CLI semantics separate from scaffold implementation details

## 4. The scaffold service validates the target

Primary file:
- `framework/runtime/services/scaffold-service.mjs`

Entry path:
- `createPresentationScaffold({ projectRoot }, options)`

Important checks:
- the target directory must be empty or absent
- current v1 scaffolding supports 1-10 slides only

If the directory is not empty, init fails before writing files.

## 5. Project paths are computed

Still in `scaffold-service.mjs`:
- `createPendingProjectPaths(...)`

What this computes:
- project root paths
- root authored file paths
- `.presentation/` file paths
- optional copied-framework paths
- slug and title derived from the target directory name

## 6. The initial slide plan is created

Still in `scaffold-service.mjs`:
- `createSlidePlan(slideCount)`

Behavior:
- slide folders use sparse numbering (`010`, `020`, `030`, ...)
- 1 slide creates only an intro slide
- 2 slides create intro + close
- 3+ slides create intro, middle generic slides, and close

This determines the initial `slides/<NNN-name>/slide.html` files.

## 7. Authored root files are written

Still in `scaffold-service.mjs`:
- `scaffoldIntoPaths(paths, options)`

Files written from `framework/templates/`:
- `brief.md`
- `theme.css`
- `slides/<NNN-name>/slide.html`
- `assets/.gitkeep`

Notes:
- current init does not scaffold `outline.md`
- slide-local `slide.css` files are optional and authored later when needed

## 8. Hidden package files are written

The scaffold service also writes:

- `.presentation/project.json`
- `.presentation/intent.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/framework-cli.mjs`

This is what makes the project self-describing and locally runnable.

## 9. The project-local CLI shim is rendered

Primary file:
- `framework/runtime/project-cli-shim.mjs`

What the shim does:
- resolves `pitch-framework/presentation-cli`
- injects the project root automatically
- keeps the project portable by avoiding hard-coded framework source paths

Normal usage after init, once the project can resolve the installed `pitch-framework` package, is:

```bash
cd /abs/path/to/my-deck
node .presentation/framework-cli.mjs status --format json
```

## 10. Copied-framework mode is recorded when requested

If `--copy-framework` is passed, init also writes:

- `.presentation/framework/base/`
- `.presentation/framework/overrides/`

The copied snapshot comes from:
- `framework/canvas/`
- `framework/client/`
- `framework/runtime/`
- `framework/templates/`

Without `--copy-framework`, the project stays in linked mode.

## 11. The Claude adapter package is scaffolded

Primary file:
- `framework/shared/project-claude-scaffold-package.mjs`

Source material comes from:
- `project-agent/project-agents-md.md`
- `project-agent/project-claude-md.md`
- `project-agent/project-dot-claude/*`

Files written into the project:
- `.claude/AGENTS.md`
- `.claude/CLAUDE.md`
- `.claude/settings.json`
- `.claude/hooks/*`
- `.claude/rules/*`
- `.claude/skills/*`

Important detail:
- the scaffold writes `.claude/AGENTS.md`
- it does **not** write a root-level `AGENTS.md`

## 12. Git is initialized when possible

Still in `scaffold-service.mjs`:
- `initializeProjectGitDirectory(projectRoot)`

Behavior:
- attempts `git init`
- reports whether `.git/` was created
- does not fail the whole scaffold if `git` is unavailable

## 13. The CLI returns a created-project envelope

Back in `presentation-cli.mjs`, `runInitCommand(...)` returns:

- `status: created`
- `projectRoot`
- `slideCount`
- the full created file list
- `nextSteps`
- git initialization status

That response is the machine-readable summary of the scaffold result.

## Resulting project shape

A newly created project contains:

### Authored workspace at the root
- `brief.md`
- `theme.css`
- `slides/*/slide.html`
- `assets/`

### Hidden package state
- `.presentation/project.json`
- `.presentation/intent.json`
- `.presentation/package.generated.json`
- `.presentation/runtime/render-state.json`
- `.presentation/runtime/artifacts.json`
- `.presentation/framework-cli.mjs`

### Project-local Claude adapter package
- `.claude/AGENTS.md`
- `.claude/CLAUDE.md`
- `.claude/settings.json`
- `.claude/hooks/*`
- `.claude/rules/*`
- `.claude/skills/*`

### Repository support files
- `.gitignore`
- `.git/` when available

## What to change for common project-creation requests

### Change default authored files or slide templates
Edit:
- `framework/templates/*`

### Change file layout or hidden package files
Edit:
- `framework/runtime/services/scaffold-service.mjs`
- `framework/runtime/deck-paths.js`
- `framework/runtime/presentation-package.js`
- `framework/runtime/presentation-runtime-state.js`

### Change the project-local shim
Edit:
- `framework/runtime/project-cli-shim.mjs`

### Change scaffolded Claude assets
Edit:
- `framework/shared/project-claude-scaffold-package.mjs`
- `project-agent/project-agents-md.md`
- `project-agent/project-claude-md.md`
- `project-agent/project-dot-claude/*`

## What not to do

- do not make `init` depend on an extra host shell
- do not hard-code framework source paths into generated projects
- do not move authored content into `.presentation/`
- do not treat `.claude/` as structural package truth
- do not write a root-level `AGENTS.md` unless the product contract changes intentionally

## Minimal verification after changes in this flow

1. `npm test`
2. `node framework/runtime/presentation-cli.mjs init --project /abs/path --format json`
3. inspect the generated project tree
4. if the project can resolve the installed package: `node /abs/path/.presentation/framework-cli.mjs status --format json`
5. if the project can resolve the installed package: `node /abs/path/.presentation/framework-cli.mjs audit all --format json`
