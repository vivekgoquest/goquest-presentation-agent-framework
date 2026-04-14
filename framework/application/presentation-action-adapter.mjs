import { createPresentationCore } from '../runtime/presentation-core.mjs';

function toActionMessage(actionId, result = {}) {
  switch (actionId) {
    case 'export_presentation':
      return 'Presentation finalize completed.';
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

function resolveProjectRoot(target) {
  return target?.projectRootAbs || target?.projectRoot || '';
}

function resolveCoreExportTarget(format) {
  return String(format || '').trim().toLowerCase() === 'png' ? 'screenshots' : 'pdf';
}

function normalizeCoreExportResult(result = {}, requestedFormat) {
  const format = String(requestedFormat || '').trim().toLowerCase() === 'png' ? 'png' : 'pdf';
  const outputPaths = Array.isArray(result.artifacts) ? result.artifacts : [];

  return {
    ...result,
    format,
    outputDir: result.outputDir || '',
    outputPath: outputPaths[0] || '',
    outputPaths,
  };
}

export function createPresentationActionAdapter(options = {}) {
  const core = options.core || createPresentationCore();

  return {
    async invoke(actionId, context = {}) {
      const target = context.target;
      const outputPaths = context.outputPaths || {};
      const args = context.args || {};
      const projectRoot = resolveProjectRoot(target);

      switch (actionId) {
        case 'export_presentation': {
          const result = await core.finalize(projectRoot, { target: 'run' });
          const outputs = result.outputs || {};
          return {
            ...result,
            status: result.status || 'pass',
            message: toActionMessage(actionId, result),
            detail: outputs.pdf || outputs.summary || outputs.report || '',
            outputs,
            pdf: outputs.pdf || '',
            report: outputs.report || '',
            screenshots: outputs.slides || '',
            summary: outputs.summary || '',
          };
        }
        case 'export_presentation_artifacts': {
          const result = normalizeCoreExportResult(
            await core.exportPresentation(projectRoot, {
              target: resolveCoreExportTarget(args.format),
              slideIds: args.slideIds,
              outputDir: args.outputDir,
              outputFile: args.outputFile,
            }),
            args.format
          );

          return {
            ...result,
            status: result.status || 'pass',
            message: toActionMessage(actionId, result),
            detail: result.format === 'png'
              ? `Saved ${result.outputPaths.length} PNG file${result.outputPaths.length === 1 ? '' : 's'} to ${result.outputDir}`
              : result.outputPath,
          };
        }
        case 'validate_presentation': {
          const result = await core.validatePresentation(projectRoot, {
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
          const result = await core.capturePresentation(projectRoot, {
            outputDir: args.outputDir || outputPaths.outputDirAbs,
            ...(args.options || {}),
          });
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
