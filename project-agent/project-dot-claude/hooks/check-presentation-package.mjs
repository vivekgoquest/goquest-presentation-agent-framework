#!/usr/bin/env node

import { runPresentationStopHook } from './lib/presentation-hook-runner.mjs';

let input = '';
for await (const chunk of process.stdin) input += chunk;

let parsed;
try {
  parsed = JSON.parse(input);
} catch {
  process.exit(0);
}

const projectRoot = parsed?.cwd || process.cwd();
const result = await runPresentationStopHook(projectRoot);

if (result.status === 'skip') {
  process.exit(0);
}

if (result.status === 'fail') {
  for (const message of result.messages || []) {
    process.stderr.write(`${message}\n`);
  }
  process.exit(2);
}

process.exit(0);
