#!/usr/bin/env node

// Legacy quality-only helper. The stop hook now runs through
// check-presentation-package.mjs so package structure, intent, and runtime
// evidence stay synchronized before quality warnings can stop the agent.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkpointGit } from './lib/git-checkpoint.mjs';

function loadProjectMetadata(projectRoot) {
  const metadataPath = resolve(projectRoot, '.presentation', 'project.json');
  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(metadataPath, 'utf8'));
  } catch {
    return null;
  }
}

async function loadQualityCheck(frameworkRoot) {
  const moduleUrl = pathToFileURL(resolve(frameworkRoot, 'framework', 'runtime', 'project-quality-check.mjs')).href;
  return import(moduleUrl);
}

export async function runSlideQualityHook(projectRoot) {
  const metadata = loadProjectMetadata(projectRoot);
  if (!metadata?.frameworkSource) {
    return { status: 'skip', warnings: [] };
  }

  const { runProjectQualityCheck } = await loadQualityCheck(metadata.frameworkSource);
  const result = runProjectQualityCheck(projectRoot);
  if (result.skipped) {
    return { status: 'skip', warnings: [] };
  }

  if (result.warnings.length === 0) {
    const checkpoint = checkpointGit(projectRoot);
    return { status: 'pass', warnings: [], checkpoint };
  }

  return { status: 'fail', warnings: result.warnings };
}

let input = '';
for await (const chunk of process.stdin) input += chunk;

let parsed;
try {
  parsed = JSON.parse(input);
} catch {
  process.exit(0);
}

const result = await runSlideQualityHook(parsed?.cwd || process.cwd());
if (result.status === 'skip' || result.status === 'pass') {
  process.exit(0);
}

for (const warning of result.warnings || []) {
  process.stderr.write(`\n⚠ ${warning.rule} [${warning.slideId}]\n  ${warning.message}\n  Fix: ${warning.fix}\n`);
}
process.stderr.write(`\n${result.warnings.length} quality warning(s). Fix them before stopping.\n`);
process.exit(2);
