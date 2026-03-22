import { randomUUID } from 'node:crypto';
import { getActionDefinition, listActionDefinitions } from './action-catalog.mjs';
import {
  ACTION_LIFECYCLE_STATUSES,
  createActionLifecycleEvent,
  mapResultStatusToLifecycleStatus,
} from './action-events.mjs';

const READY_PROJECT_STATUSES = new Set(['ready_to_finalize', 'finalized']);

function resolveBaseDisableReason(meta) {
  if (!meta?.active) {
    return 'Open a presentation first.';
  }

  return '';
}

function resolveReadinessDisableReason(projectState) {
  const status = projectState?.status || '';
  if (READY_PROJECT_STATUSES.has(status)) {
    return '';
  }

  return 'Presentation is still in progress. Complete the brief, slides, and policy fixes before building.';
}

function cloneActionDescriptor(action, overrides = {}) {
  return {
    id: action.id,
    label: action.label,
    surface: action.surface,
    enabled: overrides.enabled ?? true,
    reasonDisabled: overrides.reasonDisabled || '',
    kind: action.kind,
  };
}

async function resolveActionAvailability(action, {
  meta,
  projectState,
  agentAdapter,
}) {
  const baseReason = resolveBaseDisableReason(meta);

  if (action.kind === 'presentation') {
    if (!meta?.active) {
      return cloneActionDescriptor(action, {
        enabled: false,
        reasonDisabled: baseReason,
      });
    }

    if (action.id === 'build_presentation' || action.id === 'export_presentation') {
      const reason = resolveReadinessDisableReason(projectState);
      return cloneActionDescriptor(action, {
        enabled: !reason,
        reasonDisabled: reason,
      });
    }

    return cloneActionDescriptor(action, {
      enabled: true,
    });
  }

  if (!meta?.active) {
    return cloneActionDescriptor(action, {
      enabled: false,
      reasonDisabled: baseReason,
    });
  }

  const availability = typeof agentAdapter?.getAvailability === 'function'
    ? await agentAdapter.getAvailability(action.id)
    : { available: true };

  return cloneActionDescriptor(action, {
    enabled: Boolean(availability?.available),
    reasonDisabled: availability?.available ? '' : (availability?.reason || 'This action is unavailable right now.'),
  });
}

function createActionContext({ action, args, projectService, frameworkRoot, terminalService }) {
  const meta = projectService.getMeta();
  const projectState = projectService.getState();

  return {
    action,
    args,
    meta,
    projectState,
    target: meta?.active ? projectService.requireActiveProjectTarget() : null,
    outputPaths: meta?.active && typeof projectService.getOutputPaths === 'function'
      ? projectService.getOutputPaths()
      : null,
    frameworkRoot,
    terminalService,
  };
}

function normalizeActionResult(action, result = {}, runId) {
  return {
    runId,
    actionId: action.id,
    status: result.status || 'pass',
    message: result.message || `${action.label} completed.`,
    detail: result.detail || '',
    ...result,
  };
}

export function createActionService(options = {}) {
  const projectService = options.projectService;
  const terminalService = options.terminalService;
  const presentationAdapter = options.presentationAdapter;
  const agentAdapter = options.agentAdapter;
  const frameworkRoot = options.frameworkRoot || process.cwd();
  const emitEvent = typeof options.emitEvent === 'function'
    ? options.emitEvent
    : () => {};

  async function emitLifecycle(event) {
    emitEvent(createActionLifecycleEvent(event));
  }

  return {
    async listActions() {
      const meta = projectService.getMeta();
      const projectState = projectService.getState();
      const actions = listActionDefinitions();

      return await Promise.all(actions.map((action) => resolveActionAvailability(action, {
        meta,
        projectState,
        agentAdapter,
      })));
    },

    async invokeAction(actionId, args = {}) {
      const action = getActionDefinition(actionId);
      if (!action) {
        throw new Error(`Unsupported action "${actionId}".`);
      }

      const actions = await this.listActions();
      const resolved = actions.find((entry) => entry.id === actionId);
      if (!resolved?.enabled) {
        throw new Error(resolved?.reasonDisabled || `${action.label} is unavailable.`);
      }

      const runId = randomUUID();
      const context = createActionContext({
        action,
        args,
        projectService,
        frameworkRoot,
        terminalService,
      });

      await emitLifecycle({
        runId,
        actionId,
        status: ACTION_LIFECYCLE_STATUSES.QUEUED,
        message: `${action.label} queued.`,
      });

      await emitLifecycle({
        runId,
        actionId,
        status: ACTION_LIFECYCLE_STATUSES.RUNNING,
        message: `${action.label} running...`,
      });

      try {
        let result;

        if (action.kind === 'presentation') {
          result = await presentationAdapter.invoke(actionId, context);
        } else {
          const terminalMeta = typeof terminalService?.getMeta === 'function'
            ? terminalService.getMeta()
            : { alive: false };
          if (!terminalMeta?.alive || terminalMeta.mode !== 'shell') {
            terminalService?.start?.('shell');
          }
          result = await agentAdapter.invoke(actionId, context);
        }

        const normalized = normalizeActionResult(action, result, runId);
        await emitLifecycle({
          runId,
          actionId,
          status: mapResultStatusToLifecycleStatus(normalized.status),
          message: normalized.message,
          detail: normalized.detail,
        });
        return normalized;
      } catch (error) {
        await emitLifecycle({
          runId,
          actionId,
          status: ACTION_LIFECYCLE_STATUSES.FAILED,
          message: `${action.label} failed.`,
          detail: error?.message || '',
        });
        throw error;
      }
    },
  };
}
