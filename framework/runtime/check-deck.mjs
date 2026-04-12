import { parsePresentationTargetCliArgs } from './deck-paths.js';
import { runPresentationCli } from './presentation-cli.mjs';

const args = process.argv.slice(2);

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(args);
} catch (err) {
  console.error(`Usage: node framework/runtime/check-deck.mjs --project /abs/path [output-dir]\n\n${err.message}`);
  process.exit(1);
}

const projectRoot = parsed.target.projectRootAbs;
const auditResult = await runPresentationCli([
  'audit',
  'all',
  '--project',
  projectRoot,
  '--format',
  'json',
]);

if (auditResult.exitCode !== 0) {
  process.stdout.write(auditResult.stdout);
  process.exit(auditResult.exitCode);
}

const statusResult = await runPresentationCli([
  'status',
  '--project',
  projectRoot,
  '--format',
  'json',
]);
process.stdout.write(statusResult.stdout);
process.exit(statusResult.exitCode);
