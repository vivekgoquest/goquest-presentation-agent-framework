import { parsePresentationTargetCliArgs } from './deck-paths.js';
import { finalizePresentation } from './services/finalize-service.mjs';

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: npm run finalize -- --project /abs/path\n\n${err.message}`);
  process.exit(1);
}

try {
  const result = await finalizePresentation(parsed.target);

  if (result.qualityWarnings.length > 0) {
    console.log('\n--- QUALITY WARNINGS ---');
    for (const warning of result.qualityWarnings) {
      console.log(`\n⚠ ${warning.rule} [${warning.slideId}]`);
      console.log(`  ${warning.message}`);
      console.log(`  Fix: ${warning.fix}`);
    }
    console.log(`\n${result.qualityWarnings.length} quality warning(s).`);
  }

  console.log(JSON.stringify({
    status: result.status,
    deck: result.deck,
    source: result.source,
    pdf: result.pdf,
    report: result.report,
    screenshots: result.screenshots,
    summary: result.summary,
    issues: result.issues,
    qualityWarnings: result.qualityWarnings.length,
  }, null, 2));

  if (result.status !== 'pass') {
    process.exit(1);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
