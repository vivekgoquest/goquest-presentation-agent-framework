/**
 * export-pdf.mjs — CLI PDF export
 *
 * Usage:
 *   node export-pdf.mjs demo.html              → outputs demo.pdf
 *   node export-pdf.mjs demo.html output.pdf   → outputs output.pdf
 */

import { resolve, basename } from 'path';
import { writeFileSync } from 'fs';
import { generatePDF } from './lib/pdf-export.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node export-pdf.mjs <file.html> [output.pdf]');
  process.exit(1);
}

const htmlFile = args[0];
const htmlPath = resolve(import.meta.dirname, htmlFile);
const outputFile = args[1] || basename(htmlFile).replace(/\.html$/, '.pdf');
const outputPath = resolve(import.meta.dirname, outputFile);

console.log(`Input:  ${htmlPath}`);
console.log(`Output: ${outputPath}\n`);

try {
  const pdfBuffer = await generatePDF(htmlPath);
  writeFileSync(outputPath, pdfBuffer);
  console.log(`\nPDF saved: ${outputPath}`);
} catch (err) {
  console.error('Export failed:', err);
  process.exit(1);
}
