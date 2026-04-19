# Repository Call Flows

**Use this when:** you need a maintainer mental model of what calls what in the shell-less package.

**Read this after:** `docs/repo-architecture-overview.md`.

**Do not confuse with:**
- `docs/repo-trace-project-creation.md` — the detailed scaffold trace
- `docs/prd-human-agent.md` — operator-facing product requirements

**Key files:**
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/presentation-core.mjs`
- `framework/runtime/services/scaffold-service.mjs`
- `framework/runtime/presentation-package.js`
- `framework/runtime/project-state.js`
- `framework/runtime/preview-server.mjs`
- `framework/runtime/runtime-app.js`
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/shared/project-claude-scaffold-package.mjs`

**Verification:** use this doc to find the right files, then run `npm test` plus a focused CLI smoke.

---

## One-line mental model

The package is:

```text
presentation CLI or project-local shim -> runtime core -> package/state/policy/preview/export services -> project files
```

## Flow 1: public CLI request path

This is the common entry for installed-package usage.

```text
presentation <family> ...
  -> framework/runtime/presentation-cli.mjs
  -> parsePresentationCliArgs(...)
  -> createPresentationCore(...)
  -> dispatch to init / inspect / status / audit / preview / export / finalize
  -> structured text or JSON envelope
```

### Why it matters
The CLI owns command parsing and output envelopes. It should stay thin.

## Flow 2: project-local shim path

This is the common entry once a project already exists.

```text
node .presentation/framework-cli.mjs <family> ...
  -> .presentation/framework-cli.mjs
  -> resolve pitch-framework/presentation-cli through normal Node resolution
  -> inject --project <project-root>
  -> runPresentationCli(...)
```

### Why it matters
The shim is a local adapter. It should stay portable and avoid hard-coded framework paths.

## Flow 3: init path

Used for:
- `presentation init --project /abs/path`
- `node framework/runtime/presentation-cli.mjs init --project /abs/path`

```text
presentation-cli runInitCommand(...)
  -> core.initProject(projectRoot, options)
  -> framework/runtime/services/scaffold-service.mjs createPresentationScaffold(...)
       -> validate empty target directory and slide count
       -> write authored root files from framework/templates/
       -> write .presentation/project.json
       -> write .presentation/intent.json
       -> write .presentation/package.generated.json
       -> write .presentation/runtime/render-state.json
       -> write .presentation/runtime/artifacts.json
       -> write .presentation/framework-cli.mjs
       -> optionally copy .presentation/framework/{base,overrides}
       -> scaffold .claude/* via framework/shared/project-claude-scaffold-package.mjs
       -> initialize git when available
  -> created file list + next steps returned to CLI
```

### Important consequence
If project shape changes, start in `scaffold-service.mjs`, not in CLI envelope code.

## Flow 4: inspect path

Used for:
- `presentation inspect package`

```text
presentation-cli runInspectCommand(...)
  -> core.inspectPackage(projectRoot, { target: 'package' })
  -> ensurePresentationPackageFiles(...)
       -> ensure .presentation/intent.json exists
       -> regenerate .presentation/package.generated.json
       -> ensure runtime-state files exist
  -> read render-state + artifacts
  -> getProjectState(...)
  -> return raw manifest/data + interpreted status summary
```

### Why it matters
`inspect package` is the raw package inventory view.

## Flow 5: status path

Used for:
- `presentation status`

```text
presentation-cli runStatusCommand(...)
  -> core.getStatus(projectRoot)
  -> getProjectState(projectRoot)
       -> ensure package files exist
       -> inspect authored source completeness
       -> classify policy blockers
       -> compare source fingerprint to render/artifact evidence
       -> derive workflow + nextFocus via status-service.js
  -> return workflow, blockers, facets, nextBoundary, nextFocus
```

### Why it matters
If workflow guidance is wrong, debug `project-state.js` and `status-service.js`.

## Flow 6: audit path

Used for:
- `presentation audit all`
- `presentation audit theme`
- `presentation audit canvas`
- `presentation audit boundaries`

```text
presentation-cli runAuditCommand(...)
  -> core.runAudit(projectRoot, options)
  -> select audit runner in framework/runtime/audit-service.js
  -> inspect authored files and package structure
  -> return deterministic issue list
  -> CLI exits 1 only for hard violations
```

### Why it matters
Audit is the deterministic validation path. It diagnoses authored content without silently editing it.

## Flow 7: preview path

Used for:
- `presentation preview serve`
- `presentation preview open`

```text
presentation-cli runPreviewCommand(...)
  -> core.previewPresentation(projectRoot, { mode })
  -> framework/runtime/preview-server.mjs previewPresentation(...)
       -> createRuntimeApp({ currentTarget })
       -> start temporary HTTP server
       -> serve /preview/
       -> runtime-app renders through deck-assemble.js
       -> optionally open preview URL in default browser
       -> keep server alive until stopped
```

### Why it matters
Preview is a runtime server concern now. There is one preview-serving path.

## Flow 8: package assembly path

This is the shared path behind preview, export, and finalize.

```text
project root
  -> ensurePresentationPackageFiles(...)
  -> deck-policy.js validates authored workspace
  -> deck-source.js lists valid slide folders
  -> deck-assemble.js builds the virtual presentation HTML
  -> runtime-app or capture/export consumers serve or render that result
```

### Why it matters
If assembly or policy changes, preview and delivery change together.

## Flow 9: export path

Used for:
- `presentation export pdf`
- `presentation export pdf --output-dir ... --output-file ...`
- `presentation export screenshots --output-dir ...`

```text
presentation-cli runExportCommand(...)
  -> core.exportPresentation(projectRoot, request)
  -> inspect package to normalize slide selections
  -> choose one of:
       a) canonical full-deck PDF path
       b) explicit extra PDF path
       c) screenshot export path
```

### 9a. Canonical full-deck PDF export

```text
core.exportPresentation(... target='pdf' with no explicit output path)
  -> presentation-ops-service finalizePresentation(...)
  -> writes <project-slug>.pdf at project root
  -> updates .presentation/runtime/render-state.json
  -> updates .presentation/runtime/artifacts.json
```

### 9b. Explicit extra PDF export

```text
core.exportPresentation(... target='pdf' with output path)
  -> presentation-ops-service exportDeckPdf(...)
  -> writes requested PDF inside the project
  -> updates latestExport in artifacts.json
  -> does not replace authored files
```

### 9c. Screenshot export

```text
core.exportPresentation(... target='screenshots')
  -> presentation-ops-service capturePresentation(...)
  -> captures selected slide PNGs into the requested output directory
```

### Why it matters
`export` is for explicit artifact emission. Canonical full-deck PDF export reuses the finalize path.

## Flow 10: finalize path

Used for:
- `presentation finalize`

```text
presentation-cli runFinalizeCommand(...)
  -> core.finalize(projectRoot)
  -> presentation-ops-service finalizePresentation(...)
       -> capture assembled deck through withRuntimeServer(...)
       -> compute issues from rendered output
       -> write canonical root PDF
       -> refresh render-state.json
       -> refresh artifacts.json
  -> CLI returns pass/fail + artifact list
```

### Why it matters
`finalize` is the canonical delivery path, not a general-purpose wrapper around arbitrary export destinations.

## Flow 11: Claude scaffold source path

Used during `init` only.

```text
scaffold-service.mjs
  -> framework/shared/project-claude-scaffold-package.mjs
  -> copy source files from project-agent/
  -> write .claude/AGENTS.md, .claude/CLAUDE.md, hooks, rules, skills, settings
```

### Why it matters
`project-agent/` provides scaffold source. It is not a separate runtime control plane.

## Fast file-routing map by flow

### If the bug is in command parsing or envelope shape
Read:
- `framework/runtime/presentation-cli.mjs`
- `framework/runtime/__tests__/presentation-cli.test.mjs`

### If the bug is in project status or package truth
Read:
- `framework/runtime/project-state.js`
- `framework/runtime/status-service.js`
- `framework/runtime/presentation-package.js`

### If the bug is in preview serving
Read:
- `framework/runtime/preview-server.mjs`
- `framework/runtime/runtime-app.js`
- `framework/runtime/deck-assemble.js`

### If the bug is in export or finalize
Read:
- `framework/runtime/services/presentation-ops-service.mjs`
- `framework/runtime/presentation-runtime-state.js`
- `framework/runtime/pdf-export.js`

### If the bug is in init or scaffolded project contents
Read:
- `framework/runtime/services/scaffold-service.mjs`
- `framework/shared/project-claude-scaffold-package.mjs`
- `project-agent/`

## What not to bypass

Do not bypass these seams:

- do not bypass `presentation-cli.mjs` for public command-shape changes
- do not bypass `presentation-core.mjs` when changing command semantics
- do not bypass `presentation-package.js` when refreshing deterministic structure
- do not bypass policy/assembly when changing preview or export assumptions
- do not bypass the project-local shim by hard-coding framework source paths into scaffolded projects
