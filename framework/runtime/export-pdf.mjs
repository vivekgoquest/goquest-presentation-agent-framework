/**
 * export-pdf.mjs — CLI PDF export
 *
 * Usage:
 *   node framework/runtime/export-pdf.mjs --deck sample
 *   node framework/runtime/export-pdf.mjs --example demo /tmp/demo.pdf
 */

import { resolve } from 'path';
import { writeFileSync } from 'fs';
import { generatePDF } from './pdf-export.js';
import {
  getSuggestedPdfName,
  getPresentationId,
  parsePresentationTargetCliArgs,
} from './deck-paths.js';

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: node framework/runtime/export-pdf.mjs --project /abs/path [output.pdf] | --deck <slug> [output.pdf] | --example <name> [output.pdf]\n\n${err.message}`);
  process.exit(1);
}

const target = parsed.target;
const outputFile = parsed.rest[0] || getSuggestedPdfName(target);
const outputPath = resolve(process.cwd(), outputFile);

console.log(`Workspace: ${getPresentationId(target)}`);
console.log(`Output:    ${outputPath}\n`);

try {
  const pdfBuffer = await generatePDF(target);
  writeFileSync(outputPath, pdfBuffer);
  console.log(`\nPDF saved: ${outputPath}`);
} catch (err) {
  console.error('Export failed:', err);
  process.exit(1);
}
