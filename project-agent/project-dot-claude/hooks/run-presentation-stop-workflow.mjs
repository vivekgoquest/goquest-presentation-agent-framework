#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const PROJECT_LOCAL_FRAMEWORK_CLI_REL = '.presentation/framework-cli.mjs';
const PROJECT_STOP_SUBCOMMAND = 'audit all';

async function readJsonFromStdin() {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  if (!input.trim()) {
    return null;
  }

  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

const payload = await readJsonFromStdin();
const projectRoot = typeof payload?.cwd === 'string' && payload.cwd.trim()
  ? payload.cwd
  : process.cwd();

const result = spawnSync(
  process.execPath,
  [PROJECT_LOCAL_FRAMEWORK_CLI_REL, ...PROJECT_STOP_SUBCOMMAND.split(' '), '--format', 'json'],
  {
    cwd: projectRoot,
    encoding: 'utf8',
  }
);

if (result.stdout) {
  process.stdout.write(result.stdout);
}

if (result.stderr) {
  process.stderr.write(result.stderr);
}

if (result.error) {
  process.stderr.write(`${result.error.message}\n`);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
