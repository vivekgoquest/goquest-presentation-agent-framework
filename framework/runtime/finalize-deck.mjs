import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { generatePDF } from './pdf-export.js';
import { captureDeck } from './deck-capture.mjs';
import {
  REPO_ROOT,
  getPresentationId,
  getPresentationOutputPaths,
  getPresentationPaths,
  parsePresentationTargetCliArgs,
} from './deck-paths.js';
import { listSlideSourceEntries } from './deck-source.js';
import { checkDeckQuality } from './deck-quality.js';

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

  return issues;
}

function buildSummary({ target, sourcePaths, outputPaths, status, issues, report }) {
  const unresolved = issues.length > 0
    ? issues.map((issue) => `- ${issue}`).join('\n')
    : '- None';
  const finalizeCommand = target.kind === 'project'
    ? `npm run finalize -- --project ${sourcePaths.sourceDirAbs}`
    : `npm run finalize -- --deck ${sourcePaths.slug}`;

  let template = readFileSync(resolve(REPO_ROOT, 'templates', 'summary.md'), 'utf-8');
  const replacements = new Map([
    ['{{SOURCE_ID}}', getPresentationId(target)],
    ['{{PRESENTATION_SLUG}}', sourcePaths.slug],
    ['{{SOURCE_WORKSPACE}}', sourcePaths.sourceDirDisplay],
    ['{{PREVIEW_PATH}}', sourcePaths.previewPath],
    ['{{SOURCE_THEME}}', sourcePaths.themeCssRel],
    ['{{SOURCE_SLIDES}}', `${sourcePaths.slidesDirRel}/`],
    ['{{BRIEF_PATH}}', sourcePaths.briefRel],
    ['{{REVISIONS_PATH}}', sourcePaths.revisionsRel],
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

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: npm run finalize -- --project /abs/path | --deck <slug>\n\n${err.message}`);
  process.exit(1);
}

const target = parsed.target;
if (target.kind === 'workspace' && target.ownerType !== 'deck') {
  console.error('Usage: npm run finalize -- --project /abs/path | --deck <slug>\n\nFinalize supports project folders and --deck <slug> only.');
  process.exit(1);
}

let sourcePaths;
let outputPaths;
try {
  sourcePaths = getPresentationPaths(target);
  outputPaths = getPresentationOutputPaths(target);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

rmSync(outputPaths.outputDirAbs, { recursive: true, force: true });
mkdirSync(outputPaths.slidesDirAbs, { recursive: true });

let status = 'pass';
let issues = [];
let report = null;

try {
  report = await captureDeck(target, outputPaths.outputDirAbs, {
    slidesDirName: 'slides',
  });
  issues = summarizeIssues(report);

  const pdfBuffer = await generatePDF(target);
  writeFileSync(outputPaths.pdfAbs, pdfBuffer);

  if (issues.length > 0) {
    status = 'needs-review';
  }
} catch (err) {
  status = 'fail';
  issues = [err.message];
}

  const summary = buildSummary({
    target,
    sourcePaths,
    outputPaths,
    status,
    issues,
    report,
  });

// Quality warnings
const slideEntries = listSlideSourceEntries(sourcePaths).filter((e) => e.isValidName);
const quality = checkDeckQuality(slideEntries);

if (report) {
  report.status = status;
  report.issues = issues;
  report.qualityWarnings = quality.warnings;
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

if (quality.warnings.length > 0) {
  console.log('\n--- QUALITY WARNINGS ---');
  for (const w of quality.warnings) {
    console.log(`\n⚠ ${w.rule} [${w.slideId}]`);
    console.log(`  ${w.message}`);
    console.log(`  Fix: ${w.fix}`);
  }
  console.log(`\n${quality.warnings.length} quality warning(s).`);
}

console.log(JSON.stringify({
  status,
  deck: sourcePaths.slug,
  source: sourcePaths.sourceDirDisplay,
  pdf: outputPaths.pdfRel,
  report: outputPaths.reportRel,
  screenshots: outputPaths.slidesDirRel,
  summary: outputPaths.summaryRel,
  issues,
  qualityWarnings: quality.warnings.length,
}, null, 2));

if (status !== 'pass') {
  process.exit(1);
}
