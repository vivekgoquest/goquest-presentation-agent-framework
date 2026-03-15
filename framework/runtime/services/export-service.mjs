import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { generatePDF } from '../pdf-export.js';
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
  const pdfBuffer = await generatePDF(target, options.pdfOptions);
  writeFileSync(outputPath, pdfBuffer);

  return {
    target,
    workspace: getPresentationId(target),
    outputPath,
    bytes: pdfBuffer.length,
  };
}
