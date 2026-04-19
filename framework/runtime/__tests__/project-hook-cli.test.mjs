import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-project-hook-cli-'));
}

test('scaffolded project stop hook stays a thin project-local CLI adapter', (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const hookSource = readFileSync(
    resolve(projectRoot, '.claude', 'hooks', 'run-presentation-stop-workflow.mjs'),
    'utf8'
  );

  assert.match(hookSource, /\bspawnSync\b/);
  assert.doesNotMatch(hookSource, /framework\/application\/project-hook-service\.mjs/);
  assert.doesNotMatch(hookSource, /\bframeworkSource\b/);
  assert.match(hookSource, /\.presentation\/framework-cli\.mjs/);
  assert.match(hookSource, /audit all/);
});
