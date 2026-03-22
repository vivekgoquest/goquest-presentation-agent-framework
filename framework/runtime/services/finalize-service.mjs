import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import {
  REPO_ROOT,
  createPresentationTarget,
  getPresentationId,
  getPresentationOutputPaths,
  getPresentationPaths,
} from '../deck-paths.js';
import { listSlideSourceEntries } from '../deck-source.js';
import { checkDeckQuality } from '../deck-quality.js';
import { capturePresentation } from './capture-service.mjs';
import { exportDeckPdf } from './export-service.mjs';

function summarizeIssues(report) {
  const issues = [];

  if (report.slideCount === 0) {
    issues.push('No slides were discovered. Every deck needs at least one <section data-slide>.');
  }
  if (report.consoleErrors.length > 0) {
    issues.push(`Browser console errors were detected: ${report.consoleErrors.length}.`);
  }
  if (report.consistency.slidesWithOverflow.length > 0) {
    issues.push(`These slides overflowed their canvas: ${report.consistency.slidesWithOverflow.join(', ')}.`);
  }
  if (report.consistency.canvasContract?.violations?.length > 0) {
    issues.push(...report.consistency.canvasContract.violations.map((violation) => `Canvas contract violation: ${violation}`));
  }

  return issues;
}

function buildSummary({ target, sourcePaths, outputPaths, status, issues, report }) {
  const unresolved = issues.length > 0
    ? issues.map((issue) => `- ${issue}`).join('\n')
    : '- None';
  const finalizeCommand = 'node .presentation/framework-cli.mjs finalize';

  let template = readFileSync(resolve(REPO_ROOT, 'framework', 'templates', 'summary.md'), 'utf-8');
  const replacements = new Map([
    ['{{SOURCE_ID}}', getPresentationId(target)],
    ['{{PRESENTATION_SLUG}}', sourcePaths.slug],
    ['{{SOURCE_WORKSPACE}}', sourcePaths.sourceDirDisplay],
    ['{{PREVIEW_PATH}}', sourcePaths.previewPath],
    ['{{SOURCE_THEME}}', sourcePaths.themeCssRel],
    ['{{SOURCE_SLIDES}}', `${sourcePaths.slidesDirRel}/`],
    ['{{BRIEF_PATH}}', sourcePaths.briefRel],
    ['{{PDF_PATH}}', outputPaths.pdfRel],
    ['{{REPORT_PATH}}', outputPaths.reportRel],
    ['{{FULL_PAGE_PATH}}', outputPaths.fullPageRel],
    ['{{SLIDES_PATH}}', outputPaths.slidesDirRel],
    ['{{STATUS}}', status],
    ['{{SLIDE_COUNT}}', String(report ? report.slideCount : 0)],
    ['{{CONSOLE_ERROR_COUNT}}', String(report ? report.consoleErrors.length : 0)],
    ['{{OVERFLOW_COUNT}}', String(report ? report.consistency.slidesWithOverflow.length : 0)],
    ['{{UNRESOLVED_ISSUES}}', unresolved],
    ['{{OUTPUT_DIR}}', outputPaths.outputDirRel],
    ['{{FINALIZE_COMMAND}}', finalizeCommand],
  ]);

  for (const [needle, value] of replacements) {
    template = template.replaceAll(needle, value);
  }

  return template;
}

export async function finalizePresentation(targetInput, options = {}) {
  const target = createPresentationTarget(targetInput);
  const sourcePaths = getPresentationPaths(target);
  const outputPaths = getPresentationOutputPaths(target);

  rmSync(outputPaths.outputDirAbs, { recursive: true, force: true });
  mkdirSync(outputPaths.slidesDirAbs, { recursive: true });

  let status = 'pass';
  let issues = [];
  let report = null;

  try {
    report = await capturePresentation(target, outputPaths.outputDirAbs, {
      slidesDirName: options.slidesDirName || 'slides',
    });
    issues = summarizeIssues(report);
    await exportDeckPdf(target, outputPaths.pdfAbs);

    if (issues.length > 0) {
      status = 'needs-review';
    }
  } catch (err) {
    status = 'fail';
    issues = [err.message];
  }

  const slideEntries = listSlideSourceEntries(sourcePaths).filter((entry) => entry.isValidName);
  const qualityWarnings = checkDeckQuality(slideEntries).warnings;
  const summary = buildSummary({
    target,
    sourcePaths,
    outputPaths,
    status,
    issues,
    report,
  });

  if (report) {
    report.status = status;
    report.issues = issues;
    report.qualityWarnings = qualityWarnings;
    report.slideIds = report.slideIds || report.slides.map((slide) => slide.id);
    report.consoleErrorCount = report.consoleErrors.length;
    report.overflowSlides = report.consistency.slidesWithOverflow;
    report.episodeCount = report.consistency.allEpisodeRefs.length;
    report.artifacts = {
      pdf: outputPaths.pdfRel,
      report: outputPaths.reportRel,
      fullPage: outputPaths.fullPageRel,
      slidesDir: outputPaths.slidesDirRel,
      summary: outputPaths.summaryRel,
    };
    writeFileSync(outputPaths.reportAbs, JSON.stringify(report, null, 2));
  }

  writeFileSync(outputPaths.summaryAbs, summary);

  return {
    status,
    deck: sourcePaths.slug,
    source: sourcePaths.sourceDirDisplay,
    pdf: outputPaths.pdfRel,
    report: outputPaths.reportRel,
    screenshots: outputPaths.slidesDirRel,
    summary: outputPaths.summaryRel,
    issues,
    qualityWarnings,
  };
}
