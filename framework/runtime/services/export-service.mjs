import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { generatePDF } from '../pdf-export.js';
import { capturePresentation } from './capture-service.mjs';
import {
  createPresentationTarget,
  getPresentationId,
  getSuggestedPdfName,
} from '../deck-paths.js';

export async function exportDeckPdf(targetInput, outputFile = null, options = {}) {
  const target = createPresentationTarget(targetInput);
  const cwd = options.cwd || process.cwd();
  const outputPath = resolve(cwd, outputFile || getSuggestedPdfName(target));

  mkdirSync(dirname(outputPath), { recursive: true });
  const pdfBuffer = await generatePDF(target, {
    ...(options.pdfOptions || {}),
    slideIds: options.slideIds || options.pdfOptions?.slideIds || [],
  });
  writeFileSync(outputPath, pdfBuffer);

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
      slideIds,
      pdfOptions: request.pdfOptions || options.pdfOptions || {},
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
