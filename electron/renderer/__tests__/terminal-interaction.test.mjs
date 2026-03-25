import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTerminalClipboardAction,
  getTerminalContextMenuItems,
  getTerminalShortcutHint,
  getTerminalSurfaceState,
  isTerminalShortcutModifierActive,
  runTerminalClipboardAction,
} from '../terminal-interaction.js';

test('isTerminalShortcutModifierActive uses cmd on macOS and ctrl elsewhere', () => {
  assert.equal(isTerminalShortcutModifierActive({ platform: 'darwin', metaKey: true, ctrlKey: false }), true);
  assert.equal(isTerminalShortcutModifierActive({ platform: 'MacIntel', metaKey: true, ctrlKey: false }), true);
  assert.equal(isTerminalShortcutModifierActive({ platform: 'darwin', metaKey: false, ctrlKey: true }), false);
  assert.equal(isTerminalShortcutModifierActive({ platform: 'linux', metaKey: false, ctrlKey: true }), true);
  assert.equal(isTerminalShortcutModifierActive({ platform: 'win32', metaKey: true, ctrlKey: false }), false);
});

test('getTerminalClipboardAction copies only when terminal selection exists', () => {
  assert.equal(getTerminalClipboardAction({
    platform: 'darwin',
    key: 'c',
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    terminalFocused: true,
    hasSelection: true,
  }), 'copy');

  assert.equal(getTerminalClipboardAction({
    platform: 'darwin',
    key: 'c',
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    terminalFocused: true,
    hasSelection: false,
  }), null);

  assert.equal(getTerminalClipboardAction({
    platform: 'linux',
    key: 'c',
    metaKey: false,
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    terminalFocused: true,
    hasSelection: true,
  }), 'copy');
});

test('getTerminalClipboardAction pastes and selects all only for a focused terminal', () => {
  assert.equal(getTerminalClipboardAction({
    platform: 'darwin',
    key: 'v',
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    terminalFocused: true,
    hasSelection: false,
  }), 'paste');

  assert.equal(getTerminalClipboardAction({
    platform: 'linux',
    key: 'a',
    metaKey: false,
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    terminalFocused: true,
    hasSelection: false,
  }), 'selectAll');

  assert.equal(getTerminalClipboardAction({
    platform: 'linux',
    key: 'v',
    metaKey: false,
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    terminalFocused: false,
    hasSelection: false,
  }), null);
});

test('getTerminalClipboardAction ignores unsupported modifier combinations', () => {
  assert.equal(getTerminalClipboardAction({
    platform: 'darwin',
    key: 'c',
    metaKey: true,
    ctrlKey: false,
    altKey: true,
    shiftKey: false,
    terminalFocused: true,
    hasSelection: true,
  }), null);

  assert.equal(getTerminalClipboardAction({
    platform: 'linux',
    key: 'x',
    metaKey: false,
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    terminalFocused: true,
    hasSelection: true,
  }), null);
});

test('runTerminalClipboardAction copies selection to the clipboard bridge', async () => {
  const calls = [];
  await runTerminalClipboardAction('copy', {
    terminal: {
      getSelection() {
        return 'selected output';
      },
    },
    clipboard: {
      async writeText(value) {
        calls.push(['writeText', value]);
      },
    },
    sendTerminalInput() {
      calls.push(['sendTerminalInput']);
    },
  });

  assert.deepEqual(calls, [['writeText', 'selected output']]);
});

test('runTerminalClipboardAction pastes clipboard text into the terminal and selects all locally', async () => {
  const calls = [];
  const terminal = {
    selectAll() {
      calls.push(['selectAll']);
    },
  };

  await runTerminalClipboardAction('paste', {
    terminal,
    clipboard: {
      async readText() {
        calls.push(['readText']);
        return 'clipboard payload';
      },
    },
    sendTerminalInput(value) {
      calls.push(['sendTerminalInput', value]);
    },
  });

  await runTerminalClipboardAction('selectAll', {
    terminal,
    clipboard: {
      async readText() {
        return '';
      },
    },
    sendTerminalInput() {
      calls.push(['sendTerminalInput']);
    },
  });

  assert.deepEqual(calls, [
    ['readText'],
    ['sendTerminalInput', 'clipboard payload'],
    ['selectAll'],
  ]);
});

test('getTerminalContextMenuItems exposes copy paste and select-all with selection-aware enablement', () => {
  const withSelection = getTerminalContextMenuItems({
    terminalFocused: true,
    hasSelection: true,
  });
  assert.deepEqual(withSelection, [
    { id: 'copy', label: 'Copy', enabled: true },
    { id: 'paste', label: 'Paste', enabled: true },
    { id: 'selectAll', label: 'Select All', enabled: true },
  ]);

  const withoutSelection = getTerminalContextMenuItems({
    terminalFocused: true,
    hasSelection: false,
  });
  assert.deepEqual(withoutSelection, [
    { id: 'copy', label: 'Copy', enabled: false },
    { id: 'paste', label: 'Paste', enabled: true },
    { id: 'selectAll', label: 'Select All', enabled: true },
  ]);

  const unfocused = getTerminalContextMenuItems({
    terminalFocused: false,
    hasSelection: true,
  });
  assert.deepEqual(unfocused, []);
});

test('getTerminalShortcutHint reflects platform-specific modifiers', () => {
  assert.match(getTerminalShortcutHint({ platform: 'darwin' }), /⌘C copy selection/i);
  assert.match(getTerminalShortcutHint({ platform: 'darwin' }), /⌘V paste/i);
  assert.match(getTerminalShortcutHint({ platform: 'linux' }), /Ctrl\+C copy selection/i);
  assert.match(getTerminalShortcutHint({ platform: 'linux' }), /Ctrl\+A select all/i);
});

test('getTerminalSurfaceState exposes focused and selection attributes for subtle styling', () => {
  assert.deepEqual(getTerminalSurfaceState({ terminalFocused: true, hasSelection: true }), {
    focused: 'true',
    selection: 'true',
  });
  assert.deepEqual(getTerminalSurfaceState({ terminalFocused: true, hasSelection: false }), {
    focused: 'true',
    selection: 'false',
  });
  assert.deepEqual(getTerminalSurfaceState({ terminalFocused: false, hasSelection: true }), {
    focused: 'false',
    selection: 'true',
  });
});
