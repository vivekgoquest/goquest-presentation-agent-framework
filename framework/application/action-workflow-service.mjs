import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { getActionDefinition, listActionDefinitions } from './action-catalog.mjs';
import { listSlideSourceEntries } from '../runtime/deck-source.js';
import {
  ensurePresentationPackageFiles,
} from '../runtime/presentation-package.js';
import {
  readPresentationIntent,
  validatePresentationIntent,
} from '../runtime/presentation-intent.js';
import {
  readArtifacts,
  readLastGood,
  readRenderState,
} from '../runtime/presentation-runtime-state.js';
import { runDeckCheck } from '../runtime/services/check-service.mjs';

const DEFAULT_ALLOWED_TRIGGERS = Object.freeze(['electron', 'hook', 'agent', 'cli']);
const ACTION_WORKFLOW_METADATA = Object.freeze({
  build_presentation: {
    workflowId: 'presentation-build',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'writes-runtime-and-output-artifacts',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  export_presentation: {
    workflowId: 'presentation-export',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'writes-export-artifacts',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  check_presentation: {
    workflowId: 'presentation-check',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'refreshes-runtime-evidence',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  capture_screenshots: {
    workflowId: 'presentation-capture',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'writes-capture-output',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  review_presentation: {
    workflowId: 'presentation-review',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'agent-execution-only',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  revise_presentation: {
    workflowId: 'presentation-revise',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'agent-execution-only',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  fix_warnings: {
    workflowId: 'presentation-fix-warnings',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'refreshes-check-state-before-agent-execution',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
});

function getWorkflowDefinition(actionId) {
  const action = getActionDefinition(actionId);
  const metadata = ACTION_WORKFLOW_METADATA[actionId];

  if (!action || !metadata) {
    throw new Error(`Unsupported action workflow "${actionId}".`);
  }

  return {
    actionId: action.id,
    kind: action.kind,
    workflowId: metadata.workflowId,
    allowedTriggers: [...metadata.allowedTriggers],
    sideEffectPolicy: metadata.sideEffectPolicy,
    lifecycleEventPolicy: metadata.lifecycleEventPolicy,
  };
}

export function listActionWorkflowDefinitions() {
  return listActionDefinitions().map((action) => getWorkflowDefinition(action.id));
}

function ensureAllowedTrigger(definition, trigger) {
  if (!definition.allowedTriggers.includes(trigger)) {
    throw new Error(`Action "${definition.actionId}" does not support trigger "${trigger}".`);
  }
}

function ensureShellTerminal(terminalService) {
  const terminalMeta = typeof terminalService?.getMeta === 'function'
    ? terminalService.getMeta()
    : { alive: false };

  if (!terminalMeta?.alive || terminalMeta.mode !== 'shell') {
    terminalService?.start?.('shell');
  }
}

function normalizeWorkflowResult(definition, trigger, result = {}) {
  return {
    actionId: definition.actionId,
    workflowId: definition.workflowId,
    trigger,
    status: result.status || 'pass',
    message: result.message || `${definition.actionId} completed.`,
    detail: result.detail || '',
    ...result,
    actionId: definition.actionId,
    workflowId: definition.workflowId,
    trigger,
  };
}

function createBaseWorkflowContext(definition, context = {}) {
  const trigger = context.trigger || 'electron';
  ensureAllowedTrigger(definition, trigger);
  return {
    definition,
    trigger,
    context,
  };
}

function buildProjectTruth(projectRoot) {
  const { paths, manifest } = ensurePresentationPackageFiles(projectRoot);
  const intent = readPresentationIntent(projectRoot);
  const intentIssues = validatePresentationIntent(intent, manifest);
  const renderState = readRenderState(projectRoot);
  const artifacts = readArtifacts(projectRoot);
  const lastGood = readLastGood(projectRoot);
  const slideEntries = listSlideSourceEntries(paths).filter((entry) => entry.isValidName);

  return {
    paths,
    manifest,
    intent,
    intentIssues,
    renderState,
    artifacts,
    lastGood,
    slideEntries,
  };
}

function buildProjectTruthPrompt(definition, truth, options = {}) {
  const { paths, manifest, renderState, artifacts, lastGood, slideEntries } = truth;
  const lines = [
    'Canonical workflow context prepared by the application layer.',
    `Action id: ${definition.actionId}`,
    `Workflow id: ${definition.workflowId}`,
    `Trigger: ${options.trigger || 'electron'}`,
    '',
    'Prepared project truth files:',
    `- ${paths.metadataRel}`,
    `- ${paths.packageManifestRel}`,
    `- ${paths.intentRel}`,
    `- ${paths.renderStateRel}`,
    `- ${paths.artifactsRel}`,
    `- ${paths.lastGoodRel}`,
    '',
    `Slides discovered: ${manifest.counts?.slidesTotal || 0}`,
    `Valid slide folders: ${slideEntries.map((entry) => entry.dirName).join(', ') || 'none'}`,
    `Current render status: ${renderState?.status || 'pending'}`,
    `Current quality warnings: ${Array.isArray(renderState?.qualityWarnings) ? renderState.qualityWarnings.length : 0}`,
    `Current PDF artifact: ${artifacts?.pdf?.path || 'none'}`,
    `Last good checkpoint: ${lastGood?.status || 'pending'}`,
  ];

  if (options.preflight) {
    lines.push(
      '',
      `Preflight check status: ${options.preflight.checkStatus}`,
      `Preflight warning count: ${options.preflight.warningCount}`,
      'Current quality warnings:'
    );

    if (options.preflight.warningCount > 0) {
      for (const warning of options.preflight.warnings) {
        lines.push(`- [${warning.rule}] ${warning.slideId}: ${warning.message}`);
        if (warning.fix) {
          lines.push(`  Fix: ${warning.fix}`);
        }
      }
    } else {
      lines.push('- none');
    }
  }

  return lines.join('\n');
}

function failForIntentIssues(definition, trigger, truth) {
  if (truth.intentIssues.length === 0) {
    return null;
  }

  return normalizeWorkflowResult(definition, trigger, {
    status: 'fail',
    message: 'Presentation intent is invalid.',
    detail: truth.intentIssues.join('\n'),
    evidence: {
      intentIssues: truth.intentIssues,
    },
  });
}

function createTransientCheckOutputDir() {
  return mkdtempSync(resolve(tmpdir(), 'pf-action-check-'));
}

async function runTransientDeckCheck(target) {
  const outputDir = createTransientCheckOutputDir();
  try {
    return await runDeckCheck(target, { outputDir });
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
}

async function invokePresentationWorkflow(definition, base, adapters) {
  const result = await adapters.presentationAdapter.invoke(definition.actionId, {
    ...base.context,
    workflow: {
      actionId: definition.actionId,
      workflowId: definition.workflowId,
      trigger: base.trigger,
    },
  });

  return normalizeWorkflowResult(definition, base.trigger, result);
}

async function invokeAgentWorkflow(definition, base, adapters, options = {}) {
  ensureShellTerminal(base.context.terminalService);

  const projectRoot = base.context.target?.projectRootAbs || base.context.meta?.projectRoot || '';
  if (!projectRoot) {
    return normalizeWorkflowResult(definition, base.trigger, {
      status: 'fail',
      message: 'No active presentation project is available.',
    });
  }

  let truth = buildProjectTruth(projectRoot);
  const intentFailure = failForIntentIssues(definition, base.trigger, truth);
  if (intentFailure) {
    return intentFailure;
  }

  const workflow = {
    actionId: definition.actionId,
    workflowId: definition.workflowId,
    trigger: base.trigger,
    projectTruth: {
      metadataPath: truth.paths.metadataRel,
      packagePath: truth.paths.packageManifestRel,
      intentPath: truth.paths.intentRel,
      renderStatePath: truth.paths.renderStateRel,
      artifactsPath: truth.paths.artifactsRel,
      lastGoodPath: truth.paths.lastGoodRel,
    },
    prompt: '',
  };

  if (options.includePreflightCheck) {
    const check = await runTransientDeckCheck(base.context.target);
    truth = buildProjectTruth(projectRoot);
    workflow.preflight = {
      checkStatus: check.status,
      warningCount: check.qualityWarnings.length,
      warnings: check.qualityWarnings,
      failures: check.failures,
    };

    if (check.status === 'fail') {
      return normalizeWorkflowResult(definition, base.trigger, {
        status: 'fail',
        message: 'Fix warnings cannot continue until presentation check issues are resolved.',
        detail: (check.failures || []).join('\n'),
        evidence: {
          check,
        },
      });
    }

    if (check.qualityWarnings.length === 0) {
      return normalizeWorkflowResult(definition, base.trigger, {
        status: 'skip',
        message: 'No quality warnings were found. Nothing to fix.',
        evidence: {
          check,
        },
      });
    }
  }

  workflow.prompt = buildProjectTruthPrompt(definition, truth, {
    trigger: base.trigger,
    preflight: workflow.preflight || null,
  });

  const result = await adapters.agentAdapter.invoke(definition.actionId, {
    ...base.context,
    workflow,
  });

  return normalizeWorkflowResult(definition, base.trigger, result);
}

export function createActionWorkflowService(options = {}) {
  const adapters = {
    presentationAdapter: options.presentationAdapter,
    agentAdapter: options.agentAdapter,
  };

  return {
    listDefinitions() {
      return listActionWorkflowDefinitions();
    },

    async invokeAction(actionId, context = {}) {
      const definition = getWorkflowDefinition(actionId);
      const base = createBaseWorkflowContext(definition, context);

      switch (actionId) {
        case 'review_presentation':
          return await invokeAgentWorkflow(definition, base, adapters);
        case 'revise_presentation':
          return await invokeAgentWorkflow(definition, base, adapters);
        case 'fix_warnings':
          return await invokeAgentWorkflow(definition, base, adapters, {
            includePreflightCheck: true,
          });
        case 'build_presentation':
        case 'export_presentation':
        case 'check_presentation':
        case 'capture_screenshots':
          return await invokePresentationWorkflow(definition, base, adapters);
        default:
          throw new Error(`Unsupported action workflow "${actionId}".`);
      }
    },
  };
}
