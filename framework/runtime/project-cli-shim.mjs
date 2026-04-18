export const PROJECT_LOCAL_FRAMEWORK_CLI_REL = '.presentation/framework-cli.mjs';

export function formatProjectFrameworkCliCommand(command, ...args) {
  return ['node', PROJECT_LOCAL_FRAMEWORK_CLI_REL, command, ...args].join(' ');
}

export function renderProjectFrameworkCliSource() {
  return `#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PRESENTATION_CLI_SPECIFIER = 'pitch-framework/presentation-cli';
const REPAIR_GUIDANCE = [
  \`Unable to resolve "\${PRESENTATION_CLI_SPECIFIER}" from this presentation project.\`,
  '',
  'Repair guidance:',
  '- install or link the "pitch-framework" package where this project can resolve it with standard Node package resolution',
  '- then rerun this project-local command',
  '',
  'This v1 shim does not embed machine-specific framework paths.',
].join('\\n');

let cachedPresentationCliModuleUrl = '';
let cachedResolutionError = null;

function createMissingPresentationCliError(error) {
  const detail = error?.message
    ? \`\\n\\nNode resolution error: \${error.message}\`
    : '';
  const wrapped = new Error(\`\${REPAIR_GUIDANCE}\${detail}\`);
  wrapped.code = 'PRESENTATION_CLI_NOT_RESOLVABLE';
  wrapped.cause = error;
  return wrapped;
}

function resolvePresentationCliModuleUrl() {
  if (cachedPresentationCliModuleUrl) {
    return cachedPresentationCliModuleUrl;
  }

  if (cachedResolutionError) {
    throw cachedResolutionError;
  }

  try {
    cachedPresentationCliModuleUrl = import.meta.resolve(PRESENTATION_CLI_SPECIFIER);
    return cachedPresentationCliModuleUrl;
  } catch (error) {
    cachedResolutionError = error?.code === 'ERR_MODULE_NOT_FOUND'
      ? createMissingPresentationCliError(error)
      : error;
    throw cachedResolutionError;
  }
}

async function loadPresentationCli() {
  const moduleUrl = resolvePresentationCliModuleUrl();
  const { runPresentationCli } = await import(moduleUrl);
  return { moduleUrl, runPresentationCli };
}

export function resolveInstalledFrameworkRoot() {
  const moduleUrl = resolvePresentationCliModuleUrl();
  return resolve(dirname(fileURLToPath(moduleUrl)), '..', '..');
}

export function resolveProjectFrameworkSourceRoot() {
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
  try {
    const shimDir = dirname(fileURLToPath(import.meta.url));
    const projectRoot = resolve(shimDir, '..');
    const { runPresentationCli } = await loadPresentationCli();
    const result = await runPresentationCli([
      ...process.argv.slice(2),
      '--project', projectRoot,
    ]);
    process.stdout.write(result.stdout);
    process.exit(result.exitCode);
  } catch (error) {
    process.stderr.write(\`\${error?.message || String(error)}\\n\`);
    process.exit(1);
  }
}
`;
}
