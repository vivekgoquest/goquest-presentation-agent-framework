import { existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ensurePresentationPackageFiles } from '../runtime/presentation-package.js';
import { validatePresentationIntentFile } from '../runtime/presentation-intent.js';
import { runProjectQualityCheck } from '../runtime/project-quality-check.mjs';
import { runDeckCheck } from '../runtime/services/check-service.mjs';
import { checkpointProjectGit } from './project-history-service.mjs';

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

function formatQualityWarning(warning) {
  return `${warning.rule} [${warning.slideId}] ${warning.message} Fix: ${warning.fix}`;
}

function shouldSkipHook(projectRoot, metadata) {
  if (!metadata?.frameworkSource) {
    return true;
  }
  const slidesDir = resolve(projectRoot, 'slides');
  return !existsSync(slidesDir);
}

function maybeCheckpointProject(projectRoot, metadata) {
  if (metadata?.historyPolicy === 'manual') {
    return { committed: false, commit: '' };
  }
  return checkpointProjectGit(projectRoot);
}

export async function runProjectStopHookWorkflow(projectRoot) {
  const metadata = loadProjectMetadata(projectRoot);
  if (shouldSkipHook(projectRoot, metadata)) {
    return { status: 'skip', messages: [] };
  }

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
    let check;
    try {
      check = await runDeckCheck({ projectRoot }, { outputDir: hookOutputDir });
    } catch (err) {
      return {
        status: 'fail',
        messages: [err instanceof Error ? err.message : String(err)],
      };
    }

    if (check.status !== 'pass') {
      const messages = check.failures.length > 0
        ? check.failures
        : Array.isArray(check.qualityWarnings) && check.qualityWarnings.length > 0
          ? check.qualityWarnings.map(formatQualityWarning)
          : ['Presentation runtime check failed.'];

      return {
        status: 'fail',
        messages,
      };
    }

    const checkpoint = maybeCheckpointProject(projectRoot, metadata);
    return {
      status: 'pass',
      messages: [],
      checkpoint,
    };
  } finally {
    rmSync(hookOutputDir, { recursive: true, force: true });
  }
}

export async function runProjectQualityHookWorkflow(projectRoot) {
  const metadata = loadProjectMetadata(projectRoot);
  if (shouldSkipHook(projectRoot, metadata)) {
    return { status: 'skip', warnings: [] };
  }

  const result = runProjectQualityCheck(projectRoot);
  if (result.skipped) {
    return { status: 'skip', warnings: [] };
  }

  if (result.warnings.length === 0) {
    const checkpoint = maybeCheckpointProject(projectRoot, metadata);
    return {
      status: 'pass',
      warnings: [],
      checkpoint,
    };
  }

  return {
    status: 'fail',
    warnings: result.warnings,
  };
}
