import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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
import { exportDeckPdf } from '../runtime/services/export-service.mjs';

const DEFAULT_ALLOWED_TRIGGERS = Object.freeze(['electron', 'hook', 'agent', 'cli']);
const VISUAL_REVIEWER_IDS = Object.freeze([
  'theme-reviewer',
  'layout-reviewer',
  'typography-reviewer',
  'density-reviewer',
  'consistency-reviewer',
  'media-reviewer',
  'polish-reviewer',
]);
const NARRATIVE_REVIEWER_IDS = Object.freeze([
  'message-reviewer',
  'audience-reviewer',
  'structure-reviewer',
  'clarity-reviewer',
  'evidence-reviewer',
  'objection-reviewer',
  'close-reviewer',
]);
const ACTION_WORKFLOW_METADATA = Object.freeze({
  export_presentation: {
    workflowId: 'presentation-export',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'writes-runtime-and-export-artifacts',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  validate_presentation: {
    workflowId: 'presentation-validate',
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
  fix_validation_issues: {
    workflowId: 'presentation-fix-validation-issues',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'refreshes-check-state-before-agent-execution',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  review_visual_presentation: {
    workflowId: 'presentation-visual-review',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'exports-pdf-then-starts-agent-review',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  apply_visual_review_changes: {
    workflowId: 'presentation-apply-visual-review',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'reads-visual-review-issues-then-starts-agent-apply',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  review_narrative_presentation: {
    workflowId: 'presentation-narrative-review',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'exports-pdf-then-starts-agent-review',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
  apply_narrative_review_changes: {
    workflowId: 'presentation-apply-narrative-review',
    allowedTriggers: DEFAULT_ALLOWED_TRIGGERS,
    sideEffectPolicy: 'reads-narrative-review-issues-then-starts-agent-apply',
    lifecycleEventPolicy: 'standard-action-lifecycle',
  },
});

const REVIEW_LANE_CONFIGS = Object.freeze({
  visual: {
    laneId: 'visual',
    reviewActionId: 'review_visual_presentation',
    applyActionId: 'apply_visual_review_changes',
    outputKind: 'visual-review-issues',
    outputFileName: 'visual-review-issues.json',
    outputDirName: 'visual',
    reviewerIds: VISUAL_REVIEWER_IDS,
    reviewLabel: 'Visual review',
    applyLabel: 'visual review',
    issueIdExample: 'VR-001',
    overallJudgmentExample: '<short visual judgment>',
    requiredProjectInputs: [
      { key: 'outlinePath', relPath: 'outline.md', label: 'Outline' },
    ],
    reviewIntro: [
      'This is a visual review only.',
      'Do not edit presentation source files.',
      'Do not change code.',
      'Do not implement fixes.',
      'Your job is to produce the visual review issue list only.',
    ],
    reviewerInputSummary: 'the fresh PDF, the outline, the shared review protocol, and its assigned reviewer file.',
    reviewRules: [
      '- Keep the file focused on non-narrative visual issues only.',
      '- Use artifact-space references only.',
      '- Do not use slide ids or file paths inside the issues.',
      '- Include target only when it helps locate the issue in the rendered deck.',
      '- Omit target for deck-wide issues.',
      '- Do not include code suggestions or implementation details.',
    ],
    applyTitle: 'This action implements the latest visual review fixes in the presentation source.',
    applyRules: [
      '- Treat the issue list as the complete set of requested visual changes for this run.',
      '- Focus only on non-narrative visual work.',
      '- You may inspect project files and runtime state as needed.',
      '- Map artifact-space references such as page number, visible title, outline label, and description into the correct project files and slide targets.',
      '- Do not rerun the visual review swarm.',
      '- Do not invent new review issues unless required to complete an existing fix cleanly.',
      '- Keep edits focused on visual execution: theme, design, layout, density, consistency, polish, media treatment, and structural visual changes.',
      '- Avoid narrative/content rewrites unless absolutely necessary to realize a structural visual fix.',
    ],
  },
  narrative: {
    laneId: 'narrative',
    reviewActionId: 'review_narrative_presentation',
    applyActionId: 'apply_narrative_review_changes',
    outputKind: 'narrative-review-issues',
    outputFileName: 'narrative-review-issues.json',
    outputDirName: 'narrative',
    reviewerIds: NARRATIVE_REVIEWER_IDS,
    reviewLabel: 'Narrative review',
    applyLabel: 'narrative review',
    issueIdExample: 'NR-001',
    overallJudgmentExample: '<short narrative judgment>',
    requiredProjectInputs: [
      { key: 'briefPath', relPath: 'brief.md', label: 'Brief' },
      { key: 'outlinePath', relPath: 'outline.md', label: 'Outline' },
    ],
    reviewIntro: [
      'This is a narrative review only.',
      'Do not edit presentation source files.',
      'Do not change code.',
      'Do not implement fixes.',
      'Your job is to produce the narrative review issue list only.',
    ],
    reviewerInputSummary: 'the fresh PDF, the brief, the outline, the shared review protocol, and its assigned reviewer file.',
    reviewRules: [
      '- Keep the file focused on narrative and message issues only.',
      '- Use artifact-space references only.',
      '- Do not use slide ids or file paths inside the issues.',
      '- Include target only when it helps locate the issue in the rendered deck.',
      '- Omit target for deck-wide issues.',
      '- Do not include code suggestions or implementation details.',
      '- Do not include non-narrative visual styling feedback.',
    ],
    applyTitle: 'This action implements the latest narrative review fixes in the presentation source.',
    applyRules: [
      '- Treat the issue list as the complete set of requested narrative changes for this run.',
      '- Focus only on narrative and message work.',
      '- You may inspect project files and runtime state as needed.',
      '- Map artifact-space references such as page number, visible title, outline label, and description into the correct project files and slide targets.',
      '- Do not rerun the narrative review swarm.',
      '- Do not invent new review issues unless required to complete an existing fix cleanly.',
      '- Keep edits focused on thesis clarity, audience fit, claim framing, evidence framing, sequencing, transitions, objection handling, and the close or ask.',
      '- Keep visual and layout changes minimal and only when needed to support revised narrative content.',
    ],
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
    `Current validation failures: ${Array.isArray(renderState?.failures) ? renderState.failures.length : 0}`,
    `Current PDF artifact: ${artifacts?.pdf?.path || 'none'}`,
    `Last good checkpoint: ${lastGood?.status || 'pending'}`,
  ];

  if (options.preflight) {
    lines.push(
      '',
      `Preflight check status: ${options.preflight.checkStatus}`,
      `Preflight failure count: ${options.preflight.failureCount}`,
      'Current validation failures:'
    );

    if (options.preflight.failureCount > 0) {
      for (const failure of options.preflight.failures) {
        lines.push(`- ${failure}`);
      }
    } else {
      lines.push('- none');
    }
  }

  return lines.join('\n');
}

function resolveReviewLanePaths(projectRoot, frameworkRoot, laneConfig) {
  const reviewBankRoot = resolve(frameworkRoot, 'framework', 'runtime', 'review', laneConfig.laneId);
  const reviewersRoot = resolve(reviewBankRoot, 'reviewers');
  return {
    briefPath: resolve(projectRoot, 'brief.md'),
    outlinePath: resolve(projectRoot, 'outline.md'),
    freshPdfPath: resolve(projectRoot, 'outputs', 'deck.pdf'),
    reviewBankRoot,
    sharedProtocolPath: resolve(reviewBankRoot, 'shared-protocol.md'),
    reviewerFilePaths: laneConfig.reviewerIds.map((reviewerId) => resolve(reviewersRoot, `${reviewerId}.md`)),
    reviewOutputDir: resolve(projectRoot, '.presentation', 'runtime', 'reviews', laneConfig.outputDirName),
    reviewOutputPath: resolve(projectRoot, '.presentation', 'runtime', 'reviews', laneConfig.outputDirName, laneConfig.outputFileName),
  };
}

function validateReviewerBank(paths) {
  if (!existsSync(paths.reviewBankRoot)) {
    return `Reviewer bank is missing: ${paths.reviewBankRoot}`;
  }

  if (!existsSync(paths.sharedProtocolPath)) {
    return `Reviewer bank is incomplete: missing ${paths.sharedProtocolPath}`;
  }

  for (const reviewerFilePath of paths.reviewerFilePaths) {
    if (!existsSync(reviewerFilePath)) {
      return `Reviewer bank is incomplete: missing ${reviewerFilePath}`;
    }
  }

  return '';
}

function validateRequiredReviewInputs(paths, laneConfig) {
  for (const input of laneConfig.requiredProjectInputs) {
    if (!existsSync(paths[input.key])) {
      return `${laneConfig.reviewLabel} requires ${input.relPath} before it can start: ${paths[input.key]}`;
    }
  }

  return '';
}

async function ensureAgentCapabilityAvailable(definition, base, adapters) {
  if (typeof adapters.agentAdapter?.getAvailability !== 'function') {
    return normalizeWorkflowResult(definition, base.trigger, {
      status: 'blocked',
      message: `${definition.actionId} cannot run because the agent capability is unavailable.`,
    });
  }

  const availability = await adapters.agentAdapter.getAvailability(definition.actionId, base.context);
  if (!availability?.available) {
    return normalizeWorkflowResult(definition, base.trigger, {
      status: 'blocked',
      message: availability?.reason || `${definition.actionId} cannot run because the agent capability is unavailable.`,
    });
  }

  return null;
}

function buildReviewPrompt(base, paths, laneConfig) {
  const projectRoot = base.context.target?.projectRootAbs || base.context.meta?.projectRoot || '';
  const reviewInputLines = laneConfig.requiredProjectInputs.map(
    (input) => `${input.label}: ${paths[input.key]}`
  );
  return [
    `You are executing the application action "${laneConfig.reviewActionId}".`,
    '',
    ...laneConfig.reviewIntro,
    '',
    `Project root: ${projectRoot}`,
    `Fresh exported PDF to review: ${paths.freshPdfPath}`,
    ...reviewInputLines,
    `Reviewer bank root: ${paths.reviewBankRoot}`,
    `Shared review protocol: ${paths.sharedProtocolPath}`,
    `Required output file: ${paths.reviewOutputPath}`,
    '',
    'Reviewer swarm requirements:',
    '- Use the full fixed reviewer bank for every run.',
    '- Spawn exactly one reviewer sub-agent for each reviewer file in the bank.',
    '- Run all reviewer sub-agents in parallel.',
    '- Do not skip reviewers.',
    '- Do not invent new reviewers.',
    `- Each reviewer sub-agent must receive only ${laneConfig.reviewerInputSummary}`,
    '- Reviewer sub-agents must not inspect project code or source files.',
    '',
    'Synthesis requirements:',
    '- Wait for all reviewer sub-agents to complete.',
    '- Synthesize their feedback into one canonical JSON file.',
    '- Overwrite the output file with the latest review result.',
    '',
    'The output file must be valid JSON with this shape:',
    '{',
    `  "kind": "${laneConfig.outputKind}",`,
    '  "reviewedAt": "<ISO timestamp>",',
    `  "reviewersUsed": ${JSON.stringify([...laneConfig.reviewerIds])},`,
    `  "overallJudgment": "${laneConfig.overallJudgmentExample}",`,
    '  "issues": [',
    '    {',
    `      "id": "${laneConfig.issueIdExample}",`,
    '      "issue": "<what is wrong>",',
    '      "fix": "<what should be fixed>",',
    '      "target": {',
    '        "pageNumber": 3,',
    '        "visibleTitle": "Market Context",',
    '        "outlineLabel": "Market Context",',
    '        "description": "optional human description"',
    '      }',
    '    }',
    '  ]',
    '}',
    '',
    'Rules for the issue list:',
    ...laneConfig.reviewRules,
    '',
    'Persist only the final JSON file at the required output path.',
    'Do not write any other durable review artifacts.',
    `When complete, report that the ${laneConfig.outputFileName} file was written.`,
  ].join('\n');
}

function validateReviewIssuesFile(reviewIssuesPath, laneConfig) {
  if (!existsSync(reviewIssuesPath)) {
    return {
      ok: false,
      reason: `${laneConfig.reviewLabel} issue file is missing: ${reviewIssuesPath}`,
    };
  }

  try {
    const raw = readFileSync(reviewIssuesPath, 'utf8');
    const parsed = JSON.parse(raw);
    const isValid = parsed
      && parsed.kind === laneConfig.outputKind
      && typeof parsed.reviewedAt === 'string'
      && Array.isArray(parsed.reviewersUsed)
      && typeof parsed.overallJudgment === 'string'
      && Array.isArray(parsed.issues);

    if (!isValid) {
      return {
        ok: false,
        reason: `${laneConfig.reviewLabel} issue file is invalid: ${reviewIssuesPath}`,
      };
    }

    return {
      ok: true,
      parsed,
    };
  } catch {
    return {
      ok: false,
      reason: `${laneConfig.reviewLabel} issue file is invalid JSON: ${reviewIssuesPath}`,
    };
  }
}

function buildApplyReviewPrompt(base, reviewIssuesPath, laneConfig) {
  const projectRoot = base.context.target?.projectRootAbs || base.context.meta?.projectRoot || '';
  return [
    `You are executing the application action "${laneConfig.applyActionId}".`,
    '',
    laneConfig.applyTitle,
    '',
    `Project root: ${projectRoot}`,
    `Canonical ${laneConfig.applyLabel} issue file: ${reviewIssuesPath}`,
    '',
    'This JSON file is the single execution brief.',
    'Read it in full and implement the fixes it describes.',
    '',
    'Execution rules:',
    ...laneConfig.applyRules,
    '',
    'Expected behavior:',
    '1. Read the issue file.',
    '2. Determine what needs to change in source.',
    '3. Implement the fixes.',
    '4. Run the normal deterministic validation flow after edits.',
    '5. Report what was changed and anything still unresolved.',
    '',
    `If the ${laneConfig.applyLabel} issue file is missing or invalid, fail clearly instead of guessing.`,
  ].join('\n');
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

async function runTransientValidation(base, adapters) {
  const outputDir = createTransientCheckOutputDir();
  try {
    return await adapters.presentationAdapter.invoke('validate_presentation', {
      ...base.context,
      args: {
        ...(base.context.args || {}),
        outputDir,
      },
      outputPaths: {
        ...(base.context.outputPaths || {}),
        outputDirAbs: outputDir,
      },
      workflow: {
        actionId: 'validate_presentation',
        workflowId: ACTION_WORKFLOW_METADATA.validate_presentation.workflowId,
        trigger: base.trigger,
      },
    });
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
    let check;
    try {
      check = await runTransientValidation(base, adapters);
    } catch (error) {
      check = {
        status: 'fail',
        failures: [error?.message || 'Presentation validation failed.'],
      };
    }
    truth = buildProjectTruth(projectRoot);
    workflow.preflight = {
      checkStatus: check.status,
      failureCount: Array.isArray(check.failures) ? check.failures.length : 0,
      failures: Array.isArray(check.failures) ? check.failures : [],
    };

    if ((workflow.preflight.failureCount || 0) === 0) {
      return normalizeWorkflowResult(definition, base.trigger, {
        status: 'skip',
        message: 'No validation failures were found. Nothing to fix.',
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

async function invokeReviewWorkflow(definition, base, adapters, laneConfig, options = {}) {
  const projectRoot = base.context.target?.projectRootAbs || base.context.meta?.projectRoot || '';
  if (!projectRoot) {
    return normalizeWorkflowResult(definition, base.trigger, {
      status: 'blocked',
      message: 'No active presentation project is available.',
    });
  }

  const reviewPaths = resolveReviewLanePaths(projectRoot, base.context.frameworkRoot || process.cwd(), laneConfig);
  const missingInputIssue = validateRequiredReviewInputs(reviewPaths, laneConfig);
  if (missingInputIssue) {
    return normalizeWorkflowResult(definition, base.trigger, {
      status: 'blocked',
      message: missingInputIssue,
      outputPath: reviewPaths.reviewOutputPath,
    });
  }

  const bankIssue = validateReviewerBank(reviewPaths);
  if (bankIssue) {
    return normalizeWorkflowResult(definition, base.trigger, {
      status: 'blocked',
      message: bankIssue,
      outputPath: reviewPaths.reviewOutputPath,
    });
  }

  const availabilityFailure = await ensureAgentCapabilityAvailable(definition, base, adapters);
  if (availabilityFailure) {
    return availabilityFailure;
  }

  try {
    mkdirSync(reviewPaths.reviewOutputDir, { recursive: true });
    await (options.exportPdf || exportDeckPdf)(base.context.target, reviewPaths.freshPdfPath);
  } catch (error) {
    return normalizeWorkflowResult(definition, base.trigger, {
      status: 'blocked',
      message: `${laneConfig.reviewLabel} could not export a fresh PDF: ${error?.message || 'Unknown export error.'}`,
      outputPath: reviewPaths.reviewOutputPath,
    });
  }

  ensureShellTerminal(base.context.terminalService);

  const workflow = {
    actionId: definition.actionId,
    workflowId: definition.workflowId,
    trigger: base.trigger,
    freshPdfPath: reviewPaths.freshPdfPath,
    briefPath: reviewPaths.briefPath,
    outlinePath: reviewPaths.outlinePath,
    reviewBankRoot: reviewPaths.reviewBankRoot,
    sharedProtocolPath: reviewPaths.sharedProtocolPath,
    outputPath: reviewPaths.reviewOutputPath,
    reviewersUsed: [...laneConfig.reviewerIds],
    prompt: buildReviewPrompt(base, reviewPaths, laneConfig),
  };

  const result = await adapters.agentAdapter.invoke(definition.actionId, {
    ...base.context,
    workflow,
  });

  return normalizeWorkflowResult(definition, base.trigger, {
    outputPath: reviewPaths.reviewOutputPath,
    ...result,
  });
}

async function invokeApplyReviewWorkflow(definition, base, adapters, laneConfig) {
  const projectRoot = base.context.target?.projectRootAbs || base.context.meta?.projectRoot || '';
  if (!projectRoot) {
    return normalizeWorkflowResult(definition, base.trigger, {
      status: 'blocked',
      message: 'No active presentation project is available.',
    });
  }

  const paths = resolveReviewLanePaths(projectRoot, base.context.frameworkRoot || process.cwd(), laneConfig);
  const reviewIssues = validateReviewIssuesFile(paths.reviewOutputPath, laneConfig);
  if (!reviewIssues.ok) {
    return normalizeWorkflowResult(definition, base.trigger, {
      status: 'blocked',
      message: reviewIssues.reason,
    });
  }

  const availabilityFailure = await ensureAgentCapabilityAvailable(definition, base, adapters);
  if (availabilityFailure) {
    return availabilityFailure;
  }

  ensureShellTerminal(base.context.terminalService);

  const workflow = {
    actionId: definition.actionId,
    workflowId: definition.workflowId,
    trigger: base.trigger,
    reviewIssuesPath: paths.reviewOutputPath,
    reviewIssues: reviewIssues.parsed,
    prompt: buildApplyReviewPrompt(base, paths.reviewOutputPath, laneConfig),
  };

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
  const exportPdf = options.exportPdf || exportDeckPdf;

  return {
    listDefinitions() {
      return listActionWorkflowDefinitions();
    },

    async invokeAction(actionId, context = {}) {
      const definition = getWorkflowDefinition(actionId);
      const base = createBaseWorkflowContext(definition, context);

      switch (actionId) {
        case 'fix_validation_issues':
          return await invokeAgentWorkflow(definition, base, adapters, {
            includePreflightCheck: true,
          });
        case 'review_visual_presentation':
          return await invokeReviewWorkflow(definition, base, adapters, REVIEW_LANE_CONFIGS.visual, {
            exportPdf,
          });
        case 'apply_visual_review_changes':
          return await invokeApplyReviewWorkflow(definition, base, adapters, REVIEW_LANE_CONFIGS.visual);
        case 'review_narrative_presentation':
          return await invokeReviewWorkflow(definition, base, adapters, REVIEW_LANE_CONFIGS.narrative, {
            exportPdf,
          });
        case 'apply_narrative_review_changes':
          return await invokeApplyReviewWorkflow(definition, base, adapters, REVIEW_LANE_CONFIGS.narrative);
        case 'export_presentation':
        case 'validate_presentation':
        case 'capture_screenshots':
          return await invokePresentationWorkflow(definition, base, adapters);
        default:
          throw new Error(`Unsupported action workflow "${actionId}".`);
      }
    },
  };
}
