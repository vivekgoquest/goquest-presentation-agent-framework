#!/usr/bin/env node

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

async function loadProjectHookService(projectRoot) {
  const metadata = loadProjectMetadata(projectRoot);
  if (!metadata?.frameworkSource) {
    return null;
  }

  const moduleUrl = pathToFileURL(
    resolve(metadata.frameworkSource, 'framework', 'application', 'project-hook-service.mjs')
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
let result;
try {
  const service = await loadProjectHookService(projectRoot);
  if (!service) {
    process.exit(0);
  }
  result = await service.runProjectStopHookWorkflow(projectRoot);
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
}

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
