import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-deck-paths-'));
}

test('parsePresentationTargetCliArgs accepts project targets only', async () => {
  const { parsePresentationTargetCliArgs } = await import('../deck-paths.js');

  const parsed = parsePresentationTargetCliArgs(['--project', '/tmp/pf-target']);
  assert.equal(parsed.target.kind, 'project');
  assert.equal(parsed.target.projectRootAbs, '/tmp/pf-target');

  assert.throws(
    () => parsePresentationTargetCliArgs(['--deck', 'legacy']),
    /Legacy workspace target "--deck" was removed/
  );
  assert.throws(
    () => parsePresentationTargetCliArgs(['--example', 'legacy']),
    /Legacy workspace target "--example" was removed/
  );
});

test('project paths expose finalized and export output roots without last-good rel paths', async (t) => {
  const [{ createProjectScaffold }, { getProjectOutputPaths, getProjectPaths }] = await Promise.all([
    import('../../application/project-scaffold-service.mjs'),
    import('../deck-paths.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });

  const paths = getProjectPaths(projectRoot);
  assert.equal(paths.renderStateRel, '.presentation/runtime/render-state.json');
  assert.equal(paths.artifactsRel, '.presentation/runtime/artifacts.json');
  assert.equal('lastGoodRel' in paths, false);

  const outputPaths = getProjectOutputPaths(projectRoot);
  assert.equal(outputPaths.finalizedOutputDirRel, 'outputs/finalized');
  assert.equal(outputPaths.finalizedPdfRel, 'outputs/finalized/deck.pdf');
  assert.equal(outputPaths.finalizedReportRel, 'outputs/finalized/report.json');
  assert.equal(outputPaths.finalizedSummaryRel, 'outputs/finalized/summary.md');
  assert.equal(outputPaths.finalizedFullPageRel, 'outputs/finalized/full-page.png');
  assert.equal(outputPaths.finalizedSlidesDirRel, 'outputs/finalized/slides');
  assert.equal(outputPaths.exportsOutputDirRel, 'outputs/exports');
});
