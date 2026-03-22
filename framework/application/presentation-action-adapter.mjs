import { capturePresentation } from '../runtime/services/capture-service.mjs';
import { runDeckCheck } from '../runtime/services/check-service.mjs';
import { exportPresentation } from '../runtime/services/export-service.mjs';
import { finalizePresentation } from '../runtime/services/finalize-service.mjs';

function toActionMessage(actionId, result = {}) {
  switch (actionId) {
    case 'build_presentation':
      return result.status === 'needs-review'
        ? 'Build finished, but the outputs need review.'
        : 'Presentation build completed.';
    case 'export_presentation':
      return result.format === 'png'
        ? 'PNG export completed.'
        : 'PDF export completed.';
    case 'check_presentation':
      return result.status === 'fail'
        ? 'Presentation check found issues.'
        : 'Presentation check passed.';
    case 'capture_screenshots':
      return result.status === 'needs-review'
        ? 'Capture completed, but the screenshots need review.'
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
        case 'build_presentation': {
          const result = await finalizePresentation(target, args.options || {});
          return {
            ...result,
            status: result.status || 'pass',
            message: toActionMessage(actionId, result),
          };
        }
        case 'export_presentation': {
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
        case 'check_presentation': {
          const result = await runDeckCheck(target, {
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
