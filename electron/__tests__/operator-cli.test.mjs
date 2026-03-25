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

test('electron operator CLI can drive the app through a hybrid semantic terminal flow', async (t) => {
  const sessionEnv = {
    PRESENTATION_OPERATOR_SESSION: `hybrid-${process.pid}-${Date.now()}`,
  };
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-operator-cli-'));
  const screenshotPath = resolve(projectRoot, 'operator-cli.png');

  t.after(async () => {
    await shutdownOperator(sessionEnv);
    rmSync(projectRoot, { recursive: true, force: true });
  });

  await shutdownOperator(sessionEnv);

  const launch = await runOperatorCommand(['launch'], { env: sessionEnv });
  assert.equal(launch.ok, true);
  assert.equal(launch.result.launched, true);

  const create = await runOperatorCommand(['create-project', projectRoot, '3'], { env: sessionEnv });
  assert.equal(create.ok, true);
  assert.equal(create.result.result.status, 'created');
  assert.equal(create.result.state.projectMeta.projectRoot, projectRoot);

  const shellOpen = await runOperatorCommand(['wait-for-text', 'Shell open', '15000'], { env: sessionEnv });
  assert.equal(shellOpen.ok, true);

  const focus = await runOperatorCommand(['terminal-focus'], { env: sessionEnv });
  assert.equal(focus.ok, true);

  const typed = await runOperatorCommand(['terminal-type', 'echo __OPERATOR_TYPED_OK__'], { env: sessionEnv });
  assert.equal(typed.ok, true);
  const pressed = await runOperatorCommand(['terminal-press', 'Enter'], { env: sessionEnv });
  assert.equal(pressed.ok, true);

  const typedWait = await runOperatorCommand(['wait-for-terminal-text', '__OPERATOR_TYPED_OK__', '15000'], { env: sessionEnv });
  assert.equal(typedWait.ok, true);

  const sent = await runOperatorCommand(['terminal-send', 'pwd\n'], { env: sessionEnv });
  assert.equal(sent.ok, true);
  const pwdWait = await runOperatorCommand(['wait-for-terminal-text', projectRoot, '15000'], { env: sessionEnv });
  assert.equal(pwdWait.ok, true);

  const clickFind = await runOperatorCommand(['click', '#terminal-find'], { env: sessionEnv });
  assert.equal(clickFind.ok, true);
  const waitSearch = await runOperatorCommand(['wait-for-selector', '#terminal-search[data-open="true"]', '15000'], { env: sessionEnv });
  assert.equal(waitSearch.ok, true);

  const state = await runOperatorCommand(['state'], { env: sessionEnv });
  assert.equal(state.ok, true);
  assert.match(state.result.terminal.subtitle || '', new RegExp(basename(projectRoot), 'i'));
  assert.equal(state.result.terminal.searchOpen, true);

  const screenshot = await runOperatorCommand(['screenshot', screenshotPath], { env: sessionEnv });
  assert.equal(screenshot.ok, true);
  assert.equal(existsSync(screenshot.result.path), true);
});
