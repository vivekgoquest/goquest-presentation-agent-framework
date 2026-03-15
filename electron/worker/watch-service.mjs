import { readdirSync, watch } from 'fs';
import { relative, resolve } from 'path';

function shouldIgnoreWatchPath(filename) {
  return (
    filename.includes('node_modules') ||
    filename.includes('/outputs/') ||
    filename.startsWith('outputs/') ||
    filename.startsWith('.git') ||
    filename.endsWith('.pdf') ||
    filename.endsWith('.DS_Store')
  );
}

function isInsideRoot(targetAbs, rootAbs) {
  const normalizedTarget = resolve(targetAbs);
  const normalizedRoot = resolve(rootAbs);
  return normalizedTarget === normalizedRoot
    || normalizedTarget.startsWith(`${normalizedRoot}/`)
    || normalizedTarget.startsWith(`${normalizedRoot}\\`);
}

export function createWatchService(options = {}) {
  const frameworkRoot = options.frameworkRoot || process.cwd();
  const listeners = new Set();
  let debounceTimer = null;
  let activeWatchers = [];

  function emitChange(file) {
    if (!file || shouldIgnoreWatchPath(file)) {
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const event = {
        channel: 'watch/change',
        file,
        time: new Date().toISOString(),
      };

      for (const listener of listeners) {
        listener(event);
      }
    }, 150);
  }

  function createDirectoryTreeWatcher(rootDir, displayPrefix = '') {
    const watchers = new Map();

    function toWatchLabel(dirAbs, filename = '') {
      const absPath = filename ? resolve(dirAbs, filename) : dirAbs;
      const relPath = relative(rootDir, absPath).replace(/\\/g, '/');
      return displayPrefix ? `${displayPrefix}${relPath}` : relPath;
    }

    function scanDirectory(dirAbs) {
      if (!watchers.has(dirAbs)) {
        const watcher = watch(dirAbs, (eventType, filename) => {
          const relativePath = filename ? toWatchLabel(dirAbs, String(filename)) : toWatchLabel(dirAbs);
          emitChange(relativePath);

          if (eventType === 'rename') {
            refresh();
          }
        });

        watchers.set(dirAbs, watcher);
      }

      for (const entry of readdirSync(dirAbs, { withFileTypes: true })) {
        if (!entry.isDirectory()) {
          continue;
        }

        const childAbs = resolve(dirAbs, entry.name);
        const childRel = toWatchLabel(childAbs);
        if (shouldIgnoreWatchPath(childRel)) {
          continue;
        }

        scanDirectory(childAbs);
      }
    }

    function refresh() {
      scanDirectory(rootDir);

      for (const [dirAbs, watcher] of watchers) {
        try {
          readdirSync(dirAbs);
        } catch {
          watcher.close();
          watchers.delete(dirAbs);
        }
      }
    }

    refresh();

    return () => {
      for (const watcher of watchers.values()) {
        watcher.close();
      }
      watchers.clear();
    };
  }

  function createWatchHandle(rootDir, displayPrefix = '') {
    try {
      const watcher = watch(rootDir, { recursive: true }, (_eventType, filename) => {
        if (!filename) {
          return;
        }

        const relativePath = String(filename).replace(/\\/g, '/');
        emitChange(displayPrefix ? `${displayPrefix}${relativePath}` : relativePath);
      });

      return () => watcher.close();
    } catch (err) {
      if (err?.code !== 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM') {
        throw err;
      }

      return createDirectoryTreeWatcher(rootDir, displayPrefix);
    }
  }

  function replaceWatchRoots(projectRoot = null) {
    for (const stop of activeWatchers) {
      stop();
    }
    activeWatchers = [];

    const nextRoots = [
      { root: frameworkRoot, prefix: 'framework-host/' },
    ];

    if (projectRoot && !isInsideRoot(projectRoot, frameworkRoot)) {
      nextRoots.push({ root: projectRoot, prefix: '' });
    }

    for (const watchRoot of nextRoots) {
      activeWatchers.push(createWatchHandle(watchRoot.root, watchRoot.prefix));
    }
  }

  replaceWatchRoots();

  return {
    dispose() {
      clearTimeout(debounceTimer);
      for (const stop of activeWatchers) {
        stop();
      }
      activeWatchers = [];
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setProjectRoot(projectRoot) {
      replaceWatchRoots(projectRoot || null);
    },
  };
}
