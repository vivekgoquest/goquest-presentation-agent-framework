/**
 * deck-capture.mjs - legacy screenshot capture wrapper over the presentation CLI
 *
 * Usage:
 *   node framework/runtime/deck-capture.mjs --project /abs/path [output-dir]
 */

import { pathToFileURL } from 'url';

import {
  parsePresentationTargetCliArgs,
} from './deck-paths.js';
import { runPresentationCli } from './presentation-cli.mjs';

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  let parsed;
  try {
    parsed = parsePresentationTargetCliArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Usage: node framework/runtime/deck-capture.mjs --project /abs/path [output-dir]\n\n${err.message}`);
    process.exit(1);
  }

  const argv = [
    'export',
    'screenshots',
    '--project',
    parsed.target.projectRootAbs,
    '--format',
    'json',
  ];

  if (parsed.rest[0]) {
    argv.push('--output-dir', parsed.rest[0]);
  }

  const result = await runPresentationCli(argv);
  process.stdout.write(result.stdout);
  process.exit(result.exitCode);
}
