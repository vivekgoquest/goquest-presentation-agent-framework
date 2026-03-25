import {
  capturePresentation,
  exportPresentation,
  finalizePresentation,
  validatePresentation,
} from '../runtime/services/presentation-ops-service.mjs';

function toActionMessage(actionId, result = {}) {
  switch (actionId) {
    case 'export_presentation':
      return 'Presentation export completed.';
    case 'export_presentation_artifacts':
      return result.format === 'png'
        ? 'PNG export completed.'
        : 'PDF export completed.';
    case 'validate_presentation':
      return result.status === 'fail'
        ? 'Presentation validation found issues.'
        : 'Presentation validation passed.';
    case 'capture_screenshots':
      return result.status === 'fail'
        ? 'Screenshot capture found issues.'
        : 'Screenshot capture completed.';
    default:
      return 'Presentation action completed.';
  }
}

export function createPresentationActionAdapter() {
  return {
    async invoke(actionId, context = {}) {
      const target = context.target;
      const outputPaths = context.outputPaths || {};
      const args = context.args || {};

      switch (actionId) {
        case 'export_presentation': {
          const result = await finalizePresentation(target, args.options || {});
          return {
            ...result,
            status: result.status || 'pass',
            message: toActionMessage(actionId, result),
            detail: result.pdf || result.summary || result.report || '',
          };
        }
        case 'export_presentation_artifacts': {
          const result = await exportPresentation(target, {
            format: args.format,
            slideIds: args.slideIds,
            outputDir: args.outputDir,
            outputFile: args.outputFile,
            pdfOptions: args.options?.pdfOptions || {},
            captureOptions: args.options?.captureOptions || {},
          }, args.options || {});
          return {
            ...result,
            status: 'pass',
            message: toActionMessage(actionId, result),
            detail: result.format === 'png'
              ? `Saved ${result.outputPaths.length} PNG file${result.outputPaths.length === 1 ? '' : 's'} to ${result.outputDir}`
              : (result.outputPath || ''),
          };
        }
        case 'validate_presentation': {
          const result = await validatePresentation(target, {
            ...(args.options || {}),
            outputDir: args.outputDir || args.options?.outputDir || outputPaths.outputDirAbs,
          });
          return {
            ...result,
            status: result.status || 'pass',
            message: toActionMessage(actionId, result),
            detail: (result.failures && result.failures[0]) || '',
          };
        }
        case 'capture_screenshots': {
          const result = await capturePresentation(
            target,
            args.outputDir || outputPaths.outputDirAbs,
            args.options || {}
          );
          return {
            ...result,
            status: result.status || 'pass',
            message: toActionMessage(actionId, result),
          };
        }
        default:
          throw new Error(`Unsupported presentation action "${actionId}".`);
      }
    },
  };
}
