/**
 * export-pdf.mjs - CLI PDF export
 */

import { parsePresentationTargetCliArgs } from './deck-paths.js';
import { exportDeckPdf } from './services/presentation-ops-service.mjs';

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: node framework/runtime/export-pdf.mjs --project /abs/path [output.pdf]\n\n${err.message}`);
  process.exit(1);
}

try {
  const result = await exportDeckPdf(parsed.target, parsed.rest[0], {
    cwd: parsed.target.projectRootAbs,
  });
  console.log(`\nPDF saved: ${result.outputPath}`);
} catch (err) {
  console.error('Export failed:', err);
  process.exit(1);
}
