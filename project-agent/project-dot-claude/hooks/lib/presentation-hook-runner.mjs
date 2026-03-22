import { existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkpointGit } from './git-checkpoint.mjs';

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

async function importFrameworkModule(frameworkRoot, relativePath) {
  const moduleUrl = pathToFileURL(resolve(frameworkRoot, relativePath)).href;
  return import(moduleUrl);
}

function formatQualityWarning(warning) {
  return `${warning.rule} [${warning.slideId}] ${warning.message} Fix: ${warning.fix}`;
}

export async function runPresentationStopHook(projectRoot) {
  const metadata = loadProjectMetadata(projectRoot);
  if (!metadata?.frameworkSource) {
    return { status: 'skip', messages: [] };
  }

  const slidesDir = resolve(projectRoot, 'slides');
  if (!existsSync(slidesDir)) {
    return { status: 'skip', messages: [] };
  }

  const frameworkRoot = metadata.frameworkSource;
  const [
    { ensurePresentationPackageFiles },
    { validatePresentationIntentFile },
    { runDeckCheck },
  ] = await Promise.all([
    importFrameworkModule(frameworkRoot, 'framework/runtime/presentation-package.js'),
    importFrameworkModule(frameworkRoot, 'framework/runtime/presentation-intent.js'),
    importFrameworkModule(frameworkRoot, 'framework/runtime/services/check-service.mjs'),
  ]);

  const { manifest } = ensurePresentationPackageFiles(projectRoot);
  const { issues } = validatePresentationIntentFile(projectRoot, manifest);
  if (issues.length > 0) {
    return {
      status: 'fail',
      messages: issues,
    };
  }

  const hookOutputDir = mkdtempSync(join(tmpdir(), 'pf-stop-hook-check-'));
  try {
    const check = await runDeckCheck({ projectRoot }, { outputDir: hookOutputDir });
    if (check.status !== 'pass') {
      return {
        status: 'fail',
        messages: check.failures.length > 0 ? check.failures : ['Presentation runtime check failed.'],
      };
    }

    if (Array.isArray(check.qualityWarnings) && check.qualityWarnings.length > 0) {
      return {
        status: 'fail',
        messages: check.qualityWarnings.map(formatQualityWarning),
      };
    }

    const checkpoint = metadata.historyPolicy === 'manual'
      ? { committed: false, commit: '' }
      : checkpointGit(projectRoot);
    return {
      status: 'pass',
      messages: [],
      checkpoint,
    };
  } finally {
    rmSync(hookOutputDir, { recursive: true, force: true });
  }
}
