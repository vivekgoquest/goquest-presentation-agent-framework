import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CLI_PATH = resolve(process.cwd(), 'framework', 'runtime', 'presentation-cli.mjs');

function createTempWorkspaceRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-shellless-package-'));
}

function installResolvableFrameworkPackage(workspaceRoot) {
  const packageRoot = resolve(workspaceRoot, 'node_modules', 'pitch-framework');
  mkdirSync(packageRoot, { recursive: true });
  writeFileSync(
    resolve(packageRoot, 'package.json'),
    `${JSON.stringify({
      name: 'pitch-framework',
      type: 'module',
      exports: {
        './presentation-cli': './presentation-cli.mjs',
      },
    }, null, 2)}\n`
  );
  writeFileSync(
    resolve(packageRoot, 'presentation-cli.mjs'),
    `export { runPresentationCli } from ${JSON.stringify(pathToFileURL(CLI_PATH).href)};\n`
  );
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Shell-less Package Brief',
      '',
      '## Goal',
      '',
      'Prove the runtime-first CLI can scaffold, audit, and finalize a project package.',
      '',
      '## Audience',
      '',
      'Framework maintainers.',
      '',
      '## Tone',
      '',
      'Operational and concise.',
      '',
      '## Must Include',
      '',
      '- Runtime-only project lifecycle coverage.',
      '',
      '## Constraints',
      '',
      '- Do not depend on Electron or the application layer.',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );
}

function runNode(args, cwd) {
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
}

function parseCliJson(stdout) {
  const jsonStart = stdout.indexOf('{');
  assert.notEqual(jsonStart, -1, `expected JSON output, got: ${stdout}`);
  return JSON.parse(stdout.slice(jsonStart));
}

test('runtime-first package flow works through the project-local shim and produces the root pdf', { timeout: 120000 }, async (t) => {
  const workspaceRoot = createTempWorkspaceRoot();
  const projectRoot = resolve(workspaceRoot, 'shellless-integration-project');
  t.after(() => rmSync(workspaceRoot, { recursive: true, force: true }));

  installResolvableFrameworkPackage(workspaceRoot);

  const initResult = runNode([
    CLI_PATH,
    'init',
    '--project',
    projectRoot,
    '--slides',
    '1',
    '--format',
    'json',
  ], workspaceRoot);

  assert.equal(initResult.status, 0, initResult.stderr);
  const initJson = parseCliJson(initResult.stdout);
  assert.equal(initJson.status, 'created');
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework-cli.mjs')), true);

  fillBrief(projectRoot);

  const shimPath = resolve(projectRoot, '.presentation', 'framework-cli.mjs');
  const auditResult = runNode([shimPath, 'audit', 'all', '--format', 'json'], projectRoot);

  assert.equal(auditResult.status, 0, auditResult.stderr);
  const auditJson = parseCliJson(auditResult.stdout);
  assert.equal(auditJson.status, 'pass');
  assert.equal(auditJson.family, 'all');
  assert.equal(auditJson.issueCount, 0);

  const finalizeResult = runNode([shimPath, 'finalize', '--format', 'json'], projectRoot);

  assert.equal(finalizeResult.status, 0, finalizeResult.stderr);
  const finalizeJson = parseCliJson(finalizeResult.stdout);
  assert.equal(finalizeJson.status, 'pass');

  const projectMetadata = JSON.parse(readFileSync(resolve(projectRoot, '.presentation', 'project.json'), 'utf8'));
  const rootPdfRel = `${projectMetadata.projectSlug}.pdf`;
  const artifactsState = JSON.parse(readFileSync(resolve(projectRoot, '.presentation', 'runtime', 'artifacts.json'), 'utf8'));

  assert.ok(finalizeJson.outputs.artifacts.includes(rootPdfRel));
  assert.equal(existsSync(resolve(projectRoot, rootPdfRel)), true);
  assert.equal(artifactsState.finalized.exists, true);
  assert.equal(artifactsState.finalized.pdf.path, rootPdfRel);
  assert.equal(artifactsState.latestExport.pdf.path, rootPdfRel);
});
