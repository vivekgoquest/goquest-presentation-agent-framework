import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { createPresentationCore, PresentationCoreError } from '../presentation-core.mjs';
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

test('presentation core exportPresentation anchors export requests to the project root and returns project-relative outputs', async (t) => {
  const projectRoot = createTempProjectRoot();
  const exportOutputDir = resolve(projectRoot, 'outputs', 'exports', 'manual');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const exportCalls = [];
  const core = createPresentationCore({
    async exportPresentation(target, request, runtimeOptions) {
      exportCalls.push({ target, request, runtimeOptions });
      return {
        format: request.format,
        slideIds: request.slideIds,
        outputDir: exportOutputDir,
        outputPaths: [resolve(exportOutputDir, 'deck.pdf')],
      };
    },
  });

  const result = await core.exportPresentation(projectRoot, {
    target: 'pdf',
    outputDir: exportOutputDir,
  });

  assert.equal(exportCalls.length, 1);
  assert.deepEqual(exportCalls[0], {
    target: { projectRoot },
    request: {
      format: 'pdf',
      slideIds: [exportCalls[0].request.slideIds[0]],
      outputDir: 'outputs/exports/manual',
      outputFile: '',
    },
    runtimeOptions: {
      cwd: projectRoot,
    },
  });
  assert.equal(result.projectRoot, projectRoot);
  assert.equal(result.outputDir, 'outputs/exports/manual');
  assert.deepEqual(result.artifacts, ['outputs/exports/manual/deck.pdf']);
  assert.deepEqual(result.evidenceUpdated, ['.presentation/runtime/artifacts.json']);
});

test('presentation core exportPresentation rejects out-of-project output directories before invoking the exporter', async (t) => {
  const projectRoot = createTempProjectRoot();
  const outsideRoot = createTempProjectRoot();
  const outputDir = resolve(outsideRoot, 'exports');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  t.after(() => rmSync(outsideRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  let exportCalls = 0;
  const core = createPresentationCore({
    async exportPresentation() {
      exportCalls += 1;
      return {};
    },
  });

  await assert.rejects(
    () => core.exportPresentation(projectRoot, { target: 'pdf', outputDir }),
    (error) => {
      assert.ok(error instanceof PresentationCoreError);
      assert.equal(error.status, 'unsupported');
      assert.match(error.message, /must stay within the project root/i);
      return true;
    }
  );

  assert.equal(exportCalls, 0);
});

test('presentation core exportPresentation rejects unsafe absolute output files before invoking the exporter', async (t) => {
  const projectRoot = createTempProjectRoot();
  const outsideRoot = createTempProjectRoot();
  const outputDir = resolve(projectRoot, 'outputs', 'exports', 'manual');
  const outputFile = resolve(outsideRoot, 'deck.pdf');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  t.after(() => rmSync(outsideRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  let exportCalls = 0;
  const core = createPresentationCore({
    async exportPresentation() {
      exportCalls += 1;
      return {};
    },
  });

  await assert.rejects(
    () => core.exportPresentation(projectRoot, { target: 'pdf', outputDir, outputFile }),
    (error) => {
      assert.ok(error instanceof PresentationCoreError);
      assert.equal(error.status, 'unsupported');
      assert.match(error.message, /must stay within the requested output directory/i);
      return true;
    }
  );

  assert.equal(exportCalls, 0);
});

test('presentation CLI delegates inspect package through the core facade', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const calls = [];
  const result = await runPresentationCli(['inspect', 'package', '--project', projectRoot, '--format', 'json'], {
    core: {
      async inspectPackage(input, options = {}) {
        calls.push(['inspectPackage', input, options]);
        return {
          kind: 'presentation-package',
          projectRoot: input,
          title: 'Core Seam Deck',
          slug: 'core-seam-deck',
          manifest: {
            counts: { slidesTotal: 1 },
          },
          renderState: {},
          artifacts: {},
          status: {
            workflow: 'onboarding',
            nextFocus: ['brief.md'],
          },
          evidence: [
            '.presentation/package.generated.json',
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
  assert.equal(result.payload.status, 'ok');
  assert.deepEqual(calls, [['inspectPackage', projectRoot, { target: 'package' }]]);
});

test('presentation CLI delegates audit through the core facade', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const calls = [];
  const result = await runPresentationCli([
    'audit',
    'theme',
    '--project',
    projectRoot,
    '--slide',
    'intro',
    '--path',
    'theme.css',
    '--severity',
    'warning',
    '--deck',
    '--strict',
    '--render',
    '--format',
    'json',
  ], {
    core: {
      async runAudit(input, options = {}) {
        calls.push(['runAudit', input, options]);
        return {
          kind: 'presentation-audit',
          family: options.family,
          projectRoot: input,
          slideId: options.slideId,
          status: 'pass',
          issueCount: 0,
          issues: [],
          nextFocus: [],
        };
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.payload.status, 'pass');
  assert.deepEqual(calls, [[
    'runAudit',
    projectRoot,
    {
      family: 'theme',
      slideId: 'intro',
      path: 'theme.css',
      deck: true,
      severity: 'warning',
      strict: true,
      render: true,
    },
  ]]);
});

test('presentation CLI delegates finalize through the core facade', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const calls = [];
  const result = await runPresentationCli(['finalize', 'run', '--project', projectRoot, '--format', 'json'], {
    core: {
      async finalize(input, options = {}) {
        calls.push(['finalize', input, options]);
        return {
          kind: 'presentation-finalize',
          projectRoot: input,
          status: 'pass',
          outputs: {
            outputDir: 'outputs/finalized',
            pdf: 'outputs/finalized/deck.pdf',
          },
          evidenceUpdated: [
            '.presentation/runtime/render-state.json',
            '.presentation/runtime/artifacts.json',
          ],
          issues: [],
        };
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.payload.status, 'pass');
  assert.deepEqual(calls, [['finalize', projectRoot, { target: 'run' }]]);
});

test('presentation CLI delegates export through the core facade', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const calls = [];
  const result = await runPresentationCli([
    'export',
    'pdf',
    '--project',
    projectRoot,
    '--slide',
    'intro',
    '--output-dir',
    'outputs/exports/manual',
    '--output-file',
    'deck.pdf',
    '--format',
    'json',
  ], {
    core: {
      async exportPresentation(input, options = {}) {
        calls.push(['exportPresentation', input, options]);
        return {
          kind: 'presentation-export',
          projectRoot: input,
          status: 'pass',
          outputDir: 'outputs/exports/manual',
          artifacts: ['outputs/exports/manual/deck.pdf'],
          evidenceUpdated: ['.presentation/runtime/artifacts.json'],
          issues: [],
          scope: {
            kind: 'export',
            format: 'pdf',
            projectRoot: input,
          },
        };
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.payload.status, 'pass');
  assert.deepEqual(calls, [[
    'exportPresentation',
    projectRoot,
    {
      target: 'pdf',
      slideIds: ['intro'],
      outputDir: 'outputs/exports/manual',
      outputFile: 'deck.pdf',
    },
  ]]);
});
