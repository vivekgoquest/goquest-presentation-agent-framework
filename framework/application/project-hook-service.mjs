import { existsSync, readFileSync, rmSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createActionWorkflowService } from './action-service.mjs';
import { createPresentationActionAdapter } from './presentation-action-adapter.mjs';
import { ensurePresentationPackageFiles } from '../runtime/presentation-package.js';
import { validatePresentationIntentFile } from '../runtime/presentation-intent.js';

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

function buildCommitSummary(projectRoot) {
  const diff = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const changed = diff.split('\n').filter(Boolean);
  if (changed.length === 0) {
    return '';
  }
  if (changed.length <= 3) {
    return changed.join(', ');
  }
  return `${changed.slice(0, 3).join(', ')} +${changed.length - 3} more`;
}

function checkpointProjectGit(projectRoot) {
  try {
    execFileSync('git', ['add', '-A'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      execFileSync('git', ['diff', '--cached', '--quiet'], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { committed: false, commit: '' };
    } catch {
      const summary = buildCommitSummary(projectRoot);
      execFileSync('git', ['commit', '-m', `Update: ${summary}`], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      return { committed: true, commit };
    }
  } catch {
    return { committed: false, commit: '' };
  }
}

async function runValidatePresentationAction(projectRoot, outputDir) {
  const workflowService = createActionWorkflowService({
    presentationAdapter: createPresentationActionAdapter(),
  });

  return await workflowService.invokeAction('validate_presentation', {
    trigger: 'hook',
    target: {
      kind: 'project',
      projectRootAbs: projectRoot,
    },
    args: {
      outputDir,
    },
    outputPaths: {
      outputDirAbs: outputDir,
    },
  });
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
    let validation;
    try {
      validation = await runValidatePresentationAction(projectRoot, hookOutputDir);
    } catch (err) {
      return {
        status: 'fail',
        messages: [err instanceof Error ? err.message : String(err)],
      };
    }

    if (validation.status !== 'pass') {
      const messages = Array.isArray(validation.failures) && validation.failures.length > 0
        ? validation.failures
        : [validation.detail || 'Presentation validation failed.'];

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
