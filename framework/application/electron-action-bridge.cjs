const ACTION_EVENT_STATUS_BY_CHANNEL = Object.freeze({
  'action/queued': 'queued',
  'action/running': 'running',
  'action/needs_input': 'needs_input',
  'action/succeeded': 'succeeded',
  'action/failed': 'failed',
});

const BUILD_OPERATION_BY_ACTION_ID = Object.freeze({
  build_presentation: 'finalize',
  check_presentation: 'check',
  capture_screenshots: 'capture',
});

const REVIEW_OPERATION_BY_ACTION_ID = Object.freeze({
  review_presentation: 'run',
  revise_presentation: 'revise',
  fix_warnings: 'fix_warnings',
});

function isActionLifecycleEvent(event) {
  return typeof event?.channel === 'string' && event.channel.startsWith('action/');
}

function toActionLifecycleStatus(event) {
  return ACTION_EVENT_STATUS_BY_CHANNEL[event?.channel] || 'running';
}

function isBuildActionEvent(event) {
  return Object.prototype.hasOwnProperty.call(BUILD_OPERATION_BY_ACTION_ID, event?.actionId);
}

function isReviewActionEvent(event) {
  return Object.prototype.hasOwnProperty.call(REVIEW_OPERATION_BY_ACTION_ID, event?.actionId);
}

function toBuildEvent(event) {
  return {
    kind: 'build',
    operation: BUILD_OPERATION_BY_ACTION_ID[event.actionId] || 'finalize',
    status: toActionLifecycleStatus(event),
    message: event.message || '',
    detail: event.detail || '',
    runId: event.runId || '',
  };
}

function toExportEvent(event) {
  return {
    kind: 'export',
    status: toActionLifecycleStatus(event),
    message: event.message || '',
    detail: event.detail || '',
    runId: event.runId || '',
  };
}

function toReviewEvent(event) {
  return {
    kind: 'review',
    operation: REVIEW_OPERATION_BY_ACTION_ID[event.actionId] || 'run',
    status: toActionLifecycleStatus(event),
    message: event.message || '',
    detail: event.detail || '',
    runId: event.runId || '',
  };
}

module.exports = {
  isActionLifecycleEvent,
  isBuildActionEvent,
  isReviewActionEvent,
  toBuildEvent,
  toExportEvent,
  toReviewEvent,
};
