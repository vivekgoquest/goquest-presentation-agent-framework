import test from 'node:test';
import assert from 'node:assert/strict';

import { createActionService } from '../action-service.mjs';

function createProjectService(status = 'onboarding') {
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
        projectRoot: '/tmp/project',
        title: 'Sample Project',
      };
    },
    requireActiveProjectTarget() {
      return {
        kind: 'project',
        projectRootAbs: '/tmp/project',
      };
    },
    getOutputPaths() {
      return {
        outputDirAbs: '/tmp/project/outputs',
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
  const review = actions.find((action) => action.id === 'review_presentation');

  assert(build);
  assert.equal(build.kind, 'presentation');
  assert.equal(build.enabled, false);
  assert.match(build.reasonDisabled || '', /presentation is still in progress/i);

  assert(review);
  assert.equal(review.kind, 'agent');
  assert.equal(review.enabled, true);
});

test('action service routes presentation and agent actions to separate adapters and writes a visible trace for agent actions', async () => {
  const calls = [];
  const terminalMessages = [];
  const events = [];

  const actionService = createActionService({
    projectService: createProjectService('ready_to_finalize'),
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

  assert.deepEqual(calls[0], ['presentation', 'build_presentation', '/tmp/project']);
  assert.deepEqual(calls[1], ['terminal.start', 'shell']);
  assert.deepEqual(calls[2], ['agent', 'review_presentation', '/tmp/project']);
  assert.match(terminalMessages[0] || '', /running review/i);
  assert(events.some((event) => event.status === 'running' && event.actionId === 'review_presentation'));
  assert(events.some((event) => event.status === 'succeeded' && event.actionId === 'build_presentation'));
});
