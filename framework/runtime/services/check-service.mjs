import { createPresentationTarget, getPresentationPaths } from '../deck-paths.js';
import { listSlideSourceEntries } from '../deck-source.js';
import { checkDeckQuality } from '../deck-quality.js';
import { writeRenderState } from '../presentation-runtime-state.js';
import { capturePresentation, getDefaultCaptureOutputDir } from './capture-service.mjs';

function buildFailures(report) {
  const failures = [];

  if (report.slideCount === 0) {
    failures.push('No slides were discovered.');
  }
  if (report.consoleErrors.length > 0) {
    failures.push(`Browser console errors: ${report.consoleErrors.length}`);
  }
  if (report.consistency.slidesWithOverflow.length > 0) {
    failures.push(`Overflow detected on slides: ${report.consistency.slidesWithOverflow.join(', ')}`);
  }
  if (report.consistency.canvasContract?.violations?.length > 0) {
    failures.push(...report.consistency.canvasContract.violations);
  }

  return failures;
}

export async function runDeckCheck(targetInput, options = {}) {
  const target = createPresentationTarget(targetInput);
  const targetPaths = getPresentationPaths(target);
  const outputDir = options.outputDir || getDefaultCaptureOutputDir(target);
  const strict = Boolean(options.strict);

  const report = await capturePresentation(target, outputDir);
  const failures = buildFailures(report);
  const slideEntries = listSlideSourceEntries(targetPaths).filter((entry) => entry.isValidName);
  const qualityWarnings = checkDeckQuality(slideEntries).warnings;
  const strictFailure = strict && qualityWarnings.length > 0;
  let status = 'pass';
  if (failures.length > 0 || strictFailure) {
    status = 'fail';
  } else if (qualityWarnings.length > 0) {
    status = 'needs-review';
  }

  writeRenderState(targetPaths.projectRootAbs, {
    status,
    slideIds: report.slideIds,
    previewKind: 'slides',
    canvasContract: report.consistency.canvasContract,
    consoleErrorCount: report.consoleErrors.length,
    overflowSlides: report.consistency.slidesWithOverflow,
    qualityWarnings,
    failures,
    strictFailure,
    lastCheckedAt: new Date().toISOString(),
  });

  return {
    workspace: report.workspace,
    outputDir: report.outputDir,
    slideCount: report.slideCount,
    consoleErrors: report.consoleErrors.length,
    overflowSlides: report.consistency.slidesWithOverflow,
    qualityWarnings,
    failures,
    strictFailure,
    status,
  };
}
