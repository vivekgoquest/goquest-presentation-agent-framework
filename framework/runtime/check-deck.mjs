import { parsePresentationTargetCliArgs } from './deck-paths.js';
import { validatePresentation } from './services/check-service.mjs';

const args = process.argv.slice(2);

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(args);
} catch (err) {
  console.error(`Usage: node framework/runtime/check-deck.mjs --project /abs/path [output-dir]\n\n${err.message}`);
  process.exit(1);
}

try {
  const result = await validatePresentation(parsed.target, {
    outputDir: parsed.rest[0],
  });

  console.log('\n--- CHECK ---');
  console.log(JSON.stringify({
    workspace: result.workspace,
    outputDir: result.outputDir,
    slideCount: result.slideCount,
    consoleErrors: result.consoleErrors,
    overflowSlides: result.overflowSlides,
    failures: result.failures.length,
    status: result.status,
  }, null, 2));

  if (result.failures.length > 0) {
    console.error('\nCheck failed:');
    result.failures.forEach((message) => console.error(`- ${message}`));
    process.exit(1);
  }
} catch (err) {
  console.error('Check failed:', err.message);
  process.exit(1);
}
