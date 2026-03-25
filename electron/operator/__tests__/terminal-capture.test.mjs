import test from 'node:test';
import assert from 'node:assert/strict';

import {
  copyTerminalTextViaClipboard,
  getTerminalClipboardShortcutModifier,
} from '../terminal-capture.mjs';

test('getTerminalClipboardShortcutModifier uses Meta on macOS and Control elsewhere', () => {
  assert.equal(getTerminalClipboardShortcutModifier('darwin'), 'Meta');
  assert.equal(getTerminalClipboardShortcutModifier('MacIntel'), 'Meta');
  assert.equal(getTerminalClipboardShortcutModifier('linux'), 'Control');
  assert.equal(getTerminalClipboardShortcutModifier('Win32'), 'Control');
});

test('copyTerminalTextViaClipboard waits for clipboard text to change from a sentinel and restores the previous clipboard', async () => {
  const writes = [];
  const presses = [];
  let readCount = 0;
  let clipboard = 'previous clipboard';

  const result = await copyTerminalTextViaClipboard({
    platform: 'darwin',
    readClipboardText: async () => {
      readCount += 1;
      if (readCount <= 2) {
        return clipboard;
      }
      clipboard = 'copied terminal output';
      return clipboard;
    },
    writeClipboardText: async (value) => {
      writes.push(value);
      clipboard = value;
    },
    focusTerminal: async () => {
      presses.push('focus');
    },
    pressShortcut: async (value) => {
      presses.push(value);
    },
    wait: async () => {},
  });

  assert.equal(result, 'copied terminal output');
  assert.deepEqual(presses, ['focus', 'Meta+A', 'Meta+C']);
  assert.equal(writes[0].startsWith('__PF_TERMINAL_CAPTURE__'), true);
  assert.equal(writes.at(-1), 'previous clipboard');
});

test('copyTerminalTextViaClipboard restores the previous clipboard even when capture fails', async () => {
  const writes = [];
  let clipboard = 'restore me';

  await assert.rejects(() => copyTerminalTextViaClipboard({
    platform: 'linux',
    readClipboardText: async () => clipboard,
    writeClipboardText: async (value) => {
      writes.push(value);
      clipboard = value;
    },
    focusTerminal: async () => {},
    pressShortcut: async () => {},
    wait: async () => {},
    timeoutMs: 10,
  }), /Timed out waiting for terminal clipboard copy to complete/);

  assert.equal(writes[0].startsWith('__PF_TERMINAL_CAPTURE__'), true);
  assert.equal(writes.at(-1), 'restore me');
});
