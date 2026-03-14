import { captureDeck } from './deck-capture.mjs';
import { getPresentationPaths, parsePresentationTargetCliArgs } from './deck-paths.js';
import { listSlideSourceEntries } from './deck-source.js';
import { checkDeckQuality } from './deck-quality.js';

const strict = process.argv.includes('--strict');
const args = process.argv.slice(2).filter((a) => a !== '--strict');

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(args);
} catch (err) {
  console.error(`Usage: node framework/runtime/check-deck.mjs --project /abs/path [output-dir] | --deck <slug> [output-dir] | --example <name> [output-dir] [--strict]\n\n${err.message}`);
  process.exit(1);
}

const target = parsed.target;
const targetPaths = getPresentationPaths(target);
const outputDir = parsed.rest[0] || `/tmp/deck-check-${targetPaths.slug}-${Date.now()}`;

try {
  const report = await captureDeck(target, outputDir);
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

  // Quality warnings
  const slideEntries = listSlideSourceEntries(targetPaths).filter((e) => e.isValidName);
  const quality = checkDeckQuality(slideEntries);

  console.log('\n--- CHECK ---');
  console.log(JSON.stringify({
    workspace: report.workspace,
    outputDir: report.outputDir,
    slideCount: report.slideCount,
    consoleErrors: report.consoleErrors.length,
    overflowSlides: report.consistency.slidesWithOverflow,
    qualityWarnings: quality.warnings.length,
    status: failures.length === 0 ? 'pass' : 'fail',
  }, null, 2));

  if (quality.warnings.length > 0) {
    console.log('\n--- QUALITY WARNINGS ---');
    for (const w of quality.warnings) {
      console.log(`\n⚠ ${w.rule} [${w.slideId}]`);
      console.log(`  ${w.message}`);
      console.log(`  Fix: ${w.fix}`);
    }
    console.log(`\n${quality.warnings.length} quality warning(s).`);
  }

  if (failures.length > 0) {
    console.error('\nCheck failed:');
    failures.forEach((msg) => console.error(`- ${msg}`));
    process.exit(1);
  }

  if (strict && quality.warnings.length > 0) {
    console.error(`\n--strict: ${quality.warnings.length} quality warning(s) treated as errors.`);
    process.exit(1);
  }
} catch (err) {
  console.error('Check failed:', err.message);
  process.exit(1);
}
