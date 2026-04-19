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

test('shell-less public surface removes shell-era docs and desktop workflow references', () => {
  const agents = readFileSync(repoPath('AGENTS.md'), 'utf8');
  const readme = readFileSync(repoPath('README.md'), 'utf8');
  const startHere = readFileSync(repoPath('START-HERE.md'), 'utf8');

  assert.match(agents, /shell-less presentation package/i);
  assert.match(agents, /framework\/runtime\/presentation-cli\.mjs/i);
  assert.match(agents, /\.presentation\/framework-cli\.mjs/i);
  assert.doesNotMatch(agents, /Electron/i);
  assert.doesNotMatch(agents, /npm run start/i);
  assert.doesNotMatch(agents, /framework\/application/i);

  assert.doesNotMatch(readme, /electron-native/i);
  assert.doesNotMatch(readme, /npm run start/i);
  assert.doesNotMatch(readme, /desktop app/i);

  assert.doesNotMatch(startHere, /desktop app workflow/i);
  assert.doesNotMatch(startHere, /Click\s+\*\*New\*\*/i);
  assert.doesNotMatch(startHere, /Click\s+\*\*Open\*\*/i);
  assert.doesNotMatch(startHere, /Click New/i);
  assert.doesNotMatch(startHere, /Click Open/i);

  assert.equal(existsSync(repoPath('docs', 'electron-operator-agent-playbook.md')), false);
  assert.equal(existsSync(repoPath('docs', 'electron-operator-cli.md')), false);
  assert.equal(existsSync(repoPath('docs', 'electron-operator-guide.md')), false);
});

test('shell-less public surface setup guidance uses the current audit-first command wording', () => {
  const setup = readFileSync(repoPath('framework', 'runtime', 'setup.mjs'), 'utf8');

  assert.match(setup, /Setup complete\. You can now preview, audit, finalize, and export decks\./);
  assert.doesNotMatch(setup, /preview, check, finalize, and export decks/i);
});
