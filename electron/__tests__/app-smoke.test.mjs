import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';

test('electron shell boots and can create a project through the preload bridge', async (t) => {
  const { _electron: electron } = await import('playwright');
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-electron-app-'));

  t.after(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  const app = await electron.launch({
    args: [resolve(process.cwd(), 'electron/main.mjs')],
    cwd: process.cwd(),
  });

  t.after(async () => {
    await app.close();
  });

  const page = await app.firstWindow();
  await page.waitForSelector('#app-shell');

  // Verify the app shell loaded and shows the welcome state
  const welcomeText = await page.locator('#welcome-panel h2').textContent();
  assert.match(welcomeText || '', /Presentation Desktop/i);

  // Set path via hidden input and trigger create through JS
  // (the real UI uses a folder picker, but tests set it programmatically)
  await page.evaluate((path) => {
    document.getElementById('project-path').value = path;
  }, projectRoot);
  await page.evaluate(() => {
    // Directly call the IPC to create, bypassing the folder picker
    return window.electron.project.create({
      projectRoot: document.getElementById('project-path').value,
      slides: 3,
    });
  });

  // Wait for project to become active
  await page.waitForFunction(() => {
    const metaEl = document.querySelector('#meta-json');
    return metaEl?.textContent?.includes('"active": true');
  });

  // Verify terminal meta is available in diagnostics
  const terminalStatus = await page.locator('#terminal-meta').textContent();
  assert.match(terminalStatus || '', /"state"/);
});
