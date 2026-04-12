import { chromium } from 'playwright';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  REPO_ROOT,
  createPresentationTarget,
  getPresentationId,
  getPresentationOutputPaths,
  getPresentationPaths,
  getSuggestedPdfName,
  toRelativeWithin,
} from '../deck-paths.js';
import { renderPresentationHtml } from '../deck-assemble.js';
import {
  readArtifacts,
  writeArtifacts,
  writeRenderState,
} from '../presentation-runtime-state.js';
import { generatePDF } from '../pdf-export.js';
import { withRuntimeServer } from '../runtime-app.js';
import {
  DEFAULT_VIEWPORT,
  discoverDeckSlides,
  prepareDeckPage,
  selectDeckSlides,
} from '../deck-runtime.js';
import { validateRenderedCanvasContract } from '../rendered-canvas-contract.mjs';

// -----------------------------------------------------------------------------
// Capture Primitives
// -----------------------------------------------------------------------------

function buildReportSummary(slides, consoleErrors) {
  const slideIds = slides.map((slide) => slide.id);
  const overflowSlides = slides.filter((slide) => slide.overflowDetected).map((slide) => slide.id);
  const canvasContract = validateRenderedCanvasContract(slides);

  return {
    slideIds,
    consoleErrorCount: consoleErrors.length,
    overflowSlides,
    episodeCount: slides.flatMap((slide) => slide.episodeRefs).length,
    canvasContract,
    status: slideIds.length === 0 || consoleErrors.length > 0 || overflowSlides.length > 0 || !canvasContract.valid
      ? 'fail'
      : 'pass',
  };
}

async function captureDeckFromPreviewUrl(previewUrl, target, outputDir, options = {}) {
  const {
    slidesDirName = '',
    slideIds = [],
    writeReport = true,
    captureFullPage = true,
  } = options;
  const slidesOutputDir = slidesDirName
    ? resolve(outputDir, slidesDirName)
    : outputDir;

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(slidesOutputDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: DEFAULT_VIEWPORT,
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  await page.goto(previewUrl, { waitUntil: 'load' });
  await prepareDeckPage(page);
  if (captureFullPage) {
    await page.screenshot({ path: resolve(outputDir, 'full-page.png'), fullPage: true });
  }

  const slideTargets = selectDeckSlides(await discoverDeckSlides(page), slideIds);
  const slideIndex = new Map(slideTargets.map((slide) => [slide.id, slide]));
  const selectedSlideIds = new Set(slideTargets.map((slide) => slide.id));

  const slides = await page.evaluate(() => {
    const sections = document.querySelectorAll('[data-slide]');
    return Array.from(sections).map((section) => {
      const slideEl = section.querySelector('.slide, .slide-wide, .slide-hero');
      if (!slideEl) {
        return null;
      }

      const rect = slideEl.getBoundingClientRect();
      const allText = slideEl.innerText.trim();
      const headings = Array.from(slideEl.querySelectorAll('.hero-title, .sect-title, h1, h2, h3'))
        .map((heading) => ({ tag: heading.tagName, class: heading.className, text: heading.textContent.trim() }));
      const eyebrows = Array.from(slideEl.querySelectorAll('.eyebrow'))
        .map((eyebrow) => eyebrow.textContent.trim());
      const bodyTexts = Array.from(slideEl.querySelectorAll('.body-text, .body-lg'))
        .map((body) => body.textContent.trim());

      const stats = Array.from(slideEl.querySelectorAll('[data-count]')).map((element) => ({
        value: element.dataset.count,
        prefix: element.dataset.prefix || '',
        suffix: element.dataset.suffix || '',
        displayed: element.textContent.trim(),
        label: element.closest('.stat-card')?.querySelector('.stat-label')?.textContent.trim() || '',
      }));

      const numbersInText = allText.match(/\d[\d,.]*/g) || [];

      const episodeRefs = [];
      const episodeMatches = allText.matchAll(/Ep(?:isode)?\s*(\d+)[:\s]*[""]?([^"""\n]{0,80})[""]?/gi);
      for (const match of episodeMatches) {
        episodeRefs.push({ number: parseInt(match[1], 10), title: match[2]?.trim() || '' });
      }

      const badges = Array.from(slideEl.querySelectorAll('.badge, [class*="badge-"]'))
        .map((badge) => ({ text: badge.textContent.trim(), classes: badge.className }));

      const tables = Array.from(slideEl.querySelectorAll('table')).map((table) => {
        const headers = Array.from(table.querySelectorAll('th')).map((cell) => cell.textContent.trim());
        const rows = Array.from(table.querySelectorAll('tr')).map((row) =>
          Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent.trim())
        ).filter((row) => row.length > 0);
        return { headers, rows };
      });

      const images = Array.from(slideEl.querySelectorAll('img')).map((img) => ({
        src: img.getAttribute('src'),
        alt: img.getAttribute('alt') || '',
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        displayed: { width: img.clientWidth, height: img.clientHeight },
      }));

      const grids = Array.from(slideEl.querySelectorAll('.g2, .g3, .g4')).map((grid) => {
        const children = Array.from(grid.children);
        const childRects = children.map((child) => {
          const childRect = child.getBoundingClientRect();
          return {
            width: Math.round(childRect.width),
            height: Math.round(childRect.height),
            top: Math.round(childRect.top),
            left: Math.round(childRect.left),
          };
        });

        return {
          class: grid.className,
          childCount: children.length,
          childRects,
          widthsEqual: childRects.length > 1 && new Set(childRects.map((rectValue) => rectValue.width)).size === 1,
          topsAligned: childRects.length > 1 && new Set(childRects.map((rectValue) => rectValue.top)).size === 1,
        };
      });

      const computedStyle = window.getComputedStyle(slideEl);
      const styles = {
        backgroundColor: computedStyle.backgroundColor,
        borderRadius: computedStyle.borderRadius,
        fontFamily: computedStyle.fontFamily,
        padding: computedStyle.padding,
        boxShadow: computedStyle.boxShadow,
        overflow: computedStyle.overflow,
        aspectRatio: computedStyle.aspectRatio,
        maxWidth: computedStyle.maxWidth,
      };

      const beforeStyle = window.getComputedStyle(slideEl, '::before');
      const afterStyle = window.getComputedStyle(slideEl, '::after');
      const readPseudoLogo = (style, positionKey) => {
        const hasAsset = style.backgroundImage && style.backgroundImage !== 'none';
        return {
          visible: Boolean(
            hasAsset
            && style.content !== 'none'
            && style.display !== 'none'
            && style.visibility !== 'hidden'
            && style.opacity !== '0'
          ),
          hasAsset: Boolean(hasAsset),
          backgroundImage: style.backgroundImage,
          position: positionKey === 'right'
            ? { top: style.top, right: style.right }
            : { top: style.top, left: style.left },
          size: { width: style.width, height: style.height },
        };
      };
      const logos = {
        right: readPseudoLogo(beforeStyle, 'right'),
        left: readPseudoLogo(afterStyle, 'left'),
      };

      const overflowDetected = slideEl.scrollHeight > slideEl.clientHeight + 2
        || slideEl.scrollWidth > slideEl.clientWidth + 2;

      const fontSizes = new Set();
      const fontWeights = new Set();
      slideEl.querySelectorAll('*').forEach((element) => {
        const style = window.getComputedStyle(element);
        if (element.textContent.trim()) {
          fontSizes.add(style.fontSize);
          fontWeights.add(style.fontWeight);
        }
      });

      const innerCards = Array.from(slideEl.querySelectorAll('.icard')).map((card) => {
        const cardRect = card.getBoundingClientRect();
        return {
          text: card.textContent.trim().substring(0, 200),
          width: Math.round(cardRect.width),
          height: Math.round(cardRect.height),
        };
      });

      const takeaways = Array.from(slideEl.querySelectorAll('.tkwy'))
        .map((takeaway) => takeaway.textContent.trim());

      return {
        id: section.id,
        index: Array.from(sections).indexOf(section),
        isHero: slideEl.classList.contains('slide-hero'),
        dimensions: {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          aspectRatio: (rect.width / rect.height).toFixed(3),
        },
        allText,
        headings,
        eyebrows,
        bodyTexts,
        stats,
        numbersInText,
        episodeRefs,
        badges,
        tables,
        images,
        grids,
        innerCards,
        takeaways,
        styles,
        logos,
        overflowDetected,
        typography: {
          fontSizesUsed: Array.from(fontSizes),
          fontWeightsUsed: Array.from(fontWeights),
        },
      };
    }).filter(Boolean);
  });
  const selectedSlides = slides.filter((slide) => selectedSlideIds.has(slide.id));

  for (const slide of selectedSlides) {
    const slideTarget = slideIndex.get(slide.id);
    const el = slideTarget ? await page.$(slideTarget.selector) : await page.$(`#${slide.id}`);
    if (el) {
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const screenshotPath = resolve(slidesOutputDir, `slide-${slide.id}.png`);
      await el.screenshot({ path: screenshotPath, type: 'png' });
      slide.screenshotPath = screenshotPath;
    }
  }

  await browser.close();

  const summary = buildReportSummary(selectedSlides, consoleErrors);
  const report = {
    workspace: getPresentationId(target),
    presentation: getPresentationId(target),
    previewUrl,
    timestamp: new Date().toISOString(),
    outputDir,
    slidesDir: slidesOutputDir,
    slideCount: selectedSlides.length,
    slideIds: summary.slideIds,
    consoleErrors,
    consoleErrorCount: summary.consoleErrorCount,
    overflowSlides: summary.overflowSlides,
    episodeCount: summary.episodeCount,
    status: summary.status,
    issues: [],
    slides: selectedSlides,
    consistency: {
      allSlidesHaveLogos: selectedSlides.filter((slide) => !slide.isHero).every((slide) => slide.logos.right.visible && slide.logos.left.visible),
      slidesWithoutRightLogo: selectedSlides.filter((slide) => !slide.isHero && !slide.logos.right.visible).map((slide) => slide.id),
      slidesWithoutLeftLogo: selectedSlides.filter((slide) => !slide.isHero && !slide.logos.left.visible).map((slide) => slide.id),
      slidesWithOverflow: selectedSlides.filter((slide) => slide.overflowDetected).map((slide) => slide.id),
      aspectRatios: [...new Set(selectedSlides.map((slide) => slide.dimensions.aspectRatio))],
      canvasContract: summary.canvasContract,
      allEpisodeRefs: selectedSlides.flatMap((slide) => slide.episodeRefs),
      allStats: selectedSlides.flatMap((slide) => slide.stats),
      allBadges: selectedSlides.flatMap((slide) => slide.badges.map((badge) => badge.text)),
    },
  };

  if (writeReport) {
    writeFileSync(resolve(outputDir, 'report.json'), JSON.stringify(report, null, 2));
  }

  return report;
}

export async function capturePresentation(targetInput, outputDir = `/tmp/deck-verify-${Date.now()}`, options = {}) {
  const target = createPresentationTarget(targetInput);
  renderPresentationHtml(target);
  return withRuntimeServer(target, ({ previewUrl }) =>
    captureDeckFromPreviewUrl(previewUrl, target, outputDir, options)
  );
}

export function getDefaultCaptureOutputDir(targetInput) {
  const target = createPresentationTarget(targetInput);
  const targetPaths = getPresentationPaths(target);
  return `/tmp/deck-verify-${targetPaths.slug}-${Date.now()}`;
}

// -----------------------------------------------------------------------------
// Shared Report and Artifact Helpers
// -----------------------------------------------------------------------------

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

function toProjectArtifactPath(projectPaths, pathValue) {
  if (!pathValue) {
    return '';
  }

  try {
    return toRelativeWithin(projectPaths.projectRootAbs, pathValue);
  } catch {
    return pathValue;
  }
}

function getDefaultPdfExportOutputPath(target) {
  const outputPaths = getPresentationOutputPaths(target);
  return resolve(outputPaths.exportsOutputDirAbs, 'pdf', getSuggestedPdfName(target));
}

function writeLatestExportArtifacts(projectRootInput, projectPaths, latestExport, options = {}) {
  const previousArtifacts = readArtifacts(projectRootInput);
  return writeArtifacts(projectRootInput, {
    generatedAt: options.generatedAt || new Date().toISOString(),
    sourceFingerprint: options.sourceFingerprint || computeSourceFingerprint(projectPaths.projectRootAbs),
    finalized: previousArtifacts?.finalized,
    latestExport,
  });
}

function collectFingerprintFiles(projectRootAbs, relativePath, files) {
  const targetAbs = resolve(projectRootAbs, relativePath);
  const stats = statSync(targetAbs, { throwIfNoEntry: false });
  if (!stats) {
    return;
  }

  if (stats.isDirectory()) {
    const entries = readdirSync(targetAbs, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const childRel = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) {
        collectFingerprintFiles(projectRootAbs, childRel, files);
      } else if (entry.isFile()) {
        files.push(childRel);
      }
    }
    return;
  }

  if (stats.isFile()) {
    files.push(relativePath);
  }
}

function computeSourceFingerprint(projectRootAbs) {
  const hash = createHash('sha256');
  const files = [];
  const roots = [
    'brief.md',
    'outline.md',
    'theme.css',
    'assets',
    'slides',
    '.presentation/intent.json',
    '.presentation/framework/base',
    '.presentation/framework/overrides',
  ];

  for (const relativePath of roots) {
    collectFingerprintFiles(projectRootAbs, relativePath, files);
  }

  files.sort();
  for (const relativePath of files) {
    hash.update(`${relativePath}\n`);
    hash.update(readFileSync(resolve(projectRootAbs, relativePath)));
    hash.update('\n');
  }

  return `sha256:${hash.digest('hex')}`;
}

function buildFinalizeSummary({ target, sourcePaths, outputPaths, status, issues, report }) {
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

// -----------------------------------------------------------------------------
// Validate Flow
// -----------------------------------------------------------------------------

export async function validatePresentation(targetInput, options = {}) {
  const target = createPresentationTarget(targetInput);
  const targetPaths = getPresentationPaths(target);
  const outputDir = options.outputDir || getDefaultCaptureOutputDir(target);

  const report = await capturePresentation(target, outputDir);
  const failures = buildFailures(report);
  const status = failures.length > 0 ? 'fail' : 'pass';

  writeRenderState(targetPaths.projectRootAbs, {
    producer: 'validate',
    status,
    slideIds: report.slideIds,
    previewKind: 'slides',
    canvasContract: report.consistency.canvasContract,
    consoleErrorCount: report.consoleErrors.length,
    overflowSlides: report.consistency.slidesWithOverflow,
    failures,
    lastCheckedAt: new Date().toISOString(),
  });

  return {
    workspace: report.workspace,
    outputDir: report.outputDir,
    slideCount: report.slideCount,
    consoleErrors: report.consoleErrors.length,
    overflowSlides: report.consistency.slidesWithOverflow,
    failures,
    status,
  };
}

// -----------------------------------------------------------------------------
// Export Flow
// -----------------------------------------------------------------------------

export async function exportDeckPdf(targetInput, outputFile = null, options = {}) {
  const target = createPresentationTarget(targetInput);
  const cwd = options.cwd || process.cwd();
  const projectPaths = getPresentationPaths(target);
  const outputPath = outputFile
    ? resolve(cwd, outputFile)
    : getDefaultPdfExportOutputPath(target);
  const shouldRecordArtifacts = options.recordArtifacts !== false;

  mkdirSync(dirname(outputPath), { recursive: true });
  const pdfBuffer = await generatePDF(target, {
    ...(options.pdfOptions || {}),
    slideIds: options.slideIds || options.pdfOptions?.slideIds || [],
  });
  writeFileSync(outputPath, pdfBuffer);

  if (shouldRecordArtifacts) {
    writeLatestExportArtifacts(projectPaths.projectRootAbs, projectPaths, {
      exists: true,
      format: 'pdf',
      outputDir: toProjectArtifactPath(projectPaths, dirname(outputPath)),
      pdf: { path: toProjectArtifactPath(projectPaths, outputPath) },
      slides: [],
      artifacts: [{ path: toProjectArtifactPath(projectPaths, outputPath) }],
    });
  }

  return {
    target,
    workspace: getPresentationId(target),
    outputPath,
    bytes: pdfBuffer.length,
  };
}

export async function exportPresentation(targetInput, request = {}, options = {}) {
  const target = createPresentationTarget(targetInput);
  const cwd = options.cwd || process.cwd();
  const format = String(request.format || '').trim().toLowerCase();
  const slideIds = Array.isArray(request.slideIds)
    ? request.slideIds.map((slideId) => String(slideId || '').trim()).filter(Boolean)
    : [];
  const outputDirRaw = String(request.outputDir || '').trim();

  if (!['pdf', 'png'].includes(format)) {
    throw new Error('Export format must be either "pdf" or "png".');
  }
  if (slideIds.length === 0) {
    throw new Error('Select at least one slide to export.');
  }
  if (!outputDirRaw) {
    throw new Error('Choose a destination folder before exporting.');
  }

  const outputDir = resolve(cwd, outputDirRaw);
  mkdirSync(outputDir, { recursive: true });

  if (format === 'pdf') {
    const outputPath = resolve(outputDir, request.outputFile || getSuggestedPdfName(target));
    const result = await exportDeckPdf(target, outputPath, {
      ...options,
      recordArtifacts: false,
      slideIds,
      pdfOptions: request.pdfOptions || options.pdfOptions || {},
    });
    const projectPaths = getPresentationPaths(target);
    writeLatestExportArtifacts(projectPaths.projectRootAbs, projectPaths, {
      exists: true,
      format,
      outputDir: toProjectArtifactPath(projectPaths, outputDir),
      pdf: { path: toProjectArtifactPath(projectPaths, result.outputPath) },
      slides: [],
      artifacts: [{ path: toProjectArtifactPath(projectPaths, result.outputPath) }],
    });
    return {
      format,
      target,
      workspace: getPresentationId(target),
      slideIds,
      outputDir,
      outputPath: result.outputPath,
      outputPaths: [result.outputPath],
      bytes: result.bytes,
    };
  }

  const report = await capturePresentation(target, outputDir, {
    ...(request.captureOptions || {}),
    slideIds,
    slidesDirName: '',
    writeReport: false,
    captureFullPage: false,
  });
  const projectPaths = getPresentationPaths(target);
  const slideArtifacts = report.slides
    .filter((slide) => slide.screenshotPath)
    .map((slide) => ({
      id: slide.id,
      path: toProjectArtifactPath(projectPaths, slide.screenshotPath),
    }));

  writeLatestExportArtifacts(projectPaths.projectRootAbs, projectPaths, {
    exists: true,
    format,
    outputDir: toProjectArtifactPath(projectPaths, outputDir),
    slides: slideArtifacts,
    artifacts: slideArtifacts,
  });

  return {
    format,
    target,
    workspace: getPresentationId(target),
    slideIds: report.slideIds,
    outputDir,
    outputPaths: report.slides.map((slide) => slide.screenshotPath).filter(Boolean),
    slideCount: report.slideCount,
  };
}

// -----------------------------------------------------------------------------
// Finalize Flow
// -----------------------------------------------------------------------------

export async function finalizePresentation(targetInput, options = {}) {
  const target = createPresentationTarget(targetInput);
  const sourcePaths = getPresentationPaths(target);
  const outputPaths = getPresentationOutputPaths(target);
  const previousArtifacts = readArtifacts(sourcePaths.projectRootAbs);

  rmSync(outputPaths.finalizedOutputDirAbs, { recursive: true, force: true });
  mkdirSync(outputPaths.finalizedSlidesDirAbs, { recursive: true });

  let status = 'pass';
  let issues = [];
  let report = null;

  try {
    report = await capturePresentation(target, outputPaths.finalizedOutputDirAbs, {
      slidesDirName: options.slidesDirName || 'slides',
    });
    issues = summarizeIssues(report);
    await exportDeckPdf(target, outputPaths.finalizedPdfAbs, { recordArtifacts: false });

    if (issues.length > 0) {
      status = 'fail';
    }
  } catch (err) {
    status = 'fail';
    issues = [err.message];
  }

  const generatedAt = new Date().toISOString();
  const sourceFingerprint = computeSourceFingerprint(sourcePaths.projectRootAbs);
  const failures = report ? buildFailures(report) : issues;
  const summary = buildFinalizeSummary({
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
    report.slideIds = report.slideIds || report.slides.map((slide) => slide.id);
    report.consoleErrorCount = report.consoleErrors.length;
    report.overflowSlides = report.consistency.slidesWithOverflow;
    report.episodeCount = report.consistency.allEpisodeRefs.length;
    report.artifacts = {
      pdf: outputPaths.finalizedPdfRel,
      report: outputPaths.finalizedReportRel,
      fullPage: outputPaths.finalizedFullPageRel,
      slidesDir: outputPaths.finalizedSlidesDirRel,
      summary: outputPaths.finalizedSummaryRel,
    };
    writeFileSync(outputPaths.finalizedReportAbs, JSON.stringify(report, null, 2));
  }

  writeFileSync(outputPaths.finalizedSummaryAbs, summary);

  writeArtifacts(sourcePaths.projectRootAbs, {
    generatedAt,
    sourceFingerprint,
    latestExport: previousArtifacts?.latestExport,
    finalized: {
      exists: status === 'pass',
      outputDir: outputPaths.finalizedOutputDirRel,
      pdf: { path: outputPaths.finalizedPdfRel },
      fullPage: { path: outputPaths.finalizedFullPageRel },
      report: report ? { path: outputPaths.finalizedReportRel } : null,
      summary: { path: outputPaths.finalizedSummaryRel },
      slides: report
        ? report.slides
          .filter((slide) => slide.screenshotPath)
          .map((slide) => ({
            id: slide.id,
            path: toProjectArtifactPath(sourcePaths, slide.screenshotPath),
          }))
        : [],
    },
  });
  writeRenderState(sourcePaths.projectRootAbs, {
    generatedAt,
    sourceFingerprint,
    producer: 'finalize',
    status,
    slideIds: report?.slideIds || [],
    previewKind: 'slides',
    canvasContract: report?.consistency?.canvasContract || null,
    consoleErrorCount: report?.consoleErrors?.length || 0,
    overflowSlides: report?.consistency?.slidesWithOverflow || [],
    failures,
    issues,
    lastCheckedAt: generatedAt,
  });

  return {
    status,
    deck: sourcePaths.slug,
    source: sourcePaths.sourceDirDisplay,
    outputs: {
      outputDir: outputPaths.finalizedOutputDirRel,
      pdf: outputPaths.finalizedPdfRel,
      report: outputPaths.finalizedReportRel,
      fullPage: outputPaths.finalizedFullPageRel,
      slides: outputPaths.finalizedSlidesDirRel,
      summary: outputPaths.finalizedSummaryRel,
    },
    pdf: outputPaths.finalizedPdfRel,
    report: outputPaths.finalizedReportRel,
    screenshots: outputPaths.finalizedSlidesDirRel,
    summary: outputPaths.finalizedSummaryRel,
    issues,
  };
}
