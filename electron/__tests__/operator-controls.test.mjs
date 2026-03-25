import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
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

test('electron operator exposes broad real-user controls across main UI and preview surfaces', async (t) => {
  const sessionEnv = {
    PRESENTATION_OPERATOR_SESSION: `controls-${process.pid}-${Date.now()}`,
  };
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-operator-controls-'));
  const elementShotPath = resolve(projectRoot, 'preview-pane.png');
  const regionShotPath = resolve(projectRoot, 'preview-region.png');

  t.after(async () => {
    await shutdownOperator(sessionEnv);
    rmSync(projectRoot, { recursive: true, force: true });
  });

  await shutdownOperator(sessionEnv);

  await runOperatorCommand(['launch'], { env: sessionEnv });
  await runOperatorCommand(['click', '#create-project'], { env: sessionEnv });
  await runOperatorCommand(['wait-for-selector', '#project-launcher-modal[data-open="true"]', '15000'], { env: sessionEnv });

  const submitInitiallyDisabled = await runOperatorCommand(['is-enabled', '#project-launcher-submit'], { env: sessionEnv });
  assert.equal(submitInitiallyDisabled.result.enabled, false);

  await runOperatorCommand(['type', '#project-launcher-path-input', projectRoot], { env: sessionEnv });

  const focusedPathInput = await runOperatorCommand(['focused-element'], { env: sessionEnv });
  assert.equal(focusedPathInput.result.id, 'project-launcher-path-input');

  const submitEnabled = await runOperatorCommand(['is-enabled', '#project-launcher-submit'], { env: sessionEnv });
  assert.equal(submitEnabled.result.enabled, true);

  await runOperatorCommand(['click', '#project-launcher-submit'], { env: sessionEnv });
  await runOperatorCommand(['wait-for-text', 'Shell open', '20000'], { env: sessionEnv });
  await runOperatorCommand(['wait-for-selector', '#preview-frame', '15000'], { env: sessionEnv });

  const previewVisible = await runOperatorCommand(['is-visible', '#preview-pane'], { env: sessionEnv });
  assert.equal(previewVisible.result.visible, true);

  const hoverResult = await runOperatorCommand(['hover', '#terminal-find'], { env: sessionEnv });
  assert.equal(hoverResult.result.hovered, '#terminal-find');

  const moveResult = await runOperatorCommand(['mouse-move', '#terminal-find'], { env: sessionEnv });
  assert.equal(moveResult.result.moved, '#terminal-find');

  await runOperatorCommand(['click', '#terminal-find'], { env: sessionEnv });
  await runOperatorCommand(['wait-for-selector', '#terminal-search[data-open="true"]', '15000'], { env: sessionEnv });

  const doubleClickResult = await runOperatorCommand(['double-click', '#terminal-search-input'], { env: sessionEnv });
  assert.equal(doubleClickResult.result.doubleClicked, '#terminal-search-input');

  const rightClickResult = await runOperatorCommand(['right-click', '#terminal-container'], { env: sessionEnv });
  assert.equal(rightClickResult.result.rightClicked, '#terminal-container');

  await runOperatorCommand(['terminal-focus'], { env: sessionEnv });
  await runOperatorCommand(['terminal-type', "printf '__CTRL__\\n%.0s' {1..80}"], { env: sessionEnv });
  await runOperatorCommand(['terminal-press', 'Enter'], { env: sessionEnv });
  await runOperatorCommand(['wait-for-terminal-text', '__CTRL__', '15000'], { env: sessionEnv });

  const scrollResult = await runOperatorCommand(['scroll', '#terminal-container', '0', '500'], { env: sessionEnv });
  assert.equal(scrollResult.result.scrolled, '#terminal-container');

  const terminalBoundsBefore = await runOperatorCommand(['bounds', '#terminal-pane'], { env: sessionEnv });
  const handleBounds = await runOperatorCommand(['bounds', '#pane-split-handle'], { env: sessionEnv });
  const startX = Math.round(handleBounds.result.x + (handleBounds.result.width / 2));
  const startY = Math.round(handleBounds.result.y + (handleBounds.result.height / 2));
  const endX = startX - 140;

  await runOperatorCommand(['mouse-move-coords', String(startX), String(startY)], { env: sessionEnv });
  await runOperatorCommand(['mouse-down', 'left'], { env: sessionEnv });
  await runOperatorCommand(['mouse-move-coords', String(endX), String(startY)], { env: sessionEnv });
  await runOperatorCommand(['mouse-up', 'left'], { env: sessionEnv });

  const terminalBoundsAfterManualDrag = await runOperatorCommand(['bounds', '#terminal-pane'], { env: sessionEnv });
  assert.notEqual(Math.round(terminalBoundsBefore.result.width), Math.round(terminalBoundsAfterManualDrag.result.width));

  const dragHandleBounds = await runOperatorCommand(['bounds', '#pane-split-handle'], { env: sessionEnv });
  const dragStartX = Math.round(dragHandleBounds.result.x + (dragHandleBounds.result.width / 2));
  const dragStartY = Math.round(dragHandleBounds.result.y + (dragHandleBounds.result.height / 2));
  const dragEndX = dragStartX + 120;

  const dragResult = await runOperatorCommand(['drag-coords', String(dragStartX), String(dragStartY), String(dragEndX), String(dragStartY)], { env: sessionEnv });
  assert.equal(dragResult.result.dragged, true);

  const previewWait = await runOperatorCommand(['preview-wait-for-selector', 'body', '15000'], { env: sessionEnv });
  assert.equal(previewWait.result.matched, 'body');

  const previewText = await runOperatorCommand(['preview-visible-text', 'body'], { env: sessionEnv });
  assert.match(previewText.result.text || '', /draft preview|preview/i);

  const previewClick = await runOperatorCommand(['preview-click', 'body'], { env: sessionEnv });
  assert.equal(previewClick.result.clicked, 'body');

  const elementShot = await runOperatorCommand(['screenshot-element', '#preview-pane', elementShotPath], { env: sessionEnv });
  assert.equal(existsSync(elementShot.result.path), true);

  const previewPaneBounds = await runOperatorCommand(['bounds', '#preview-pane'], { env: sessionEnv });
  const regionShot = await runOperatorCommand([
    'screenshot-region',
    String(Math.round(previewPaneBounds.result.x)),
    String(Math.round(previewPaneBounds.result.y)),
    String(Math.max(80, Math.round(previewPaneBounds.result.width / 2))),
    String(Math.max(80, Math.round(previewPaneBounds.result.height / 2))),
    regionShotPath,
  ], { env: sessionEnv });
  assert.equal(existsSync(regionShot.result.path), true);
});
