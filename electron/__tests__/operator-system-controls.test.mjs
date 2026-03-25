import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const CLI_PATH = resolve(process.cwd(), 'electron/operator/cli.mjs');

async function runOperatorCommand(args, options = {}) {
  const { stdout } = await execFile(process.execPath, [CLI_PATH, ...args], {
    cwd: process.cwd(),
    timeout: options.timeout || 60000,
    maxBuffer: 2 * 1024 * 1024,
    env: {
      ...process.env,
      ...(options.env || {}),
    },
  });
  return JSON.parse(stdout);
}

async function shutdownOperator(env = {}) {
  try {
    await runOperatorCommand(['shutdown'], { timeout: 15000, env });
  } catch {
    // ignore cleanup failures if server is not running yet
  }
}

test('electron operator can drive native menus, dialog overrides, and multi-window controls', async (t) => {
  const sessionEnv = {
    PRESENTATION_OPERATOR_SESSION: `system-${process.pid}-${Date.now()}`,
  };
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-operator-system-'));

  t.after(async () => {
    await shutdownOperator(sessionEnv);
    rmSync(projectRoot, { recursive: true, force: true });
  });

  await shutdownOperator(sessionEnv);
  await runOperatorCommand(['launch'], { env: sessionEnv });

  const menuList = await runOperatorCommand(['menu-list'], { env: sessionEnv });
  const menuTree = JSON.stringify(menuList.result);
  assert.match(menuTree, /file\.newProject/);
  assert.match(menuTree, /file\.openProject/);
  assert.match(menuTree, /window\.newWindow/);

  await runOperatorCommand(['menu-click', 'file.newProject'], { env: sessionEnv });
  await runOperatorCommand(['wait-for-selector', '#project-launcher-modal[data-open="true"]', '15000'], { env: sessionEnv });

  await runOperatorCommand(['dialog-clear'], { env: sessionEnv });
  await runOperatorCommand(['dialog-set-open-directory', projectRoot], { env: sessionEnv });
  await runOperatorCommand(['click', '#project-launcher-browse'], { env: sessionEnv });
  await runOperatorCommand(['wait-for-value', '#project-launcher-path-input', projectRoot, '15000'], { env: sessionEnv });

  const inputValue = await runOperatorCommand(['value', '#project-launcher-path-input'], { env: sessionEnv });
  assert.equal(inputValue.result.value, projectRoot);

  const dialogState = await runOperatorCommand(['dialog-state'], { env: sessionEnv });
  assert.equal(dialogState.result.openDirectory.length, 0);
  assert.equal(dialogState.result.history.at(-1).kind, 'openDirectory');
  assert.equal(dialogState.result.history.at(-1).source, 'override');

  const createdWindow = await runOperatorCommand(['create-window'], { env: sessionEnv });
  assert.equal(Boolean(createdWindow.result.id), true);

  const waitTwoWindows = await runOperatorCommand(['wait-for-window-count', '2', '15000'], { env: sessionEnv });
  assert.equal(waitTwoWindows.result.count, 2);

  const windows = await runOperatorCommand(['windows-list'], { env: sessionEnv });
  assert.equal(windows.result.length, 2);
  const secondWindow = windows.result.find((window) => window.id === createdWindow.result.id);
  assert.ok(secondWindow);

  const focusSecond = await runOperatorCommand(['focus-window', String(secondWindow.id)], { env: sessionEnv });
  assert.equal(focusSecond.result.id, secondWindow.id);

  const resized = await runOperatorCommand(['resize-window', '1280', '820', String(secondWindow.id)], { env: sessionEnv });
  assert.equal(resized.result.resized, true);
  assert.equal(resized.result.id, secondWindow.id);

  const closed = await runOperatorCommand(['close-window', String(secondWindow.id)], { env: sessionEnv });
  assert.equal(closed.result.closed, true);

  const waitOneWindow = await runOperatorCommand(['wait-for-window-count', '1', '15000'], { env: sessionEnv });
  assert.equal(waitOneWindow.result.count, 1);

  const osAvailable = await runOperatorCommand(['os-available'], { env: sessionEnv });
  assert.equal(typeof osAvailable.result.supported, 'boolean');
  assert.equal(osAvailable.result.platform, process.platform);
});
