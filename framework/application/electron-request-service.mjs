import { WORKER_REQUEST_CHANNELS } from '../../electron/worker/ipc-contract.mjs';

const REVIEW_ACTION_IDS = Object.freeze({
  run: 'review_presentation',
  revise: 'revise_presentation',
  fixWarnings: 'fix_warnings',
});

function buildReviewAvailability(actions = []) {
  const actionMap = new Map(actions.map((action) => [action.id, action]));
  const reviewAction = actionMap.get(REVIEW_ACTION_IDS.run);
  const reviseAction = actionMap.get(REVIEW_ACTION_IDS.revise);
  const fixWarningsAction = actionMap.get(REVIEW_ACTION_IDS.fixWarnings);

  return {
    run: Boolean(reviewAction?.enabled),
    revise: Boolean(reviseAction?.enabled),
    fixWarnings: Boolean(fixWarningsAction?.enabled),
    reasonUnavailable:
      reviewAction?.reasonDisabled
      || reviseAction?.reasonDisabled
      || fixWarningsAction?.reasonDisabled
      || '',
  };
}

export function createElectronRequestService(options = {}) {
  const projectService = options.projectService;
  const actionService = options.actionService;
  const onPreviewRefresh = typeof options.onPreviewRefresh === 'function'
    ? options.onPreviewRefresh
    : () => {};

  async function listActionDescriptors() {
    return actionService.listActions();
  }

  return {
    async listActionDescriptors() {
      return listActionDescriptors();
    },

    async getReviewAvailability() {
      return buildReviewAvailability(await listActionDescriptors());
    },

    async handleRequest(channel, payload = {}) {
      switch (channel) {
        case WORKER_REQUEST_CHANNELS.PROJECT_CREATE:
          return projectService.createProject(payload);
        case WORKER_REQUEST_CHANNELS.PROJECT_OPEN:
          return projectService.openProject(payload);
        case WORKER_REQUEST_CHANNELS.PROJECT_GET_META:
          return projectService.getMeta();
        case WORKER_REQUEST_CHANNELS.PROJECT_GET_STATE:
          return projectService.getState();
        case WORKER_REQUEST_CHANNELS.PROJECT_GET_FILES:
          return projectService.getFiles();
        case WORKER_REQUEST_CHANNELS.PROJECT_GET_SLIDES:
          return {
            slides: projectService.getSlides(),
          };
        case WORKER_REQUEST_CHANNELS.PREVIEW_GET_DOCUMENT:
          return projectService.getPreviewDocument();
        case WORKER_REQUEST_CHANNELS.PREVIEW_GET_META:
          return projectService.getPreviewMeta();
        case WORKER_REQUEST_CHANNELS.PREVIEW_REFRESH: {
          const meta = projectService.refreshPreview();
          onPreviewRefresh();
          return meta;
        }
        case WORKER_REQUEST_CHANNELS.BUILD_CHECK:
          return actionService.invokeAction('check_presentation', {
            outputDir: payload.outputDir,
            options: payload,
          });
        case WORKER_REQUEST_CHANNELS.BUILD_FINALIZE:
          return actionService.invokeAction('build_presentation', {
            options: payload,
          });
        case WORKER_REQUEST_CHANNELS.BUILD_CAPTURE_SCREENSHOTS:
          return actionService.invokeAction('capture_screenshots', {
            outputDir: payload.outputDir,
            options: payload,
          });
        case WORKER_REQUEST_CHANNELS.EXPORT_START:
          return actionService.invokeAction('export_presentation', payload);
        case WORKER_REQUEST_CHANNELS.REVIEW_RUN:
          return actionService.invokeAction(REVIEW_ACTION_IDS.run, payload);
        case WORKER_REQUEST_CHANNELS.REVIEW_REVISE:
          return actionService.invokeAction(REVIEW_ACTION_IDS.revise, payload);
        case WORKER_REQUEST_CHANNELS.REVIEW_FIX_WARNINGS:
          return actionService.invokeAction(REVIEW_ACTION_IDS.fixWarnings, payload);
        case WORKER_REQUEST_CHANNELS.REVIEW_GET_AVAILABILITY:
          return this.getReviewAvailability();
        case WORKER_REQUEST_CHANNELS.ACTION_LIST:
          return {
            actions: await listActionDescriptors(),
          };
        case WORKER_REQUEST_CHANNELS.ACTION_INVOKE:
          return actionService.invokeAction(payload.actionId, payload.args || {});
        default:
          throw new Error(`Unsupported worker request channel: ${channel}`);
      }
    },
  };
}
