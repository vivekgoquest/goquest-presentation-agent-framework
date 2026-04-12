/**
 * export-pdf.mjs - legacy PDF export wrapper over the presentation CLI
 */

import { basename, dirname, isAbsolute, resolve as resolvePath } from 'node:path';

import { parsePresentationTargetCliArgs } from './deck-paths.js';
import { runPresentationCli } from './presentation-cli.mjs';

let parsed;
try {
  parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
} catch (err) {
  console.error(`Usage: node framework/runtime/export-pdf.mjs --project /abs/path [output.pdf]\n\n${err.message}`);
  process.exit(1);
}

const argv = [
  'export',
  'pdf',
  '--project',
  parsed.target.projectRootAbs,
  '--format',
  'json',
];

if (parsed.rest[0]) {
  const outputPath = isAbsolute(parsed.rest[0])
    ? parsed.rest[0]
    : resolvePath(parsed.target.projectRootAbs, parsed.rest[0]);
  argv.push('--output-dir', dirname(outputPath));
  argv.push('--output-file', basename(outputPath));
}

const result = await runPresentationCli(argv);
process.stdout.write(result.stdout);
process.exit(result.exitCode);
