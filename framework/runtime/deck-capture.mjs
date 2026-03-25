/**
 * deck-capture.mjs - Playwright-based deck data extraction
 *
 * Usage:
 *   node framework/runtime/deck-capture.mjs --project /abs/path [output-dir]
 */

import { pathToFileURL } from 'url';
import {
  parsePresentationTargetCliArgs,
} from './deck-paths.js';
import {
  capturePresentation,
  getDefaultCaptureOutputDir,
} from './services/presentation-ops-service.mjs';

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  let parsed;
  try {
    parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Usage: node framework/runtime/deck-capture.mjs --project /abs/path [output-dir]\n\n${err.message}`);
    process.exit(1);
  }

  const outputDir = parsed.rest[0] || getDefaultCaptureOutputDir(parsed.target);

  capturePresentation(parsed.target, outputDir).catch((err) => {
    console.error('Capture failed:', err);
    process.exit(1);
  });
}
