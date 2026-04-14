import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { createPresentationCore } from '../presentation-core.mjs';
import { runPresentationCli } from '../presentation-cli.mjs';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-presentation-core-'));
}

test('presentation core exposes semantic query and operation entrypoints', () => {
  const core = createPresentationCore();
  assert.equal(typeof core.inspectPackage, 'function');
  assert.equal(typeof core.getStatus, 'function');
  assert.equal(typeof core.getPreview, 'function');
  assert.equal(typeof core.runAudit, 'function');
  assert.equal(typeof core.finalize, 'function');
  assert.equal(typeof core.exportPresentation, 'function');
});

test('presentation core inspectPackage returns manifest, evidence, and status', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const core = createPresentationCore();
  const result = await core.inspectPackage(projectRoot);

  assert.equal(result.kind, 'presentation-package');
  assert.equal(result.projectRoot, projectRoot);
  assert.equal(result.manifest.counts.slidesTotal, 1);
  assert.equal(result.status.workflow, 'onboarding');
  assert.ok(result.renderState);
  assert.ok(result.artifacts);
  assert.deepEqual(result.evidence, [
    '.presentation/package.generated.json',
    '.presentation/runtime/render-state.json',
    '.presentation/runtime/artifacts.json',
  ]);
});

test('presentation CLI delegates package status through the core facade', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const calls = [];
  const result = await runPresentationCli(['status', '--project', projectRoot, '--format', 'json'], {
    core: {
      async getStatus(input) {
        calls.push(['getStatus', input]);
        return {
          kind: 'presentation-status',
          projectRoot: input,
          workflow: 'onboarding',
          summary: 'Author the required source files before the package can enter the normal workflow.',
          blockers: [],
          facets: {
            delivery: 'not_finalized',
            evidence: 'missing',
          },
          nextBoundary: 'finalize',
          nextFocus: ['brief.md'],
          evidence: [
            '.presentation/runtime/render-state.json',
            '.presentation/runtime/artifacts.json',
          ],
          freshness: {
            relativeToSource: 'missing',
          },
        };
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.payload.workflow, 'onboarding');
  assert.deepEqual(calls, [['getStatus', projectRoot]]);
});
