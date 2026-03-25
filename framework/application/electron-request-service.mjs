import { WORKER_REQUEST_CHANNELS } from './electron-ipc-contract.mjs';

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
