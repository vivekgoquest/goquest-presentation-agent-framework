import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = process.cwd();

function repoPath(...parts) {
  return resolve(REPO_ROOT, ...parts);
}

test('shell-less public surface removes the application layer, Electron shell, and shell-only runtime modules', () => {
  assert.equal(existsSync(repoPath('framework', 'application')), false);
  assert.equal(existsSync(repoPath('project-agent', 'agent-launcher.mjs')), false);
  assert.equal(existsSync(repoPath('project-agent', 'agent-capabilities.mjs')), false);
  assert.equal(existsSync(repoPath('electron')), false);
  assert.equal(existsSync(repoPath('framework', 'runtime', 'terminal-core.mjs')), false);
  assert.equal(existsSync(repoPath('framework', 'runtime', 'terminal-events.mjs')), false);
  assert.equal(existsSync(repoPath('framework', 'runtime', 'pty-bridge.py')), false);
  assert.equal(existsSync(repoPath('framework', 'runtime', 'check-deck.mjs')), false);
  assert.equal(existsSync(repoPath('framework', 'runtime', 'deck-capture.mjs')), false);
  assert.equal(existsSync(repoPath('framework', 'runtime', 'export-pdf.mjs')), false);
  assert.equal(existsSync(repoPath('framework', 'runtime', 'finalize-deck.mjs')), false);
});

test('shell-less public surface drops shell-era scripts and package dependencies', () => {
  const packageJson = JSON.parse(readFileSync(repoPath('package.json'), 'utf8'));
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};

  assert.deepEqual(Object.keys(packageJson.scripts || {}).sort(), ['setup', 'test']);
  assert.equal(packageJson.scripts?.new, undefined);
  assert.equal(packageJson.scripts?.check, undefined);
  assert.equal(packageJson.scripts?.capture, undefined);
  assert.equal(packageJson.scripts?.export, undefined);
  assert.equal(packageJson.scripts?.finalize, undefined);
  assert.equal(packageJson.scripts?.start, undefined);
  assert.equal(packageJson.scripts?.operator, undefined);
  assert.equal(devDependencies.electron, undefined);
  assert.equal(dependencies['node-pty'], undefined);
  assert.equal(dependencies.ws, undefined);
  assert.equal(dependencies.xterm, undefined);
  assert.equal(dependencies['@xterm/addon-fit'], undefined);
  assert.equal(dependencies['@xterm/addon-search'], undefined);
  assert.equal(dependencies['@xterm/addon-web-links'], undefined);
});
