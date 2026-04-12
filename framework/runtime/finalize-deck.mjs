import { parsePresentationTargetCliArgs } from './deck-paths.js';
import { runPresentationCli } from './presentation-cli.mjs';

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: npm run finalize -- --project /abs/path\n\n${err.message}`);
  process.exit(1);
}

const result = await runPresentationCli([
  'finalize',
  'run',
  '--project',
  parsed.target.projectRootAbs,
  '--format',
  'json',
]);
process.stdout.write(result.stdout);
process.exit(result.exitCode);
