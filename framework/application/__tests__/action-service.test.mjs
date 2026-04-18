import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createActionService } from '../action-service.mjs';

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
    '  <p class="body-text">This slide intentionally violates deterministic validation.</p>',
    '</div>',
    '',
  ].join('\n');
}

function createCaptureFailureSlideHtml() {
  const paragraphs = Array.from({ length: 80 }, (_value, index) =>
    `  <p class="body-text">Overflow line ${index + 1} for screenshot capture regression coverage.</p>`
  );
  return [
    '<div class="slide">',
    '  <div class="eyebrow">Capture Regression Deck</div>',
    '  <h2 class="sect-title">Overflow capture fixture</h2>',
    ...paragraphs,
    '</div>',
    '',
  ].join('\n');
}

function createProjectService(status = 'onboarding', projectRoot = '/tmp/project') {
  return {
    getState() {
      return {
        kind: 'project',
        status,
        briefComplete: status !== 'onboarding',
        outlineRequired: false,
        outlineComplete: true,
        slidesTotal: 3,
        slidesComplete: status === 'ready_to_finalize' ? 3 : 1,
        pdfReady: status === 'finalized',
        lastPolicyError: '',
        nextStep: '',
      };
    },
    getMeta() {
      return {
        active: true,
        projectRoot,
        title: 'Sample Project',
      };
    },
    requireActiveProjectTarget() {
      return {
        kind: 'project',
        projectRootAbs: projectRoot,
      };
    },
    getOutputPaths() {
      return {
        outputDirAbs: resolve(projectRoot, 'outputs'),
      };
    },
  };
}

test('action service lists stable product actions with enablement derived from project state', async () => {
  const actionService = createActionService({
    projectService: createProjectService('onboarding'),
    terminalService: {},
    presentationAdapter: { invoke: async () => ({}) },
    agentAdapter: { invoke: async () => ({}) },
    emitEvent: () => {},
  });

  const actions = await actionService.listActions();
  const exportAction = actions.find((action) => action.id === 'export_presentation');
  const exportArtifactsAction = actions.find((action) => action.id === 'export_presentation_artifacts');
  const validateAction = actions.find((action) => action.id === 'validate_presentation');
  const fixValidationIssues = actions.find((action) => action.id === 'fix_validation_issues');
  const narrativeReview = actions.find((action) => action.id === 'review_narrative_presentation');
  const applyNarrative = actions.find((action) => action.id === 'apply_narrative_review_changes');
  const visualReview = actions.find((action) => action.id === 'review_visual_presentation');
  const applyVisual = actions.find((action) => action.id === 'apply_visual_review_changes');

  assert(exportAction);
  assert.equal(exportAction.label, 'Export');
  assert.equal(exportAction.kind, 'presentation');
  assert.equal(exportAction.enabled, false);
  assert.match(exportAction.reasonDisabled || '', /presentation is still in progress/i);

  assert(exportArtifactsAction);
  assert.equal(exportArtifactsAction.label, 'Export files');
  assert.equal(exportArtifactsAction.kind, 'presentation');
  assert.equal(exportArtifactsAction.enabled, true);

  assert(validateAction);
  assert.equal(validateAction.label, 'Check project');
  assert.equal(validateAction.kind, 'presentation');
  assert.equal(validateAction.enabled, true);

  assert(fixValidationIssues);
  assert.equal(fixValidationIssues.label, 'Fix issues');
  assert.equal(fixValidationIssues.kind, 'agent');
  assert.equal(fixValidationIssues.enabled, true);

  assert(narrativeReview);
  assert.equal(narrativeReview.label, 'Review writing');
  assert.equal(narrativeReview.kind, 'agent');
  assert.equal(narrativeReview.enabled, true);

  assert(applyNarrative);
  assert.equal(applyNarrative.label, 'Apply writing fixes');
  assert.equal(applyNarrative.kind, 'agent');
  assert.equal(applyNarrative.enabled, true);

  assert(visualReview);
  assert.equal(visualReview.label, 'Review visuals');
  assert.equal(visualReview.kind, 'agent');
  assert.equal(visualReview.enabled, true);

  assert(applyVisual);
  assert.equal(applyVisual.label, 'Apply visual fixes');
  assert.equal(applyVisual.kind, 'agent');
  assert.equal(applyVisual.enabled, true);
});

test('action service keeps export enabled for stale finalized projects', async () => {
  const actionService = createActionService({
    projectService: {
      ...createProjectService('in_progress'),
      getState() {
        return {
          kind: 'project',
          status: 'in_progress',
          facets: {
            delivery: 'finalized_stale',
            evidence: 'current',
          },
          briefComplete: true,
          outlineRequired: false,
          outlineComplete: true,
          slidesTotal: 3,
          slidesComplete: 3,
          pdfReady: true,
          lastPolicyError: '',
          nextStep: 'Run presentation export again to refresh the canonical root PDF for the latest source.',
        };
      },
    },
    terminalService: {},
    presentationAdapter: { invoke: async () => ({}) },
    agentAdapter: { invoke: async () => ({}) },
    emitEvent: () => {},
  });

  const actions = await actionService.listActions();
  const exportAction = actions.find((action) => action.id === 'export_presentation');

  assert(exportAction);
  assert.equal(exportAction.enabled, true);
  assert.equal(exportAction.reasonDisabled, '');
});

test('action service routes presentation and deterministic-fix agent actions to separate adapters while agent launcher owns terminal trace output', async () => {
  const [{ createProjectScaffold }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
  ]);

  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-action-service-'));
  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  writeFileSync(resolve(projectRoot, 'brief.md'), '# Ready brief\n');
  writeFileSync(
    resolve(projectRoot, 'slides', '010-intro', 'slide.html'),
    createValidationFailureSlideHtml('Inline style violation')
  );

  const calls = [];
  const terminalMessages = [];
  const events = [];

  const actionService = createActionService({
    projectService: createProjectService('ready_to_finalize', projectRoot),
    terminalService: {
      getMeta() {
        return { alive: false, mode: null };
      },
      start(mode) {
        calls.push(['terminal.start', mode]);
        return { alive: true, mode };
      },
      writeSystemOutput(message) {
        terminalMessages.push(message);
      },
    },
    presentationAdapter: {
      async invoke(actionId, context) {
        calls.push(['presentation', actionId, context.target.projectRootAbs]);
        if (actionId === 'validate_presentation') {
          return {
            status: 'fail',
            failures: ['Inline style violation'],
            detail: 'Inline style violation',
          };
        }
        return { status: 'pass', message: 'Built.' };
      },
    },
    agentAdapter: {
      async invoke(actionId, context) {
        context.terminalService?.writeSystemOutput('Running review for this presentation...\r\n');
        calls.push(['agent', actionId, context.target.projectRootAbs]);
        return { status: 'pass', message: 'Reviewed.' };
      },
    },
    emitEvent(event) {
      events.push(event);
    },
  });

  await actionService.invokeAction('export_presentation');
  await actionService.invokeAction('export_presentation_artifacts', {
    format: 'png',
    outputDir: resolve(projectRoot, 'exports'),
    slideIds: ['010-intro'],
  });
  await actionService.invokeAction('fix_validation_issues');

  rmSync(projectRoot, { recursive: true, force: true });

  assert.deepEqual(calls[0], ['presentation', 'export_presentation', projectRoot]);
  assert.deepEqual(calls[1], ['presentation', 'export_presentation_artifacts', projectRoot]);
  assert.deepEqual(calls[2], ['terminal.start', 'shell']);
  assert.deepEqual(calls[3], ['presentation', 'validate_presentation', projectRoot]);
  assert.deepEqual(calls[4], ['agent', 'fix_validation_issues', projectRoot]);
  assert.match(terminalMessages[0] || '', /running review/i);
  assert(events.some((event) => event.status === 'running' && event.actionId === 'fix_validation_issues'));
  assert(events.some((event) => event.status === 'succeeded' && event.actionId === 'export_presentation'));
  assert(events.some((event) => event.status === 'succeeded' && event.actionId === 'export_presentation_artifacts'));
});

test('action service delegates execution through the canonical workflow service', async () => {
  const workflowCalls = [];
  const actionService = createActionService({
    projectService: createProjectService('ready_to_finalize'),
    terminalService: {},
    presentationAdapter: { invoke: async () => ({ status: 'pass', message: 'noop' }) },
    agentAdapter: { invoke: async () => ({ status: 'pass', message: 'noop' }) },
    workflowService: {
      async invokeAction(actionId, context) {
        workflowCalls.push({ actionId, trigger: context.trigger, projectRoot: context.target?.projectRootAbs });
        return {
          status: 'pass',
          message: 'Workflow completed.',
          workflowId: 'test-workflow',
        };
      },
    },
    emitEvent: () => {},
  });

  const result = await actionService.invokeAction('review_visual_presentation');

  assert.deepEqual(workflowCalls, [{
    actionId: 'review_visual_presentation',
    trigger: 'electron',
    projectRoot: '/tmp/project',
  }]);
  assert.equal(result.actionId, 'review_visual_presentation');
  assert.equal(result.workflowId, 'test-workflow');
});

test('presentation action adapter preserves failing screenshot capture status', async (t) => {
  const [{ createProjectScaffold }, { createPresentationActionAdapter }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../presentation-action-adapter.mjs'),
  ]);

  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-presentation-action-adapter-'));
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  writeFileSync(resolve(projectRoot, 'brief.md'), '# Capture test brief\n');
  writeFileSync(
    resolve(projectRoot, 'slides', '010-intro', 'slide.html'),
    createCaptureFailureSlideHtml()
  );

  const adapter = createPresentationActionAdapter();
  const result = await adapter.invoke('capture_screenshots', {
    target: {
      kind: 'project',
      projectRootAbs: projectRoot,
    },
    outputPaths: {
      outputDirAbs: resolve(projectRoot, 'outputs', 'capture-test'),
    },
  });

  assert.equal(result.status, 'fail');
});
