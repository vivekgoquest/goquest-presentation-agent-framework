import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
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

test('electron operator can drive the real macOS native choose-folder dialog when Accessibility UI scripting is available', async (t) => {
  const sessionEnv = {
    PRESENTATION_OPERATOR_SESSION: `native-dialog-${process.pid}-${Date.now()}`,
  };
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-operator-native-dialog-'));
  const canonicalProjectRoot = realpathSync(projectRoot);

  t.after(async () => {
    await shutdownOperator(sessionEnv);
    rmSync(projectRoot, { recursive: true, force: true });
  });

  await shutdownOperator(sessionEnv);
  await runOperatorCommand(['launch'], { env: sessionEnv });

  const availability = await runOperatorCommand(['os-file-dialog-available'], { env: sessionEnv });
  if (!availability.result.supported || !availability.result.accessibilityEnabled) {
    t.skip(`native macOS file-dialog automation unavailable: ${JSON.stringify(availability.result)}`);
    return;
  }

  await runOperatorCommand(['click', '#create-project'], { env: sessionEnv });
  await runOperatorCommand(['wait-for-selector', '#project-launcher-modal[data-open="true"]', '15000'], { env: sessionEnv });
  await runOperatorCommand(['dialog-clear'], { env: sessionEnv });

  await runOperatorCommand(['click', '#project-launcher-browse'], { env: sessionEnv });

  const dialogState = await runOperatorCommand(['os-file-dialog-wait-open', 'Electron', '15000'], { env: sessionEnv });
  assert.equal(dialogState.result.open, true);

  const choose = await runOperatorCommand(['os-file-dialog-choose-folder', projectRoot, 'Electron'], {
    env: sessionEnv,
    timeout: 60000,
  });
  assert.equal(choose.ok, true);
  assert.match(String(choose.result.confirmed || ''), /choose|open|enter/i);

  const closedState = await runOperatorCommand(['os-file-dialog-wait-closed', 'Electron', '15000'], { env: sessionEnv });
  assert.equal(closedState.result.open, false);

  const waitValue = await runOperatorCommand(['wait-for-value', '#project-launcher-path-input', canonicalProjectRoot, '20000'], { env: sessionEnv });
  assert.equal(waitValue.ok, true);

  const value = await runOperatorCommand(['value', '#project-launcher-path-input'], { env: sessionEnv });
  assert.equal(value.result.value, canonicalProjectRoot);
});
