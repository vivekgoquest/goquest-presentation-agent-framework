#!/usr/bin/env node

// Legacy quality-only helper. The stop hook now runs through
// run-presentation-stop-workflow.mjs so package structure, intent, and runtime
// evidence stay synchronized before quality warnings can stop the agent.

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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

async function loadProjectHookService(frameworkRoot) {
  const moduleUrl = pathToFileURL(
    resolve(frameworkRoot, 'framework', 'application', 'project-hook-service.mjs')
  ).href;
  return import(moduleUrl);
}

let input = '';
for await (const chunk of process.stdin) input += chunk;

let parsed;
try {
  parsed = JSON.parse(input);
} catch {
  process.exit(0);
}

const projectRoot = parsed?.cwd || process.cwd();
const metadata = loadProjectMetadata(projectRoot);
if (!metadata?.frameworkSource) {
  process.exit(0);
}

let result;
try {
  const service = await loadProjectHookService(metadata.frameworkSource);
  result = await service.runProjectQualityHookWorkflow(projectRoot);
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
}
if (result.status === 'skip' || result.status === 'pass') {
  process.exit(0);
}

for (const warning of result.warnings || []) {
  process.stderr.write(`\n⚠ ${warning.rule} [${warning.slideId}]\n  ${warning.message}\n  Fix: ${warning.fix}\n`);
}
process.stderr.write(`\n${result.warnings.length} quality warning(s). Fix them before stopping.\n`);
process.exit(2);
