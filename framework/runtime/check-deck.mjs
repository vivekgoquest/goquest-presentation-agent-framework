import { parsePresentationTargetCliArgs } from './deck-paths.js';
import { runDeckCheck } from './services/check-service.mjs';

const strict = process.argv.includes('--strict');
const args = process.argv.slice(2).filter((arg) => arg !== '--strict');

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(args);
} catch (err) {
  console.error(`Usage: node framework/runtime/check-deck.mjs --project /abs/path [output-dir] | --deck <slug> [output-dir] | --example <name> [output-dir] [--strict]\n\n${err.message}`);
  process.exit(1);
}

try {
  const result = await runDeckCheck(parsed.target, {
    outputDir: parsed.rest[0],
    strict,
  });

  console.log('\n--- CHECK ---');
  console.log(JSON.stringify({
    workspace: result.workspace,
    outputDir: result.outputDir,
    slideCount: result.slideCount,
    consoleErrors: result.consoleErrors,
    overflowSlides: result.overflowSlides,
    qualityWarnings: result.qualityWarnings.length,
    status: result.status,
  }, null, 2));

  if (result.qualityWarnings.length > 0) {
    console.log('\n--- QUALITY WARNINGS ---');
    for (const warning of result.qualityWarnings) {
      console.log(`\n⚠ ${warning.rule} [${warning.slideId}]`);
      console.log(`  ${warning.message}`);
      console.log(`  Fix: ${warning.fix}`);
    }
    console.log(`\n${result.qualityWarnings.length} quality warning(s).`);
  }

  if (result.failures.length > 0) {
    console.error('\nCheck failed:');
    result.failures.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }

  if (result.strictFailure) {
    console.error(`\n--strict: ${result.qualityWarnings.length} quality warning(s) treated as errors.`);
    process.exit(1);
  }
} catch (err) {
  console.error('Check failed:', err.message);
  process.exit(1);
}
