import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

test('shell-less public surface removes the application layer and framework-owned agent launcher modules', () => {
  assert.equal(existsSync(resolve(process.cwd(), 'framework', 'application')), false);
  assert.equal(existsSync(resolve(process.cwd(), 'project-agent', 'agent-launcher.mjs')), false);
  assert.equal(existsSync(resolve(process.cwd(), 'project-agent', 'agent-capabilities.mjs')), false);
});
