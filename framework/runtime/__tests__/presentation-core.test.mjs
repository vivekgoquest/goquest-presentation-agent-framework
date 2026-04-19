import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

import { getProjectClaudeScaffoldPackage } from '../../shared/project-claude-scaffold-package.mjs';
import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { createPresentationCore, PresentationCoreError } from '../presentation-core.mjs';
import { runPresentationCli } from '../presentation-cli.mjs';

const runtimeClaudeScaffoldPackage = getProjectClaudeScaffoldPackage({ frameworkRoot: process.cwd() });
const runtimeClaudeScaffoldSmokePaths = [
  '.claude/settings.json',
  '.claude/hooks/run-presentation-stop-workflow.mjs',
  '.claude/rules/framework.md',
  '.claude/skills/new-deck/SKILL.md',
];

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-presentation-core-'));
}

function assertProjectClaudeScaffold(projectRoot, createdFiles = []) {
  for (const requiredPath of runtimeClaudeScaffoldSmokePaths) {
    assert.equal(existsSync(resolve(projectRoot, requiredPath)), true, `missing required scaffold smoke path: ${requiredPath}`);
    assert.ok(createdFiles.includes(requiredPath), `missing created scaffold smoke file entry: ${requiredPath}`);
  }

  for (const requiredPath of runtimeClaudeScaffoldPackage.requiredPaths) {
    assert.equal(existsSync(resolve(projectRoot, requiredPath)), true, `missing required scaffold path: ${requiredPath}`);
  }

  for (const entry of runtimeClaudeScaffoldPackage.entries) {
    assert.ok(createdFiles.includes(entry.targetRel), `missing created scaffold file entry: ${entry.targetRel}`);
  }
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Presentation Core Brief',
      '',
      '## Goal',
      '',
      'Exercise presentation-core finalize and status semantics.',
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
      '- Core-owned finalize status checks.',
      '',
      '## Constraints',
      '',
      '- none',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );
}

test('presentation core exposes semantic query and operation entrypoints', () => {
  const core = createPresentationCore();
  assert.equal(typeof core.initProject, 'function');
  assert.equal(typeof core.inspectPackage, 'function');
  assert.equal(typeof core.getStatus, 'function');
  assert.equal(typeof core.getPreview, 'function');
  assert.equal(typeof core.previewPresentation, 'function');
  assert.equal(typeof core.runAudit, 'function');
  assert.equal(typeof core.finalize, 'function');
  assert.equal(typeof core.exportPresentation, 'function');
});


test('presentation core initProject creates the full shell-less project scaffold', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const core = createPresentationCore();
  const result = await core.initProject(projectRoot, { slideCount: 2 });

  assert.equal(result.status, 'created');
  assert.equal(result.slideCount, 2);
  assert.ok(result.files.includes('.presentation/framework-cli.mjs'));
  assert.ok(result.files.includes('.claude/settings.json'));
  assert.ok(result.files.includes('.claude/AGENTS.md'));
  assert.ok(result.files.includes('.claude/CLAUDE.md'));
  assert.equal(existsSync(resolve(projectRoot, '.presentation', 'framework-cli.mjs')), true);
  assertProjectClaudeScaffold(projectRoot, result.files);
  assert.equal(existsSync(resolve(projectRoot, '.git')), true);
});

test('presentation core delegates initProject and previewPresentation through injected services', async () => {
  const calls = [];
  const core = createPresentationCore({
    createProjectScaffold(target, options = {}) {
      calls.push(['createProjectScaffold', target, options]);
      return {
        status: 'created',
        deck: 'shell-less-v1',
        sourceDir: target.projectRoot,
        slideCount: options.slideCount,
        files: ['brief.md'],
      };
    },
    async previewPresentation(projectRoot, options = {}) {
      calls.push(['previewPresentation', projectRoot, options]);
      return {
        status: 'pass',
        previewUrl: 'http://127.0.0.1:4173/preview/',
        summary: 'Preview server started.',
      };
    },
  });

  const initResult = await core.initProject('/tmp/core-init-project', { slideCount: 4 });
  const previewResult = await core.previewPresentation('/tmp/core-preview-project', { mode: 'serve' });

  assert.equal(initResult.status, 'created');
  assert.equal(initResult.slideCount, 4);
  assert.equal(previewResult.previewUrl, 'http://127.0.0.1:4173/preview/');
  assert.deepEqual(calls, [
    ['createProjectScaffold', { projectRoot: '/tmp/core-init-project' }, { slideCount: 4, copyFramework: false }],
    ['previewPresentation', '/tmp/core-preview-project', { mode: 'serve' }],
  ]);
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

test('presentation core status and inspect report finalized after a successful root-pdf finalize', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);

  const core = createPresentationCore();
  const finalizeResult = await core.finalize(projectRoot);
  assert.equal(finalizeResult.status, 'pass');
  const rootPdfRel = finalizeResult.outputs.pdf;

  const status = await core.getStatus(projectRoot);
  const inspection = await core.inspectPackage(projectRoot);

  assert.equal(status.workflow, 'finalized');
  assert.deepEqual(status.facets, {
    delivery: 'finalized_current',
    evidence: 'current',
  });
  assert.equal(status.nextBoundary, 'maintain');
  assert.deepEqual(status.nextFocus, [rootPdfRel]);
  assert.equal(inspection.status.workflow, 'finalized');
  assert.deepEqual(inspection.status.facets, {
    delivery: 'finalized_current',
    evidence: 'current',
  });
  assert.equal(inspection.status.nextBoundary, 'maintain');
  assert.deepEqual(inspection.status.nextFocus, [rootPdfRel]);
  assert.equal(inspection.artifacts.finalized.exists, true);
});

test('presentation core marks finalized delivery stale after authored source changes', async (t) => {
  const projectRoot = createTempProjectRoot();
  const slideHtmlPath = resolve(projectRoot, 'slides', '010-intro', 'slide.html');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);

  const core = createPresentationCore();
  const finalizeResult = await core.finalize(projectRoot);
  assert.equal(finalizeResult.status, 'pass');
  const rootPdfRel = finalizeResult.outputs.pdf;

  const originalSlideHtml = readFileSync(slideHtmlPath, 'utf8');
  writeFileSync(slideHtmlPath, `${originalSlideHtml}\n<!-- post-finalize source change -->\n`);

  const status = await core.getStatus(projectRoot);
  const inspection = await core.inspectPackage(projectRoot);

  assert.equal(status.workflow, 'authoring');
  assert.deepEqual(status.facets, {
    delivery: 'finalized_stale',
    evidence: 'stale',
  });
  assert.deepEqual(status.nextFocus, ['presentation export', rootPdfRel]);
  assert.equal(inspection.status.workflow, 'authoring');
  assert.deepEqual(inspection.status.facets, {
    delivery: 'finalized_stale',
    evidence: 'stale',
  });
  assert.deepEqual(inspection.status.nextFocus, ['presentation export', rootPdfRel]);
  assert.equal(inspection.artifacts.finalized.exists, true);
});

test('presentation core keeps stale finalized status after an explicit non-canonical pdf export', async (t) => {
  const projectRoot = createTempProjectRoot();
  const slideHtmlPath = resolve(projectRoot, 'slides', '010-intro', 'slide.html');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);

  const core = createPresentationCore();
  const finalizeResult = await core.finalize(projectRoot);
  assert.equal(finalizeResult.status, 'pass');
  const rootPdfRel = finalizeResult.outputs.pdf;

  const originalSlideHtml = readFileSync(slideHtmlPath, 'utf8');
  writeFileSync(slideHtmlPath, `${originalSlideHtml}\n<!-- stale after finalize -->\n`);

  const exportResult = await core.exportPresentation(projectRoot, {
    target: 'pdf',
    outputDir: resolve(projectRoot, 'outputs', 'exports', 'manual'),
    outputFile: 'review-copy.pdf',
  });
  assert.equal(exportResult.status, 'pass');
  assert.equal(exportResult.outputDir, 'outputs/exports/manual');
  assert.deepEqual(exportResult.artifacts, ['outputs/exports/manual/review-copy.pdf']);

  const inspection = await core.inspectPackage(projectRoot);
  assert.equal(inspection.status.workflow, 'authoring');
  assert.deepEqual(inspection.status.facets, {
    delivery: 'finalized_stale',
    evidence: 'stale',
  });
  assert.deepEqual(inspection.status.nextFocus, ['presentation export', rootPdfRel]);
  assert.equal(inspection.artifacts.finalized.exists, true);
  assert.equal(inspection.artifacts.finalized.pdf.path, rootPdfRel);
  assert.equal(inspection.artifacts.latestExport.pdf.path, 'outputs/exports/manual/review-copy.pdf');
});

test('presentation core does not treat failed validation evidence as ready for finalize', async (t) => {
  const [{ validatePresentation }] = await Promise.all([
    import('../services/presentation-ops-service.mjs'),
  ]);
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);

  writeFileSync(
    resolve(projectRoot, 'slides', '010-intro', 'slide.html'),
    `<div class="slide"><h2>Broken validate deck</h2><script>console.error('validation fail')</script></div>\n`
  );

  const validation = await validatePresentation(
    { projectRoot },
    { outputDir: resolve(projectRoot, '.artifacts', 'failed-check') }
  );
  assert.equal(validation.status, 'fail');

  const core = createPresentationCore();
  const status = await core.getStatus(projectRoot);
  const inspection = await core.inspectPackage(projectRoot);

  assert.equal(status.workflow, 'authoring');
  assert.deepEqual(status.facets, {
    delivery: 'not_finalized',
    evidence: 'stale',
  });
  assert.equal(inspection.renderState.status, 'fail');
  assert.equal(inspection.status.workflow, 'authoring');
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

test('presentation core rejects finalize implementations that mutate authored source at the core seam', async (t) => {
  const projectRoot = createTempProjectRoot();
  const slideHtmlPath = resolve(projectRoot, 'slides', '010-intro', 'slide.html');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const originalSlideHtml = readFileSync(slideHtmlPath, 'utf8');
  const core = createPresentationCore({
    async finalizePresentation() {
      writeFileSync(slideHtmlPath, `${originalSlideHtml}\n<!-- mutated by test -->\n`);
      return {
        status: 'pass',
        outputs: {
          outputDir: 'outputs/finalized',
          pdf: 'outputs/finalized/deck.pdf',
        },
        issues: [],
      };
    },
  });

  await assert.rejects(
    () => core.finalize(projectRoot),
    (error) => {
      assert.ok(error instanceof PresentationCoreError);
      assert.match(error.message, /finalize must not modify authored content/i);
      assert.deepEqual(error.extra.changedPaths, ['slides/010-intro/slide.html']);
      return true;
    }
  );
});

test('presentation core rejects export implementations that create or mutate authored root files at the core seam', async (t) => {
  const projectRoot = createTempProjectRoot();
  const outlinePath = resolve(projectRoot, 'outline.md');
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const core = createPresentationCore({
    async exportPresentation(target, request) {
      writeFileSync(outlinePath, '# Mutated outline\n');
      const outputDir = resolve(target.projectRoot, request.outputDir);
      return {
        format: request.format,
        outputDir,
        outputPaths: [resolve(outputDir, request.outputFile || 'deck.pdf')],
      };
    },
  });

  await assert.rejects(
    () => core.exportPresentation(projectRoot, {
      target: 'pdf',
      slideIds: ['intro'],
      outputDir: 'outputs/exports/manual',
      outputFile: 'deck.pdf',
    }),
    (error) => {
      assert.ok(error instanceof PresentationCoreError);
      assert.match(error.message, /export must not modify authored content/i);
      assert.deepEqual(error.extra.changedPaths, ['outline.md']);
      return true;
    }
  );
});

test('presentation core exportPresentation defaults to the root pdf deliverable when no target or output path is provided', async (t) => {
  const projectRoot = createTempProjectRoot();
  const rootPdfRel = `${basename(projectRoot)}.pdf`;
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const exportCalls = [];
  const core = createPresentationCore({
    async exportPresentation(target, request, runtimeOptions) {
      exportCalls.push({ target, request, runtimeOptions });
      return {
        format: request.format,
        slideIds: request.slideIds,
        outputDir: projectRoot,
        outputPaths: [resolve(projectRoot, rootPdfRel)],
      };
    },
  });

  const result = await core.exportPresentation(projectRoot, {});

  assert.equal(exportCalls.length, 1);
  assert.deepEqual(exportCalls[0], {
    target: { projectRoot },
    request: {
      format: 'pdf',
      slideIds: [exportCalls[0].request.slideIds[0]],
      selectionMode: 'full-deck',
      outputDir: '',
      outputFile: '',
    },
    runtimeOptions: {
      cwd: projectRoot,
    },
  });
  assert.equal(result.projectRoot, projectRoot);
  assert.equal(result.outputDir, '');
  assert.deepEqual(result.artifacts, [rootPdfRel]);
  assert.deepEqual(result.evidenceUpdated, ['.presentation/runtime/artifacts.json']);
});

test('presentation core forwards explicit slide selections as filtered export requests and surfaces canonical-root rejections', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const exportCalls = [];
  const core = createPresentationCore({
    async exportPresentation(target, request) {
      exportCalls.push({ target, request });
      throw new Error(
        'Slide-filtered PDF exports require --output-dir or --output-file. The canonical root PDF is reserved for full-deck finalize/export.'
      );
    },
  });

  await assert.rejects(
    () => core.exportPresentation(projectRoot, { target: 'pdf', slideIds: ['intro'] }),
    (error) => {
      assert.ok(error instanceof PresentationCoreError);
      assert.equal(error.status, 'invalid-request');
      assert.match(error.message, /Slide-filtered PDF exports require --output-dir or --output-file/i);
      return true;
    }
  );

  assert.deepEqual(exportCalls, [{
    target: { projectRoot },
    request: {
      format: 'pdf',
      slideIds: ['intro'],
      selectionMode: 'filtered',
      outputDir: '',
      outputFile: '',
    },
  }]);
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

test('presentation CLI delegates init through the core facade', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const calls = [];
  const result = await runPresentationCli(['init', '--project', projectRoot, '--slides', '4', '--format', 'json'], {
    core: {
      async initProject(input, options = {}) {
        calls.push(['initProject', input, options]);
        return {
          status: 'created',
          deck: 'shell-less-v1',
          sourceDir: input,
          slideCount: options.slideCount,
          files: ['brief.md', 'slides/010-intro/slide.html'],
          nextSteps: ['presentation status --project /tmp/example'],
        };
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.payload.status, 'created');
  assert.equal(result.payload.projectRoot, projectRoot);
  assert.deepEqual(calls, [['initProject', projectRoot, { slideCount: 4, copyFramework: false }]]);
});

test('presentation CLI delegates preview through the core facade', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const calls = [];
  const result = await runPresentationCli(['preview', 'serve', '--project', projectRoot, '--format', 'json'], {
    core: {
      async previewPresentation(input, options = {}) {
        calls.push(['previewPresentation', input, options]);
        return {
          status: 'pass',
          previewUrl: 'http://127.0.0.1:4173/preview/',
          summary: 'Preview server started.',
        };
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.payload.status, 'pass');
  assert.equal(result.payload.previewUrl, 'http://127.0.0.1:4173/preview/');
  assert.deepEqual(calls, [['previewPresentation', projectRoot, { mode: 'serve' }]]);
});

test('presentation CLI routes finalize through the core finalize contract', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const calls = [];
  const result = await runPresentationCli(['finalize', '--project', projectRoot, '--format', 'json'], {
    core: {
      async finalize(input) {
        calls.push(['finalize', input]);
        return {
          kind: 'presentation-finalize',
          projectRoot: input,
          status: 'pass',
          outputs: {
            outputDir: '',
            pdf: `${basename(input)}.pdf`,
            artifacts: [`${basename(input)}.pdf`],
          },
          evidenceUpdated: ['.presentation/runtime/render-state.json', '.presentation/runtime/artifacts.json'],
          issues: [],
        };
      },
    },
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.payload.status, 'pass');
  assert.equal(result.payload.summary, 'Canonical finalize artifacts were produced.');
  assert.deepEqual(result.payload.outputs.artifacts, [`${basename(projectRoot)}.pdf`]);
  assert.deepEqual(calls, [['finalize', projectRoot]]);
});

test('presentation CLI returns violations for export and finalize soft-fail results', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const scenarios = [
    {
      family: 'export',
      expectedSummary: 'Requested export completed with issues.',
      core: {
        async exportPresentation(input, options = {}) {
          assert.equal(input, projectRoot);
          assert.deepEqual(options, {
            target: 'pdf',
            slideIds: [],
            outputDir: '',
            outputFile: '',
          });
          return {
            kind: 'presentation-export',
            projectRoot: input,
            status: 'fail',
            outputDir: '',
            artifacts: [`${basename(input)}.pdf`],
            evidenceUpdated: ['.presentation/runtime/artifacts.json'],
            issues: ['Browser console errors were detected: 1.'],
            scope: {
              kind: 'export',
              format: 'pdf',
              projectRoot: input,
            },
          };
        },
      },
    },
    {
      family: 'finalize',
      expectedSummary: 'Finalize completed with issues.',
      core: {
        async finalize(input) {
          assert.equal(input, projectRoot);
          return {
            kind: 'presentation-finalize',
            projectRoot: input,
            status: 'fail',
            outputs: {
              outputDir: '',
              pdf: `${basename(input)}.pdf`,
              artifacts: [`${basename(input)}.pdf`],
            },
            evidenceUpdated: ['.presentation/runtime/render-state.json', '.presentation/runtime/artifacts.json'],
            issues: ['Browser console errors were detected: 1.'],
          };
        },
      },
    },
  ];

  for (const { family, expectedSummary, core } of scenarios) {
    const result = await runPresentationCli([family, '--project', projectRoot, '--format', 'json'], { core });

    assert.equal(result.exitCode, 1);
    assert.equal(result.payload.status, 'fail');
    assert.equal(result.payload.summary, expectedSummary);
    assert.deepEqual(result.payload.issues, ['Browser console errors were detected: 1.']);
  }
});

test('presentation CLI rejects finalize positionals instead of silently exporting pdf', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  let exportCalls = 0;
  let finalizeCalls = 0;
  const result = await runPresentationCli(['finalize', 'status', '--project', projectRoot, '--format', 'json'], {
    core: {
      async exportPresentation() {
        exportCalls += 1;
        return {
          status: 'pass',
          outputDir: 'outputs/exports/manual',
          artifacts: ['outputs/exports/manual/deck.pdf'],
          evidenceUpdated: ['.presentation/runtime/artifacts.json'],
          issues: [],
          scope: {
            kind: 'export',
            format: 'pdf',
            projectRoot,
          },
        };
      },
      async finalize() {
        finalizeCalls += 1;
        return {
          status: 'pass',
          outputs: {
            outputDir: '',
            pdf: `${basename(projectRoot)}.pdf`,
            artifacts: [`${basename(projectRoot)}.pdf`],
          },
          evidenceUpdated: ['.presentation/runtime/render-state.json', '.presentation/runtime/artifacts.json'],
          issues: [],
        };
      },
    },
  });

  assert.equal(result.exitCode, 4);
  assert.equal(result.payload.status, 'invalid-args');
  assert.match(result.payload.summary, /Finalize does not accept --output-dir, --output-file, or --slide/i);
  assert.equal(exportCalls, 0);
  assert.equal(finalizeCalls, 0);
});

test('presentation CLI defaults export to pdf and the root deliverable when no target is provided', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const calls = [];
  const result = await runPresentationCli([
    'export',
    '--project',
    projectRoot,
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
          outputDir: '',
          artifacts: [`${basename(input)}.pdf`],
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
      slideIds: [],
      outputDir: '',
      outputFile: '',
    },
  ]]);
});
