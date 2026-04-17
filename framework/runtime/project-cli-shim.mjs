export const PROJECT_LOCAL_FRAMEWORK_CLI_REL = '.presentation/framework-cli.mjs';

export function formatProjectFrameworkCliCommand(command, ...args) {
  return ['node', PROJECT_LOCAL_FRAMEWORK_CLI_REL, command, ...args].join(' ');
}

export function renderProjectFrameworkCliSource() {
  return `#!/usr/bin/env node
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runPresentationCli } from 'pitch-framework/presentation-cli';

const require = createRequire(import.meta.url);

function resolvePresentationCliEntrypoint() {
  return require.resolve('pitch-framework/presentation-cli');
}

export function resolveInstalledFrameworkRoot() {
  return resolve(dirname(resolvePresentationCliEntrypoint()), '..', '..');
}

export function resolveProjectFramework\\u0053ourceRoot() {
  return resolveInstalledFrameworkRoot();
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
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
