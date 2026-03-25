import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeTerminalExternalUrl,
  normalizeTerminalProjectPathLink,
  openTerminalExternalLink,
} from '../terminal-links.js';

test('normalizeTerminalExternalUrl keeps supported external protocols only', () => {
  assert.equal(normalizeTerminalExternalUrl('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(normalizeTerminalExternalUrl('http://localhost:3000/path?q=1'), 'http://localhost:3000/path?q=1');
  assert.equal(normalizeTerminalExternalUrl('mailto:hello@example.com'), 'mailto:hello@example.com');
  assert.equal(normalizeTerminalExternalUrl(' file:///tmp/nope '), '');
  assert.equal(normalizeTerminalExternalUrl('javascript:alert(1)'), '');
  assert.equal(normalizeTerminalExternalUrl('/relative/path'), '');
});

test('openTerminalExternalLink delegates only normalized URLs to the external opener', async () => {
  const calls = [];
  await openTerminalExternalLink('https://example.com/docs', {
    openExternal(url) {
      calls.push(url);
    },
  });

  await openTerminalExternalLink('javascript:alert(1)', {
    openExternal(url) {
      calls.push(url);
    },
  });

  assert.deepEqual(calls, ['https://example.com/docs']);
});

test('normalizeTerminalProjectPathLink keeps project-local paths and strips line suffixes', () => {
  const projectRoot = '/tmp/demo-project';

  assert.deepEqual(
    normalizeTerminalProjectPathLink('brief.md:12', { projectRoot }),
    { text: 'brief.md:12', targetPath: 'brief.md' }
  );
  assert.deepEqual(
    normalizeTerminalProjectPathLink('./slides/intro/notes.md:12:4', { projectRoot }),
    { text: './slides/intro/notes.md:12:4', targetPath: 'slides/intro/notes.md' }
  );
  assert.deepEqual(
    normalizeTerminalProjectPathLink('/tmp/demo-project/slides/intro/notes.md', { projectRoot }),
    { text: '/tmp/demo-project/slides/intro/notes.md', targetPath: 'slides/intro/notes.md' }
  );

  assert.equal(normalizeTerminalProjectPathLink('/tmp/other-project/brief.md', { projectRoot }), null);
  assert.equal(normalizeTerminalProjectPathLink('https://example.com/docs', { projectRoot }), null);
  assert.equal(normalizeTerminalProjectPathLink('', { projectRoot }), null);
});
