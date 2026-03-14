import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { REPO_ROOT } from './deck-paths.js';

function run(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

const nodeModules = resolve(REPO_ROOT, 'node_modules');
if (!existsSync(nodeModules)) {
  run('Installing npm dependencies', 'npm', ['install']);
} else {
  console.log('npm dependencies already installed. Skipping npm install.');
}

let browserInstalled = false;
try {
  const { chromium } = await import('playwright');
  browserInstalled = existsSync(chromium.executablePath());
} catch {
  browserInstalled = false;
}

if (!browserInstalled) {
  run('Installing Playwright Chromium', 'npx', ['playwright', 'install', 'chromium']);
} else {
  console.log('Playwright Chromium already installed. Skipping browser install.');
}

console.log('\nSetup complete. You can now preview, check, finalize, and export decks.');
