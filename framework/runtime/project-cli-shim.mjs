import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { FRAMEWORK_ROOT } from './deck-paths.js';

export const PROJECT_LOCAL_FRAMEWORK_CLI_REL = '.presentation/framework-cli.mjs';

export function formatProjectFrameworkCliCommand(command, ...args) {
  return ['node', PROJECT_LOCAL_FRAMEWORK_CLI_REL, command, ...args].join(' ');
}

export function renderProjectFrameworkCliSource(options = {}) {
  const frameworkRoot = resolve(options.frameworkRoot || FRAMEWORK_ROOT);
  const fallbackPresentationCliUrl = pathToFileURL(
    resolve(frameworkRoot, 'framework', 'runtime', 'presentation-cli.mjs')
  ).href;

  return `#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRESENTATION_CLI_SPECIFIER = 'pitch-framework/presentation-cli';
const FALLBACK_FRAMEWORK_ROOT = ${JSON.stringify(frameworkRoot)};
const FALLBACK_PRESENTATION_CLI_URL = ${JSON.stringify(fallbackPresentationCliUrl)};

async function resolvePresentationCliModuleUrl() {
  try {
    return import.meta.resolve(PRESENTATION_CLI_SPECIFIER);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') {
      throw error;
    }
    return FALLBACK_PRESENTATION_CLI_URL;
  }
}

const presentationCliModuleUrl = await resolvePresentationCliModuleUrl();
const { runPresentationCli } = await import(presentationCliModuleUrl);

export function resolveInstalledFrameworkRoot() {
  if (presentationCliModuleUrl === FALLBACK_PRESENTATION_CLI_URL) {
    return FALLBACK_FRAMEWORK_ROOT;
  }

  return resolve(dirname(fileURLToPath(presentationCliModuleUrl)), '..', '..');
}

export function resolveProjectFramework\u0053ourceRoot() {
  return resolveInstalledFrameworkRoot();
}

function isDirectCliInvocation() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
  }
}

if (isDirectCliInvocation()) {
  const shimDir = dirname(fileURLToPath(import.meta.url));
  const projectRoot = resolve(shimDir, '..');
  const result = await runPresentationCli([
    ...process.argv.slice(2),
    '--project', projectRoot,
  ]);
  process.stdout.write(result.stdout);
  process.exit(result.exitCode);
}
`;
}
