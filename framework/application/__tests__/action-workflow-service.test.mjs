import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(resolve(tmpdir(), 'pf-action-workflow-'));
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Action Workflow Brief',
      '',
      '## Goal',
      '',
      'Validate canonical action workflow orchestration.',
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
      '- Canonical workflow preparation.',
      '- Shared project truth inputs.',
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

function fillOutline(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'outline.md'),
    [
      '# Outline',
      '',
      '1. Intro',
      '2. Proof',
      '3. Close',
      '',
    ].join('\n')
  );
}

function createQualityWarningSlideHtml(title) {
  return [
    '<div class="slide">',
    '  <div class="eyebrow">Quality Warning Deck</div>',
    `  <h2 class="sect-title">${title}</h2>`,
    '  <div class="g2">',
    '    <div class="icard"><p class="body-text">Point one</p></div>',
    '    <div class="icard"><p class="body-text">Point two</p></div>',
    '  </div>',
    '</div>',
    '',
  ].join('\n');
}

function createValidationFailureSlideHtml(title) {
  return [
    '<div class="slide" style="padding: 24px;">',
    '  <div class="eyebrow">Validation Failure Deck</div>',
    `  <h2 class="sect-title">${title}</h2>`,
    '  <p class="body-text">This slide should fail deterministic validation because it uses an inline style.</p>',
    '</div>',
    '',
  ].join('\n');
}

function getCanonicalPdfName(projectRoot) {
  return `${basename(projectRoot)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')}.pdf`;
}

function getReviewPdfPath(projectRoot, lane) {
  return resolve(projectRoot, '.presentation', 'runtime', 'reviews', lane, 'review.pdf');
}

function createWorkflowContext(projectRoot, overrides = {}) {
  return {
    action: {
      id: overrides.actionId || 'fix_validation_issues',
      label: overrides.label || 'Fix validation issues',
    },
    args: overrides.args || {},
    meta: {
      active: true,
      projectRoot,
      ...(overrides.meta || {}),
    },
    projectState: overrides.projectState || {
      kind: 'project',
      status: 'ready_to_finalize',
    },
    target: overrides.target || {
      kind: 'project',
      projectRootAbs: projectRoot,
    },
    outputPaths: overrides.outputPaths || {
      outputDirAbs: resolve(projectRoot, 'outputs'),
    },
    frameworkRoot: overrides.frameworkRoot || process.cwd(),
    terminalService: overrides.terminalService || null,
    trigger: overrides.trigger || 'electron',
  };
}

test('action workflow service exposes canonical workflow definitions for all product actions', async () => {
  const { listActionWorkflowDefinitions } = await import('../action-service.mjs');

  const definitions = listActionWorkflowDefinitions();
  assert.deepEqual(
    definitions.map((definition) => definition.actionId),
    [
      'export_presentation',
      'export_presentation_artifacts',
      'validate_presentation',
      'capture_screenshots',
      'fix_validation_issues',
      'review_narrative_presentation',
      'apply_narrative_review_changes',
      'review_visual_presentation',
      'apply_visual_review_changes',
    ]
  );

  const validate = definitions.find((definition) => definition.actionId === 'validate_presentation');
  assert.equal(validate.workflowId, 'presentation-validate');
  assert.deepEqual(validate.allowedTriggers, ['electron', 'hook', 'agent', 'cli']);

  const exportArtifacts = definitions.find((definition) => definition.actionId === 'export_presentation_artifacts');
  assert.equal(exportArtifacts.workflowId, 'presentation-export-artifacts');

  const fixValidationIssues = definitions.find((definition) => definition.actionId === 'fix_validation_issues');
  assert.equal(fixValidationIssues.workflowId, 'presentation-fix-validation-issues');

  const reviewNarrative = definitions.find((definition) => definition.actionId === 'review_narrative_presentation');
  assert.equal(reviewNarrative.workflowId, 'presentation-narrative-review');

  const applyNarrative = definitions.find((definition) => definition.actionId === 'apply_narrative_review_changes');
  assert.equal(applyNarrative.workflowId, 'presentation-apply-narrative-review');

  const reviewVisual = definitions.find((definition) => definition.actionId === 'review_visual_presentation');
  assert.equal(reviewVisual.workflowId, 'presentation-visual-review');

  const applyVisual = definitions.find((definition) => definition.actionId === 'apply_visual_review_changes');
  assert.equal(applyVisual.workflowId, 'presentation-apply-visual-review');
});

test('fix validation issues workflow prepares canonical project truth before invoking the agent adapter', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);
  writeFileSync(
    resolve(projectRoot, 'slides', '010-intro', 'slide.html'),
    createValidationFailureSlideHtml('Inline style violation')
  );

  const terminalStarts = [];
  const agentCalls = [];
  const workflowService = createActionWorkflowService({
    presentationAdapter: {
      invoke: async (actionId) => actionId === 'validate_presentation'
        ? {
          status: 'fail',
          failures: ['Inline style violation'],
          detail: 'Inline style violation',
        }
        : { status: 'pass', message: 'noop' },
    },
    agentAdapter: {
      async invoke(actionId, context) {
        agentCalls.push({ actionId, workflow: context.workflow });
        return { status: 'pass', message: 'Reviewed.' };
      },
    },
  });

  const result = await workflowService.invokeAction(
    'fix_validation_issues',
    createWorkflowContext(projectRoot, {
      actionId: 'fix_validation_issues',
      label: 'Fix validation issues',
      terminalService: {
        getMeta() {
          return { alive: false, mode: null };
        },
        start(mode) {
          terminalStarts.push(mode);
          return { alive: true, mode };
        },
      },
    })
  );

  assert.equal(result.status, 'pass');
  assert.equal(result.actionId, 'fix_validation_issues');
  assert.equal(result.workflowId, 'presentation-fix-validation-issues');
  assert.equal(result.trigger, 'electron');
  assert.deepEqual(terminalStarts, ['shell']);
  assert.equal(agentCalls.length, 1);
  assert.equal(agentCalls[0].actionId, 'fix_validation_issues');
  assert.equal(agentCalls[0].workflow.workflowId, 'presentation-fix-validation-issues');
  assert.match(agentCalls[0].workflow.prompt, /package\.generated\.json/);
  assert.match(agentCalls[0].workflow.prompt, /render-state\.json/);
  assert.match(agentCalls[0].workflow.prompt, /artifacts\.json/);
  assert.match(agentCalls[0].workflow.prompt, /Canonical delivery artifact/i);
  assert.match(agentCalls[0].workflow.prompt, new RegExp(getCanonicalPdfName(projectRoot).replace('.', '\\.')));
  assert.doesNotMatch(agentCalls[0].workflow.prompt, /outputs\/finalized/);
  assert.doesNotMatch(agentCalls[0].workflow.prompt, /last-good|Last good checkpoint/i);
});

test('fix validation issues workflow skips agent execution when the refreshed validation has no failures', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  let agentCalls = 0;
  const workflowService = createActionWorkflowService({
    presentationAdapter: { invoke: async () => ({ status: 'pass', message: 'noop' }) },
    agentAdapter: {
      async invoke() {
        agentCalls += 1;
        return { status: 'pass', message: 'Fixed.' };
      },
    },
  });

  const result = await workflowService.invokeAction(
    'fix_validation_issues',
    createWorkflowContext(projectRoot, {
      actionId: 'fix_validation_issues',
      label: 'Fix validation issues',
    })
  );

  assert.equal(agentCalls, 0);
  assert.equal(result.status, 'skip');
  assert.match(result.message, /no validation failures/i);
  assert.equal(result.workflowId, 'presentation-fix-validation-issues');
});

test('fix validation issues workflow refreshes deterministic failures before invoking the agent adapter', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);
  writeFileSync(
    resolve(projectRoot, 'slides', '020-close', 'slide.html'),
    createValidationFailureSlideHtml('Inline style violation')
  );

  const agentCalls = [];
  const workflowService = createActionWorkflowService({
    presentationAdapter: {
      invoke: async (actionId) => actionId === 'validate_presentation'
        ? {
          status: 'fail',
          failures: ['Inline style violation'],
          detail: 'Inline style violation',
        }
        : { status: 'pass', message: 'noop' },
    },
    agentAdapter: {
      async invoke(actionId, context) {
        agentCalls.push({ actionId, workflow: context.workflow });
        return { status: 'pass', message: 'Fixed warnings.' };
      },
    },
  });

  const result = await workflowService.invokeAction(
    'fix_validation_issues',
    createWorkflowContext(projectRoot, {
      actionId: 'fix_validation_issues',
      label: 'Fix validation issues',
      trigger: 'hook',
    })
  );

  assert.equal(result.status, 'pass');
  assert.equal(result.trigger, 'hook');
  assert.equal(agentCalls.length, 1);
  assert.equal(agentCalls[0].workflow.preflight.checkStatus, 'fail');
  assert.ok(agentCalls[0].workflow.preflight.failureCount > 0);
  assert.match(agentCalls[0].workflow.prompt, /Current validation failures:/);
});

test('visual review workflow exports a review-scoped PDF without recording canonical artifacts before invoking the agent adapter', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3, copyFramework: false });
  fillBrief(projectRoot);
  fillOutline(projectRoot);

  const calls = [];
  const workflowService = createActionWorkflowService({
    exportPdf: async (target, outputFile, options = {}) => {
      calls.push(['exportPdf', target.projectRootAbs, outputFile, options.recordArtifacts]);
      return { outputPath: outputFile };
    },
    agentAdapter: {
      async getAvailability(actionId) {
        calls.push(['availability', actionId]);
        return { available: true };
      },
      async invoke(actionId, context) {
        calls.push(['agent', actionId, context.workflow.outputPath]);
        return {
          status: 'started',
          message: 'Visual review started in the agent terminal.',
          outputPath: context.workflow.outputPath,
        };
      },
    },
  });

  const result = await workflowService.invokeAction(
    'review_visual_presentation',
    createWorkflowContext(projectRoot, {
      actionId: 'review_visual_presentation',
      label: 'Review visuals',
    })
  );

  assert.equal(result.status, 'started');
  assert.equal(result.outputPath, resolve(projectRoot, '.presentation', 'runtime', 'reviews', 'visual', 'visual-review-issues.json'));
  assert.deepEqual(calls[0], ['availability', 'review_visual_presentation']);
  assert.deepEqual(calls[1], ['exportPdf', projectRoot, getReviewPdfPath(projectRoot, 'visual'), false]);
  assert.deepEqual(calls[2], ['agent', 'review_visual_presentation', resolve(projectRoot, '.presentation', 'runtime', 'reviews', 'visual', 'visual-review-issues.json')]);
});

test('narrative review workflow exports a review-scoped PDF without recording canonical artifacts before invoking the agent adapter', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3, copyFramework: false });
  fillBrief(projectRoot);
  fillOutline(projectRoot);

  const calls = [];
  const workflowService = createActionWorkflowService({
    exportPdf: async (target, outputFile, options = {}) => {
      calls.push(['exportPdf', target.projectRootAbs, outputFile, options.recordArtifacts]);
      return { outputPath: outputFile };
    },
    agentAdapter: {
      async getAvailability(actionId) {
        calls.push(['availability', actionId]);
        return { available: true };
      },
      async invoke(actionId, context) {
        calls.push(['agent', actionId, context.workflow.outputPath]);
        return {
          status: 'started',
          message: 'Narrative review started in the agent terminal.',
          outputPath: context.workflow.outputPath,
        };
      },
    },
  });

  const result = await workflowService.invokeAction(
    'review_narrative_presentation',
    createWorkflowContext(projectRoot, {
      actionId: 'review_narrative_presentation',
      label: 'Review narrative',
    })
  );

  assert.equal(result.status, 'started');
  assert.equal(result.outputPath, resolve(projectRoot, '.presentation', 'runtime', 'reviews', 'narrative', 'narrative-review-issues.json'));
  assert.deepEqual(calls[0], ['availability', 'review_narrative_presentation']);
  assert.deepEqual(calls[1], ['exportPdf', projectRoot, getReviewPdfPath(projectRoot, 'narrative'), false]);
  assert.deepEqual(calls[2], ['agent', 'review_narrative_presentation', resolve(projectRoot, '.presentation', 'runtime', 'reviews', 'narrative', 'narrative-review-issues.json')]);
});

test('narrative review workflow blocks when brief.md is missing', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3, copyFramework: false });
  unlinkSync(resolve(projectRoot, 'brief.md'));
  fillOutline(projectRoot);

  const workflowService = createActionWorkflowService({
    exportPdf: async () => {
      throw new Error('export should not run');
    },
    agentAdapter: {
      async getAvailability() {
        return { available: true };
      },
      async invoke() {
        throw new Error('agent should not run');
      },
    },
  });

  const result = await workflowService.invokeAction(
    'review_narrative_presentation',
    createWorkflowContext(projectRoot, {
      actionId: 'review_narrative_presentation',
      label: 'Review narrative',
    })
  );

  assert.equal(result.status, 'blocked');
  assert.match(result.message, /brief\.md/i);
});

test('visual review workflow blocks when outline.md is missing', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3, copyFramework: false });
  fillBrief(projectRoot);

  const workflowService = createActionWorkflowService({
    exportPdf: async () => {
      throw new Error('export should not run');
    },
    agentAdapter: {
      async getAvailability() {
        return { available: true };
      },
      async invoke() {
        throw new Error('agent should not run');
      },
    },
  });

  const result = await workflowService.invokeAction(
    'review_visual_presentation',
    createWorkflowContext(projectRoot, {
      actionId: 'review_visual_presentation',
      label: 'Review visuals',
    })
  );

  assert.equal(result.status, 'blocked');
  assert.match(result.message, /outline\.md/i);
});

test('visual review workflow blocks when the reviewer bank is incomplete', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  const fakeFrameworkRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));
  t.after(() => rmSync(fakeFrameworkRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3, copyFramework: false });
  fillBrief(projectRoot);
  fillOutline(projectRoot);

  const workflowService = createActionWorkflowService({
    exportPdf: async () => {
      throw new Error('export should not run');
    },
    agentAdapter: {
      async getAvailability() {
        return { available: true };
      },
      async invoke() {
        throw new Error('agent should not run');
      },
    },
  });

  const result = await workflowService.invokeAction(
    'review_visual_presentation',
    createWorkflowContext(projectRoot, {
      actionId: 'review_visual_presentation',
      label: 'Review visuals',
      frameworkRoot: fakeFrameworkRoot,
    })
  );

  assert.equal(result.status, 'blocked');
  assert.match(result.message, /reviewer bank/i);
});

test('apply visual review workflow blocks when the canonical review JSON is missing or invalid', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3, copyFramework: false });
  fillBrief(projectRoot);
  fillOutline(projectRoot);

  const workflowService = createActionWorkflowService({
    agentAdapter: {
      async getAvailability() {
        return { available: true };
      },
      async invoke() {
        throw new Error('agent should not run');
      },
    },
  });

  const missingResult = await workflowService.invokeAction(
    'apply_visual_review_changes',
    createWorkflowContext(projectRoot, {
      actionId: 'apply_visual_review_changes',
      label: 'Apply visual fixes',
    })
  );
  assert.equal(missingResult.status, 'blocked');
  assert.match(missingResult.message, /visual-review-issues\.json/i);

  const reviewDir = resolve(projectRoot, '.presentation', 'runtime', 'reviews', 'visual');
  mkdirSync(reviewDir, { recursive: true });
  writeFileSync(resolve(reviewDir, 'visual-review-issues.json'), '{not-valid-json');

  const invalidResult = await workflowService.invokeAction(
    'apply_visual_review_changes',
    createWorkflowContext(projectRoot, {
      actionId: 'apply_visual_review_changes',
      label: 'Apply visual fixes',
    })
  );
  assert.equal(invalidResult.status, 'blocked');
  assert.match(invalidResult.message, /invalid/i);
});

test('apply visual review workflow uses the canonical review JSON path as the full implementation brief and returns started', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3, copyFramework: false });
  fillBrief(projectRoot);
  fillOutline(projectRoot);

  const reviewDir = resolve(projectRoot, '.presentation', 'runtime', 'reviews', 'visual');
  mkdirSync(reviewDir, { recursive: true });
  writeFileSync(
    resolve(reviewDir, 'visual-review-issues.json'),
    JSON.stringify({
      kind: 'visual-review-issues',
      reviewedAt: '2026-03-22T00:00:00Z',
      reviewersUsed: ['theme-reviewer'],
      overallJudgment: 'Needs work.',
      issues: [
        {
          id: 'VR-001',
          issue: 'Typography hierarchy is weak.',
          fix: 'Strengthen heading contrast.',
        },
      ],
    }, null, 2)
  );

  const agentCalls = [];
  const workflowService = createActionWorkflowService({
    agentAdapter: {
      async getAvailability() {
        return { available: true };
      },
      async invoke(actionId, context) {
        agentCalls.push({ actionId, workflow: context.workflow });
        return {
          status: 'started',
          message: 'Applying visual review changes in the agent terminal.',
        };
      },
    },
  });

  const result = await workflowService.invokeAction(
    'apply_visual_review_changes',
    createWorkflowContext(projectRoot, {
      actionId: 'apply_visual_review_changes',
      label: 'Apply visual fixes',
    })
  );

  assert.equal(result.status, 'started');
  assert.equal(agentCalls.length, 1);
  assert.equal(agentCalls[0].actionId, 'apply_visual_review_changes');
  assert.equal(agentCalls[0].workflow.reviewIssuesPath, resolve(projectRoot, '.presentation', 'runtime', 'reviews', 'visual', 'visual-review-issues.json'));
  assert.match(agentCalls[0].workflow.prompt, /single execution brief/i);
});

test('apply narrative review workflow uses the canonical review JSON path as the full implementation brief and returns started', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 3, copyFramework: false });
  fillBrief(projectRoot);
  fillOutline(projectRoot);

  const reviewDir = resolve(projectRoot, '.presentation', 'runtime', 'reviews', 'narrative');
  mkdirSync(reviewDir, { recursive: true });
  writeFileSync(
    resolve(reviewDir, 'narrative-review-issues.json'),
    JSON.stringify({
      kind: 'narrative-review-issues',
      reviewedAt: '2026-03-22T00:00:00Z',
      reviewersUsed: ['message-reviewer'],
      overallJudgment: 'Message is muddy.',
      issues: [
        {
          id: 'NR-001',
          issue: 'The core thesis is not obvious in the opening.',
          fix: 'State the central takeaway more directly in the first two slides.',
        },
      ],
    }, null, 2)
  );

  const agentCalls = [];
  const workflowService = createActionWorkflowService({
    agentAdapter: {
      async getAvailability() {
        return { available: true };
      },
      async invoke(actionId, context) {
        agentCalls.push({ actionId, workflow: context.workflow });
        return {
          status: 'started',
          message: 'Applying narrative review changes in the agent terminal.',
        };
      },
    },
  });

  const result = await workflowService.invokeAction(
    'apply_narrative_review_changes',
    createWorkflowContext(projectRoot, {
      actionId: 'apply_narrative_review_changes',
      label: 'Apply narrative fixes',
    })
  );

  assert.equal(result.status, 'started');
  assert.equal(agentCalls.length, 1);
  assert.equal(agentCalls[0].actionId, 'apply_narrative_review_changes');
  assert.equal(agentCalls[0].workflow.reviewIssuesPath, resolve(projectRoot, '.presentation', 'runtime', 'reviews', 'narrative', 'narrative-review-issues.json'));
  assert.match(agentCalls[0].workflow.prompt, /single execution brief/i);
});
