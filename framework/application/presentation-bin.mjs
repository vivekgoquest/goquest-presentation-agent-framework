#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runPresentationCli } from '../runtime/presentation-cli.mjs';
import { createProjectScaffold, parseNewDeckCliArgs } from './project-scaffold-service.mjs';

const INIT_USAGE = 'Usage: presentation init --project /abs/path [--slides <count>] [--copy-framework]';

function createBinResult(stdout = '', stderr = '', exitCode = 0) {
  return { stdout, stderr, exitCode };
}

function runInitCommand(argv = []) {
  let parsed;
  try {
    parsed = parseNewDeckCliArgs(argv);
  } catch (error) {
    return createBinResult('', `${INIT_USAGE}\n\n${error.message}\n`, 1);
  }

  try {
    const result = createProjectScaffold(parsed.target, {
      slideCount: parsed.slideCount,
      copyFramework: parsed.copyFramework,
    });
    return createBinResult(`${JSON.stringify(result, null, 2)}\n`, '', 0);
  } catch (error) {
    return createBinResult('', `${error.message}\n`, 1);
  }
}

export async function runPresentationBin(argv = process.argv.slice(2)) {
  if (String(argv[0] || '').trim() === 'init') {
    return runInitCommand(argv.slice(1));
  }

  const result = await runPresentationCli(argv);
  return createBinResult(result.stdout, '', result.exitCode);
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
  const result = await runPresentationBin(process.argv.slice(2));
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.exitCode);
}
