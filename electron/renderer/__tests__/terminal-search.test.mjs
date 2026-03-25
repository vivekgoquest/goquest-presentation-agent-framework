import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getTerminalSearchAction,
  getTerminalSearchUiModel,
  isTerminalSearchShortcut,
} from '../terminal-search.js';

test('isTerminalSearchShortcut uses cmd on macOS and ctrl elsewhere when the terminal is focused', () => {
  assert.equal(isTerminalSearchShortcut({
    platform: 'darwin',
    key: 'f',
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    terminalFocused: true,
  }), true);

  assert.equal(isTerminalSearchShortcut({
    platform: 'MacIntel',
    key: 'f',
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    terminalFocused: true,
  }), true);

  assert.equal(isTerminalSearchShortcut({
    platform: 'linux',
    key: 'f',
    metaKey: false,
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    terminalFocused: true,
  }), true);

  assert.equal(isTerminalSearchShortcut({
    platform: 'linux',
    key: 'f',
    metaKey: false,
    ctrlKey: true,
    altKey: false,
    shiftKey: false,
    terminalFocused: false,
  }), false);
});

test('getTerminalSearchAction maps enter escape and shift-enter inside the search UI', () => {
  assert.equal(getTerminalSearchAction({ searchOpen: true, key: 'Enter', shiftKey: false }), 'next');
  assert.equal(getTerminalSearchAction({ searchOpen: true, key: 'Enter', shiftKey: true }), 'previous');
  assert.equal(getTerminalSearchAction({ searchOpen: true, key: 'Escape', shiftKey: false }), 'close');
  assert.equal(getTerminalSearchAction({ searchOpen: false, key: 'Enter', shiftKey: false }), null);
});

test('getTerminalSearchUiModel keeps the find UI minimal and query-aware', () => {
  assert.deepEqual(getTerminalSearchUiModel({ open: false, query: '' }), {
    open: false,
    query: '',
    canNavigate: false,
    placeholder: 'Find in terminal',
  });

  assert.deepEqual(getTerminalSearchUiModel({ open: true, query: 'error' }), {
    open: true,
    query: 'error',
    canNavigate: true,
    placeholder: 'Find in terminal',
  });

  assert.deepEqual(getTerminalSearchUiModel({ open: true, query: '   ' }), {
    open: true,
    query: '   ',
    canNavigate: false,
    placeholder: 'Find in terminal',
  });
});
