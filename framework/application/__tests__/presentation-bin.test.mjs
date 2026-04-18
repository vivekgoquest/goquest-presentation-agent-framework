import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const PACKAGE_JSON_PATH = resolve(import.meta.dirname, '../../..', 'package.json');
const PRESENTATION_BIN_PATH = resolve(import.meta.dirname, '..', 'presentation-bin.mjs');

function createTempRoot(prefix = 'pf-presentation-bin-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

test('package.json advertises the public presentation bin entrypoint', () => {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  assert.equal(packageJson.bin.presentation, './framework/application/presentation-bin.mjs');
});

test('public presentation bin starts with a portable node shebang', () => {
  const source = readFileSync(PRESENTATION_BIN_PATH, 'utf8');
  assert.match(source, /^#!\/usr\/bin\/env node\r?\n/);
});

test('public presentation bin supports init from an external cwd', (t) => {
  const outsideCwd = createTempRoot('pf-public-init-cwd-');
  const projectRoot = resolve(outsideCwd, 'generated-project');
  t.after(() => rmSync(outsideCwd, { recursive: true, force: true }));

  const result = spawnSync(
    process.execPath,
    [PRESENTATION_BIN_PATH, 'init', '--project', projectRoot, '--slides', '3'],
    {
      cwd: outsideCwd,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'created');
  assert.equal(json.slideCount, 3);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), true);
  assert.equal(existsSync(resolve(projectRoot, '.claude', 'AGENTS.md')), true);
  assert.equal(existsSync(resolve(projectRoot, 'AGENTS.md')), false);
  assert.ok(json.files.includes('.presentation/framework-cli.mjs'));
});

test('public presentation bin supports direct shebang execution from an external cwd', {
  skip: process.platform === 'win32',
}, (t) => {
  const outsideCwd = createTempRoot('pf-public-direct-init-cwd-');
  const projectRoot = resolve(outsideCwd, 'generated-project');
  t.after(() => rmSync(outsideCwd, { recursive: true, force: true }));

  const result = spawnSync(
    PRESENTATION_BIN_PATH,
    ['init', '--project', projectRoot, '--slides', '2'],
    {
      cwd: outsideCwd,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const json = JSON.parse(result.stdout);
  assert.equal(json.status, 'created');
  assert.equal(json.slideCount, 2);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), true);
});

test('public presentation bin rejects unsupported long-deck init requests clearly', (t) => {
  const outsideCwd = createTempRoot('pf-public-init-long-deck-');
  const projectRoot = resolve(outsideCwd, 'unsupported-long-deck');
  t.after(() => rmSync(outsideCwd, { recursive: true, force: true }));

  const result = spawnSync(
    process.execPath,
    [PRESENTATION_BIN_PATH, 'init', '--project', projectRoot, '--slides', '11'],
    {
      cwd: outsideCwd,
      encoding: 'utf8',
    }
  );

  assert.equal(result.status, 1);
  assert.match(result.stderr, /supports 1 to 10 slides|supports 1-10 slides|long-deck/i);
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'project.json')), false);
  assert.equal(existsSync(resolve(projectRoot, 'outline.md')), false);
  assert.equal(existsSync(projectRoot), false);
});

test('public presentation bin keeps preview serve alive until terminated', (t) => {
  const outsideCwd = createTempRoot('pf-public-preview-serve-');
  const projectRoot = resolve(outsideCwd, 'preview-project');
  t.after(() => rmSync(outsideCwd, { recursive: true, force: true }));

  const initResult = spawnSync(
    process.execPath,
    [PRESENTATION_BIN_PATH, 'init', '--project', projectRoot, '--slides', '2'],
    {
      cwd: outsideCwd,
      encoding: 'utf8',
    }
  );
  assert.equal(initResult.status, 0, initResult.stderr);

  const startedAt = Date.now();
  const result = spawnSync(
    process.execPath,
    [PRESENTATION_BIN_PATH, 'preview', 'serve', '--project', projectRoot],
    {
      cwd: outsideCwd,
      encoding: 'utf8',
      timeout: 1200,
    }
  );
  const elapsedMs = Date.now() - startedAt;

  assert.ok(elapsedMs >= 1000, `preview serve exited too quickly (${elapsedMs}ms)`);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Preview server started\./);
  assert.match(result.stdout, /previewUrl:/);
});
