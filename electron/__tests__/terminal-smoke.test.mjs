import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { basename, resolve } from 'path';

test('electron clipboard bridge round-trips plain text for terminal helpers', async (t) => {
  const { _electron: electron } = await import('playwright');
  const app = await electron.launch({
    args: [resolve(process.cwd(), 'electron/main.mjs')],
    cwd: process.cwd(),
  });

  t.after(async () => {
    await app.close();
  });

  const page = await app.firstWindow();
  await page.waitForSelector('#app-shell');

  const clipboardRoundTrip = await page.evaluate(async () => {
    await window.electron.system.writeClipboardText('terminal clipboard bridge');
    return {
      text: await window.electron.system.readClipboardText(),
      openExternal: typeof window.electron.system.openExternal,
      showContextMenu: typeof window.electron.terminal.showContextMenu,
      onContextMenuAction: typeof window.electron.terminal.onContextMenuAction,
    };
  });

  assert.equal(clipboardRoundTrip.text, 'terminal clipboard bridge');
  assert.equal(clipboardRoundTrip.openExternal, 'function');
  assert.equal(clipboardRoundTrip.showContextMenu, 'function');
  assert.equal(clipboardRoundTrip.onContextMenuAction, 'function');
});

test('electron terminal shows shell identity after project auto-start', async (t) => {
  const { _electron: electron } = await import('playwright');
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-electron-terminal-'));

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

  await page.evaluate((path) => {
    document.getElementById('project-path').value = path;
  }, projectRoot);

  await page.evaluate(() => {
    return window.electron.project.create({
      projectRoot: document.getElementById('project-path').value,
      slideCount: 3,
    });
  });

  await page.waitForFunction((expectedProjectRoot) => {
    try {
      const meta = JSON.parse(document.querySelector('#terminal-meta')?.textContent || '{}');
      return meta.alive === true && meta.projectRoot === expectedProjectRoot && meta.cwd === expectedProjectRoot;
    } catch {
      return false;
    }
  }, projectRoot);

  const expectedShellName = process.platform === 'win32'
    ? basename(process.env.COMSPEC || 'powershell.exe')
    : basename(process.env.SHELL || '/bin/bash');
  const expectedShellPattern = expectedShellName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  await page.waitForFunction((shellPattern) => {
    const label = document.getElementById('terminal-state-label')?.textContent || '';
    return /shell open/i.test(label) && new RegExp(shellPattern, 'i').test(label);
  }, expectedShellPattern);

  const terminalStateLabel = await page.locator('#terminal-state-label').textContent();
  assert.match(terminalStateLabel || '', /shell open/i);
  assert.match(terminalStateLabel || '', /pf-electron-terminal/i);
  assert.match(terminalStateLabel || '', new RegExp(expectedShellPattern, 'i'));

  const terminalHint = await page.locator('#terminal-container').getAttribute('title');
  const expectedModifier = process.platform === 'darwin' ? '⌘' : 'Ctrl+';
  assert.match(terminalHint || '', new RegExp(`${expectedModifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}C copy selection`, 'i'));
  assert.match(terminalHint || '', /paste/i);
  assert.match(terminalHint || '', /select all/i);

  const terminalFindButtonText = await page.locator('#terminal-find').textContent();
  assert.match(terminalFindButtonText || '', /find/i);
  await page.locator('#terminal-find').click();
  await page.waitForFunction(() => document.getElementById('terminal-search')?.dataset.open === 'true');
  const searchPlaceholder = await page.locator('#terminal-search-input').getAttribute('placeholder');
  assert.match(searchPlaceholder || '', /find in terminal/i);
});
