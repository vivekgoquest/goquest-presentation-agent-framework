import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';
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

test('electron operator CLI can drive a strict visible user journey through the project launcher', async (t) => {
  const sessionEnv = {
    PRESENTATION_OPERATOR_SESSION: `user-${process.pid}-${Date.now()}`,
  };
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-operator-user-cli-'));
  const screenshotPath = resolve(projectRoot, 'operator-user-cli.png');

  t.after(async () => {
    await shutdownOperator(sessionEnv);
    rmSync(projectRoot, { recursive: true, force: true });
  });

  await shutdownOperator(sessionEnv);

  const launch = await runOperatorCommand(['launch'], { env: sessionEnv });
  assert.equal(launch.ok, true);
  assert.equal(launch.result.launched, true);

  const openLauncher = await runOperatorCommand(['click', '#create-project'], { env: sessionEnv });
  assert.equal(openLauncher.ok, true);

  const waitLauncher = await runOperatorCommand(['wait-for-selector', '#project-launcher-modal[data-open="true"]', '15000'], { env: sessionEnv });
  assert.equal(waitLauncher.ok, true);

  const typePath = await runOperatorCommand(['type', '#project-launcher-path-input', projectRoot], { env: sessionEnv });
  assert.equal(typePath.ok, true);

  const typeSlides = await runOperatorCommand(['type', '#project-launcher-slides-input', '3'], { env: sessionEnv });
  assert.equal(typeSlides.ok, true);

  const submit = await runOperatorCommand(['click', '#project-launcher-submit'], { env: sessionEnv });
  assert.equal(submit.ok, true);

  const shellOpen = await runOperatorCommand(['wait-for-text', 'Shell open', '20000'], { env: sessionEnv });
  assert.equal(shellOpen.ok, true);

  const projectNameVisible = await runOperatorCommand(['wait-for-text', basename(projectRoot), '15000'], { env: sessionEnv });
  assert.equal(projectNameVisible.ok, true);

  const focusTerminal = await runOperatorCommand(['terminal-focus'], { env: sessionEnv });
  assert.equal(focusTerminal.ok, true);

  const typed = await runOperatorCommand(['terminal-type', 'echo __OPERATOR_USER_LANE_OK__'], { env: sessionEnv });
  assert.equal(typed.ok, true);

  const pressed = await runOperatorCommand(['terminal-press', 'Enter'], { env: sessionEnv });
  assert.equal(pressed.ok, true);

  const terminalOutput = await runOperatorCommand(['wait-for-terminal-text', '__OPERATOR_USER_LANE_OK__', '15000'], { env: sessionEnv });
  assert.equal(terminalOutput.ok, true);

  const clickFind = await runOperatorCommand(['click', '#terminal-find'], { env: sessionEnv });
  assert.equal(clickFind.ok, true);

  const waitSearch = await runOperatorCommand(['wait-for-selector', '#terminal-search[data-open="true"]', '15000'], { env: sessionEnv });
  assert.equal(waitSearch.ok, true);

  const screenshot = await runOperatorCommand(['screenshot', screenshotPath], { env: sessionEnv });
  assert.equal(screenshot.ok, true);
  assert.equal(existsSync(screenshot.result.path), true);
});
