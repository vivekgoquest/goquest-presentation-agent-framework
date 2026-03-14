# Electron Packaging Plan

## What we're building

A native desktop app that wraps the existing presentation workspace UI. The user double-clicks an app icon, gets a native window with a real terminal on the left and live slide preview on the right. No browser tabs, no manual URL entry, no `npm run start`.

---

## Foundational decision

**Electron loads the console from the embedded Express server (`loadURL`), not from `file://` (`loadFile`).**

The current console (project-console.html line 7, project-console.js throughout) assumes an HTTP origin — relative stylesheet paths, relative `/api/...` fetches, WebSocket URLs derived from `window.location`, and an iframe pointed at `/preview/`. Making these work under `file://` would require rewriting every URL and replacing the entire transport layer. Instead, the Electron main process starts the Express server on a loopback port and loads the console from it. This means:

- Zero changes to project-console.html, project-console.css, or project-console.js in Phase 1
- The WebSocket terminal, REST API, preview iframe, and SSE live-reload all work unchanged
- The terminal lifecycle contract (launch, restart, clear, reveal, status) stays on the server in terminal-session.js
- The loopback server is an implementation detail inside the app — the user never sees a URL

---

## Current architecture (browser-based)

```
User's browser
  └─ project-console.html/css/js
       ├─ xterm.js (terminal rendering)
       ├─ WebSocket → server.mjs → terminal-session.js → node-pty (with Python fallback)
       ├─ iframe src="/preview/" (slide preview)
       └─ fetch("/api/...") (project state, export, finalize)

server.mjs (Express + WebSocket)
  ├─ Serves static files (HTML, CSS, JS, node_modules)
  ├─ Assembles deck HTML on demand via deck-assemble.js
  ├─ WebSocket bridge to terminal-session.js (full lifecycle: launch/restart/clear/reveal/status)
  ├─ REST API: /api/project/*, /api/export, /api/console/terminal/*
  └─ SSE: /api/live-reload (file watcher)
```

## Target architecture (Electron)

```
Electron main process (ESM — main.mjs)
  ├─ Creates BrowserWindow
  ├─ Starts server.mjs as child process on random loopback port
  ├─ Loads console from http://localhost:{port}/ (not file://)
  ├─ Handles app lifecycle (open project, recent projects, menus)
  └─ Invokes framework scripts directly via fork() — no npm

Everything below is UNCHANGED:
  server.mjs
    ├─ terminal-session.js owns PTY (node-pty with Python fallback)
    ├─ WebSocket bridge, REST API, SSE live-reload
    └─ All existing routes and handlers

  project-console.html/css/js
    ├─ All relative URLs resolve against http://localhost:{port}
    ├─ WebSocket connects to ws://localhost:{port}/api/console/terminal
    └─ Zero changes needed
```

**Key difference from v1 of this doc:** Electron does NOT own the PTY. The embedded server's terminal-session.js does, exactly as today. This preserves the full terminal contract (launch/restart/clear/reveal/status endpoints) and the Python PTY fallback (terminal-session.js:407-438) which is especially valuable in Electron where native node-pty rebuild problems are common.

---

## File structure

```
presentation-app/
  ├─ package.json              (ESM, Electron + electron-builder config)
  ├─ main.mjs                  (Electron main process — ESM)
  ├─ preload.cjs               (IPC bridge — CommonJS, Electron requirement)
  ├─ framework/                (existing framework, unchanged)
  │   ├─ console/              (project-console.html/css/js — unchanged)
  │   ├─ runtime/              (server.mjs, terminal-session.js, etc. — unchanged)
  │   ├─ canvas/
  │   └─ client/
  ├─ templates/
  ├─ prompts/
  ├─ specs/
  └─ build/                    (electron-builder output)
      ├─ mac/                  (.dmg)
      ├─ win/                  (.exe / .msi)
      └─ linux/                (.AppImage / .deb)
```

## Changes to existing files

### Phase 1: None

Because the console loads from the embedded HTTP server, all existing files work unchanged. The WebSocket terminal, REST API calls, preview iframe, and SSE live-reload all resolve against the same HTTP origin they do today.

### Future optimization (Phase 5, optional)

Move PTY ownership from the server to Electron main process via IPC. This removes the WebSocket hop for terminal I/O (marginal latency win). Only pursue after the HTTP-based version ships and works.

---

## New files

### main.mjs — Electron main process (ESM)

Note: This repo uses `"type": "module"` (package.json line 4), so the main process is ESM. Electron supports ESM main entry as of Electron 28+.

Note: Electron's `child_process.fork()` depends on the `runAsNode` fuse which is typically disabled in hardened production builds. Use Electron's `utilityProcess.fork()` instead — it is designed for exactly this use case (long-running Node.js child processes) and does not depend on the runAsNode fuse.

```js
import { app, BrowserWindow, dialog, utilityProcess } from 'electron';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import getPort from 'get-port';

const __dirname = dirname(fileURLToPath(import.meta.url));
let win, serverUtility, serverPort;

function isProjectFolder(folderPath) {
  // A valid project has .presentation/project.json (created by scaffold)
  return existsSync(resolve(folderPath, '.presentation', 'project.json'));
}

async function startServer(projectPath) {
  serverPort = await getPort();
  // utilityProcess.fork() — Electron's recommended way to spawn Node child processes
  // Does not depend on the runAsNode fuse, works in hardened builds
  serverUtility = utilityProcess.fork(resolve(__dirname, 'framework/runtime/server.mjs'), [
    String(serverPort),      // positional numeric arg (server.mjs:31)
    '--project', projectPath,
  ]);

  // Wait for server to be ready, with timeout
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server failed to start')), 10000);
    const check = () => {
      fetch(`http://127.0.0.1:${serverPort}/api/project/meta`)
        .then((res) => { clearTimeout(timeout); resolve(); })
        .catch(() => setTimeout(check, 100));
    };
    check();
  });
}

async function openProject(projectPath) {
  await startServer(projectPath);
  win = new BrowserWindow({
    width: 1440, height: 900,
    webPreferences: { preload: resolve(__dirname, 'preload.cjs') },
  });
  win.loadURL(`http://127.0.0.1:${serverPort}/`);
}

app.whenReady().then(async () => {
  // Phase 2 will add a proper project picker with recent projects.
  // For now, prompt for a folder and validate it before starting.
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled) { app.quit(); return; }

  const chosen = result.filePaths[0];
  if (!isProjectFolder(chosen)) {
    // Not a presentation project — offer to create one or re-pick
    // Phase 2: show launcher with "New Presentation" + "Open different folder"
    // For now, scaffold it automatically
    const newDeckPath = resolve(__dirname, 'framework/runtime/new-deck.mjs');
    const scaffoldProcess = utilityProcess.fork(newDeckPath, ['--project', chosen, '--slides', '3']);
    await new Promise((resolve) => scaffoldProcess.on('exit', resolve));
  }

  await openProject(chosen);
});

app.on('window-all-closed', () => {
  if (serverUtility) serverUtility.kill();
  app.quit();
});
```

### preload.cjs — IPC bridge (CommonJS)

Electron preload scripts must be CommonJS even in ESM projects — this is an Electron constraint, not a repo convention issue.

```js
const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal bridge for future IPC needs (Phase 5)
contextBridge.exposeInMainWorld('electronApp', {
  isElectron: true,
});
```

In Phase 1, the preload is minimal — the console communicates with the server via HTTP/WebSocket as it already does. The preload becomes important in Phase 5 if PTY ownership moves to the main process.

### Launcher / project picker (Phase 2)

A simple screen shown on first launch:
- "Open existing project" → native folder picker dialog
- "New presentation" → folder picker, then `fork('framework/runtime/new-deck.mjs', [...])`
- Recent projects list (stored in Electron's userData via electron-store)

Note: The packaged app invokes `new-deck.mjs` directly via `fork()` — not `npm run new`. All framework scripts (check, finalize, export, capture) are called the same way. No npm, no shell, no PATH dependency.

---

## Packaging with electron-builder

### package.json additions

```json
{
  "main": "main.mjs",
  "build": {
    "appId": "com.goquest.presentation",
    "productName": "Goquest Presentations",
    "mac": {
      "category": "public.app-category.productivity",
      "target": ["dmg", "zip"],
      "icon": "assets/icon.icns"
    },
    "win": {
      "target": ["nsis", "portable"],
      "icon": "assets/icon.ico"
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Office"
    },
    "files": [
      "main.mjs",
      "preload.cjs",
      "framework/**",
      "templates/**",
      "prompts/**",
      "specs/**",
      "node_modules/**"
    ],
    "extraResources": [
      { "from": "playwright-browsers", "to": "browsers" }
    ]
  }
}
```

### Native module handling

```bash
# Rebuild node-pty for Electron's Node version
npx electron-rebuild

# Add to postinstall in package.json
"postinstall": "electron-rebuild"
```

If node-pty rebuild fails on a user's machine at runtime, `terminal-session.js:427` catches the error and falls back to the Python PTY bridge. This fallback is preserved intentionally — it is especially valuable in Electron where native module rebuild problems are common.

### Playwright browser bundling

Playwright's default browser install location is the OS cache (`~/Library/Caches/ms-playwright` on Mac), NOT inside `node_modules`. The build must explicitly install browsers into a known directory and bundle that directory via `extraResources`.

```bash
# At build time: install Chromium into a local directory we control
PLAYWRIGHT_BROWSERS_PATH=./playwright-browsers npx playwright install chromium
```

This creates `playwright-browsers/` in the project root. electron-builder copies it to `resources/browsers/` in the packaged app via the `extraResources` config above.

At runtime, main.mjs must set the env var before spawning the server:

```js
process.env.PLAYWRIGHT_BROWSERS_PATH = resolve(process.resourcesPath, 'browsers');
```

### Build commands

```bash
# Development
npx electron .

# Pre-build: install Playwright browsers into bundleable location
PLAYWRIGHT_BROWSERS_PATH=./playwright-browsers npx playwright install chromium

# Package for current platform
npx electron-builder --dir

# Build distributable
npx electron-builder --mac --win --linux
```

### Binary size estimate

| Component | Size |
|-----------|------|
| Electron runtime | ~85MB |
| Node modules (xterm, node-pty, express, etc.) | ~15MB |
| Playwright + Chromium (for PDF export) | ~150MB |
| dugite (portable git) | ~30MB |
| Framework code + templates + prompts | ~1MB |
| **Total** | **~280MB** |

Playwright's bundled Chromium is the biggest contributor. If PDF export can be deferred to a first-run download, the initial binary drops to ~130MB.

### Git for edit history

The app bundles [dugite](https://github.com/desktop/dugite) — the same portable git that GitHub Desktop and VS Code use. Every presentation project gets a local git repo initialized at scaffold time. The Stop hook auto-commits when quality checks pass clean (0 warnings), so every commit represents a valid deck state.

- `dugite` is added as a dependency in package.json
- In main.mjs, set `LOCAL_GIT_DIRECTORY` env var to dugite's bundled git path before forking the server
- The hook script (`check-slide-quality.mjs`) and scaffold script (`new-deck.mjs`) call `git` via `execFileSync` — they use system git in dev, dugite's portable git in the packaged app
- If git is unavailable at runtime, both scripts skip silently — edit history is optional, never blocks the workflow

---

## What the user experiences

1. Download `Goquest Presentations.dmg` (or .exe)
2. Drag to Applications (or install)
3. Double-click the app icon
4. See project picker: "Open project" or "New presentation"
5. Pick a folder → workspace opens
6. Left: native terminal (type `claude` to start, or click quick-action buttons)
7. Right: live slide preview with slide navigation
8. Quick-action buttons: Critique, QA Check, Fix Warnings, Finalize, Export PDF
9. `.claude/` hooks activate automatically when Claude starts
10. Finalize → PDF appears in outputs/

No browser tabs. No manual URL entry. No `npm run start`. The embedded Express server runs on a loopback port as an internal implementation detail — the user never sees or interacts with it.

---

## Implementation phases

### Phase 1: Proof of concept (1-2 days)
- Electron shell: main.mjs (ESM) + preload.cjs (CJS)
- Start server.mjs as child process on random port via `fork()`, passing port as positional arg
- `win.loadURL(`http://127.0.0.1:${port}/`)` — not loadFile
- Terminal, preview, quick actions all work with zero changes to console code
- Hardcoded project path (folder picker dialog)
- Verify: terminal lifecycle (launch/restart/clear), preview, quick actions, export

### Phase 2: Project management (2-3 days)
- Launcher/project picker screen
- Recent projects (electron-store)
- "New presentation" flow: `fork('framework/runtime/new-deck.mjs', [...])`
- App menus (File → Open, New, Recent)
- All framework scripts invoked via `fork()` — no npm

### Phase 3: Polish and packaging (2-3 days)
- electron-builder configuration
- App icons and branding
- Auto-updater (electron-updater)
- Code signing (Mac notarization, Windows signing)
- First-run experience

### Phase 4: Playwright bundling (1-2 days)
- Bundle Playwright's Chromium with the app via extraResources
- Set `PLAYWRIGHT_BROWSERS_PATH` to the bundled location
- Or: download on first PDF export
- Test PDF export and capture in packaged app

### Phase 5: IPC terminal optimization (optional, future)
- Move PTY ownership from server to Electron main process
- Replace WebSocket terminal with IPC (latency win)
- Only pursue after HTTP-based version ships and works
- Requires changes to project-console.js (WebSocket → IPC)

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| node-pty native module needs rebuild for Electron | `electron-rebuild` in postinstall; Python PTY fallback in terminal-session.js catches runtime failures |
| Playwright browsers not found in packaged app | Pre-build step installs Chromium into `playwright-browsers/` via `PLAYWRIGHT_BROWSERS_PATH`; bundled via `extraResources`; main.mjs sets the env var at runtime pointing to `process.resourcesPath/browsers` |
| child_process.fork() blocked by runAsNode fuse | Use `utilityProcess.fork()` instead — Electron's recommended approach for Node child processes in production builds |
| Large binary size (~250MB) | Defer Playwright download to first use; cuts initial to ~100MB |
| Mac code signing / notarization | Required for distribution; Apple Developer account needed |
| Windows SmartScreen warnings | Code signing certificate needed for clean install |
| Auto-updates | electron-updater + GitHub Releases or S3 |
| ESM + Electron compatibility | Electron 28+ supports ESM main; preload stays CJS (Electron constraint) |

---

## What stays the same

- All framework code (canvas.css, deck-policy.js, deck-quality.js, etc.)
- All prompts and specs
- All templates
- The Claude Code hooks system (.claude/ folder)
- The workspace UI (project-console.html/css/js) — zero changes in Phase 1
- The terminal lifecycle contract (terminal-session.js owns PTY, Python fallback preserved)
- The quick-action buttons and menus
- The preview and slide navigation
- The quality check system
- Everything Claude does — it still runs in the terminal as Claude Code
