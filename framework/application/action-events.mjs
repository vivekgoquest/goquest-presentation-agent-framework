export const ACTION_LIFECYCLE_STATUSES = Object.freeze({
  QUEUED: 'queued',
  RUNNING: 'running',
  NEEDS_INPUT: 'needs_input',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
});

export const ACTION_EVENT_CHANNELS = Object.freeze({
  QUEUED: 'action/queued',
  RUNNING: 'action/running',
  NEEDS_INPUT: 'action/needs_input',
  SUCCEEDED: 'action/succeeded',
  FAILED: 'action/failed',
});

function resolveActionEventChannel(status) {
  switch (status) {
    case ACTION_LIFECYCLE_STATUSES.QUEUED:
      return ACTION_EVENT_CHANNELS.QUEUED;
    case ACTION_LIFECYCLE_STATUSES.RUNNING:
      return ACTION_EVENT_CHANNELS.RUNNING;
    case ACTION_LIFECYCLE_STATUSES.NEEDS_INPUT:
      return ACTION_EVENT_CHANNELS.NEEDS_INPUT;
    case ACTION_LIFECYCLE_STATUSES.SUCCEEDED:
      return ACTION_EVENT_CHANNELS.SUCCEEDED;
    case ACTION_LIFECYCLE_STATUSES.FAILED:
      return ACTION_EVENT_CHANNELS.FAILED;
    default:
      throw new Error(`Unsupported action lifecycle status "${status}".`);
  }
}

export function mapResultStatusToLifecycleStatus(status = '') {
  switch (status) {
    case 'needs-review':
      return ACTION_LIFECYCLE_STATUSES.NEEDS_INPUT;
    case 'fail':
      return ACTION_LIFECYCLE_STATUSES.FAILED;
    default:
      return ACTION_LIFECYCLE_STATUSES.SUCCEEDED;
  }
}

export function createActionLifecycleEvent({
  runId,
  actionId,
  status,
  message = '',
  detail = '',
  terminalVisibleTrace = '',
} = {}) {
  return {
    channel: resolveActionEventChannel(status),
    runId: String(runId || ''),
    actionId: String(actionId || ''),
    status,
    message: String(message || ''),
    detail: String(detail || ''),
    terminalVisibleTrace: String(terminalVisibleTrace || ''),
  };
}
