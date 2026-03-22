import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createActionService } from '../action-service.mjs';

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
  const build = actions.find((action) => action.id === 'build_presentation');
  const exportAction = actions.find((action) => action.id === 'export_presentation');
  const review = actions.find((action) => action.id === 'review_presentation');

  assert(build);
  assert.equal(build.kind, 'presentation');
  assert.equal(build.enabled, false);
  assert.match(build.reasonDisabled || '', /presentation is still in progress/i);

  assert(exportAction);
  assert.equal(exportAction.kind, 'presentation');
  assert.equal(exportAction.enabled, false);

  assert(review);
  assert.equal(review.kind, 'agent');
  assert.equal(review.enabled, true);
});

test('action service routes presentation and agent actions to separate adapters while agent launcher owns terminal trace output', async () => {
  const [{ createProjectScaffold }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
  ]);

  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-action-service-'));
  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  writeFileSync(resolve(projectRoot, 'brief.md'), '# Ready brief\n');

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

  await actionService.invokeAction('build_presentation');
  await actionService.invokeAction('review_presentation');

  rmSync(projectRoot, { recursive: true, force: true });

  assert.deepEqual(calls[0], ['presentation', 'build_presentation', projectRoot]);
  assert.deepEqual(calls[1], ['terminal.start', 'shell']);
  assert.deepEqual(calls[2], ['agent', 'review_presentation', projectRoot]);
  assert.match(terminalMessages[0] || '', /running review/i);
  assert(events.some((event) => event.status === 'running' && event.actionId === 'review_presentation'));
  assert(events.some((event) => event.status === 'succeeded' && event.actionId === 'build_presentation'));
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

  const result = await actionService.invokeAction('review_presentation');

  assert.deepEqual(workflowCalls, [{
    actionId: 'review_presentation',
    trigger: 'electron',
    projectRoot: '/tmp/project',
  }]);
  assert.equal(result.actionId, 'review_presentation');
  assert.equal(result.workflowId, 'test-workflow');
});
