import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

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

function createWorkflowContext(projectRoot, overrides = {}) {
  return {
    action: {
      id: overrides.actionId || 'review_presentation',
      label: overrides.label || 'Review presentation',
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
  const { listActionWorkflowDefinitions } = await import('../action-workflow-service.mjs');

  const definitions = listActionWorkflowDefinitions();
  assert.deepEqual(
    definitions.map((definition) => definition.actionId),
    [
      'build_presentation',
      'export_presentation',
      'check_presentation',
      'capture_screenshots',
      'review_presentation',
      'revise_presentation',
      'fix_warnings',
    ]
  );

  const review = definitions.find((definition) => definition.actionId === 'review_presentation');
  assert.equal(review.workflowId, 'presentation-review');
  assert.deepEqual(review.allowedTriggers, ['electron', 'hook', 'agent', 'cli']);

  const fixWarnings = definitions.find((definition) => definition.actionId === 'fix_warnings');
  assert.equal(fixWarnings.workflowId, 'presentation-fix-warnings');
});

test('review workflow prepares canonical project truth before invoking the agent adapter', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-workflow-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const terminalStarts = [];
  const agentCalls = [];
  const workflowService = createActionWorkflowService({
    presentationAdapter: { invoke: async () => ({ status: 'pass', message: 'noop' }) },
    agentAdapter: {
      async invoke(actionId, context) {
        agentCalls.push({ actionId, workflow: context.workflow });
        return { status: 'pass', message: 'Reviewed.' };
      },
    },
  });

  const result = await workflowService.invokeAction(
    'review_presentation',
    createWorkflowContext(projectRoot, {
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
  assert.equal(result.actionId, 'review_presentation');
  assert.equal(result.workflowId, 'presentation-review');
  assert.equal(result.trigger, 'electron');
  assert.deepEqual(terminalStarts, ['shell']);
  assert.equal(agentCalls.length, 1);
  assert.equal(agentCalls[0].actionId, 'review_presentation');
  assert.equal(agentCalls[0].workflow.workflowId, 'presentation-review');
  assert.match(agentCalls[0].workflow.prompt, /package\.generated\.json/);
  assert.match(agentCalls[0].workflow.prompt, /render-state\.json/);
  assert.match(agentCalls[0].workflow.prompt, /artifacts\.json/);
  assert.match(agentCalls[0].workflow.prompt, /last-good\.json/);
});

test('fix warnings workflow skips agent execution when the refreshed check has no warnings', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-workflow-service.mjs'),
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
    'fix_warnings',
    createWorkflowContext(projectRoot, {
      actionId: 'fix_warnings',
      label: 'Fix warnings',
    })
  );

  assert.equal(agentCalls, 0);
  assert.equal(result.status, 'skip');
  assert.match(result.message, /no quality warnings/i);
  assert.equal(result.workflowId, 'presentation-fix-warnings');
});

test('fix warnings workflow refreshes warnings before invoking the agent adapter', async (t) => {
  const [{ createProjectScaffold }, { createActionWorkflowService }] = await Promise.all([
    import('../project-scaffold-service.mjs'),
    import('../action-workflow-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createProjectScaffold({ projectRoot }, { slideCount: 5, copyFramework: false });
  fillBrief(projectRoot);

  for (const slideDir of ['010-intro', '020-slide-02', '030-slide-03', '040-slide-04', '050-close']) {
    writeFileSync(
      resolve(projectRoot, 'slides', slideDir, 'slide.html'),
      createQualityWarningSlideHtml(`Repeated layout ${slideDir}`)
    );
  }

  const agentCalls = [];
  const workflowService = createActionWorkflowService({
    presentationAdapter: { invoke: async () => ({ status: 'pass', message: 'noop' }) },
    agentAdapter: {
      async invoke(actionId, context) {
        agentCalls.push({ actionId, workflow: context.workflow });
        return { status: 'pass', message: 'Fixed warnings.' };
      },
    },
  });

  const result = await workflowService.invokeAction(
    'fix_warnings',
    createWorkflowContext(projectRoot, {
      actionId: 'fix_warnings',
      label: 'Fix warnings',
      trigger: 'hook',
    })
  );

  assert.equal(result.status, 'pass');
  assert.equal(result.trigger, 'hook');
  assert.equal(agentCalls.length, 1);
  assert.equal(agentCalls[0].workflow.preflight.checkStatus, 'needs-review');
  assert.ok(agentCalls[0].workflow.preflight.warningCount > 0);
  assert.match(agentCalls[0].workflow.prompt, /Current quality warnings:/);
});
