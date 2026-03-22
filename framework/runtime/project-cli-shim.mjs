export const PROJECT_LOCAL_FRAMEWORK_CLI_REL = '.presentation/framework-cli.mjs';

const COMMAND_MODULES = Object.freeze({
  check: 'framework/runtime/check-deck.mjs',
  capture: 'framework/runtime/deck-capture.mjs',
  export: 'framework/runtime/export-pdf.mjs',
  finalize: 'framework/runtime/finalize-deck.mjs',
});

export function formatProjectFrameworkCliCommand(command, ...args) {
  return ['node', PROJECT_LOCAL_FRAMEWORK_CLI_REL, command, ...args].join(' ');
}

export function renderProjectFrameworkCliSource() {
  return `#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMAND_MODULES = Object.freeze(${JSON.stringify(COMMAND_MODULES, null, 2)});

function readProjectMetadata(projectRoot) {
  const metadataPath = resolve(projectRoot, '.presentation', 'project.json');
  return JSON.parse(readFileSync(metadataPath, 'utf8'));
}

const argv = process.argv.slice(2);
const command = argv.shift() || '';
if (!command || !COMMAND_MODULES[command]) {
  console.error('Usage: node .presentation/framework-cli.mjs <check|capture|export|finalize> [args...]');
  process.exit(1);
}

const shimDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(shimDir, '..');
const metadata = readProjectMetadata(projectRoot);
const frameworkRoot = metadata.frameworkSource || '';
if (!frameworkRoot) {
  console.error('Project metadata is missing frameworkSource.');
  process.exit(1);
}

const entrypointAbs = resolve(frameworkRoot, COMMAND_MODULES[command]);
execFileSync(process.execPath, [entrypointAbs, '--project', projectRoot, ...argv], {
  cwd: projectRoot,
  stdio: 'inherit',
});
`;
}
