import { parsePresentationTargetCliArgs } from './deck-paths.js';
import { finalizePresentation } from './services/presentation-ops-service.mjs';

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: npm run finalize -- --project /abs/path\n\n${err.message}`);
  process.exit(1);
}

try {
  const result = await finalizePresentation(parsed.target);

  console.log(JSON.stringify({
    status: result.status,
    deck: result.deck,
    source: result.source,
    pdf: result.pdf,
    report: result.report,
    screenshots: result.screenshots,
    summary: result.summary,
    issues: result.issues,
  }, null, 2));

  if (result.status !== 'pass') {
    process.exit(1);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
