import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { CANVAS_STAGE } from '../canvas/canvas-contract.mjs';
import {
  runAuditAll,
  runBoundaryAudit,
  runCanvasAudit,
  runThemeAudit,
} from './audit-service.js';
import { getProjectPaths, toRelativeWithin } from './deck-paths.js';
import { renderPresentationHtml } from './deck-assemble.js';
import {
  ensurePresentationPackageFiles,
  PRESENTATION_PACKAGE_WRITE_ZONES,
  withPresentationPackageMutationBoundary,
} from './presentation-package.js';
import { readArtifacts, readRenderState } from './presentation-runtime-state.js';
import { renderPresentationFailureHtml } from './preview-state-page.js';
import { getProjectState } from './project-state.js';
import {
  capturePresentation as capturePresentationOperation,
  exportPresentation as exportPresentationOperation,
  finalizePresentation,
  validatePresentation as validatePresentationOperation,
} from './services/presentation-ops-service.mjs';

export class PresentationCoreError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'PresentationCoreError';
    this.status = options.status ?? 'unsupported';
    this.extra = options.extra ?? {};
  }
}

function createCoreError(message, options = {}) {
  return new PresentationCoreError(message, options);
}

const CORE_AUTHORED_CONTENT_GLOBS = Object.freeze([
  'brief.md',
  'outline.md',
  'theme.css',
  'slides/**/slide.html',
  'slides/**/slide.css',
  '.presentation/intent.json',
]);

const CORE_SYSTEM_WRITE_GLOBS = Object.freeze([
  '.presentation/package.generated.json',
  '.presentation/runtime/*.json',
  'outputs/finalized/**',
  'outputs/exports/**',
]);

const CORE_IMMUTABLE_AUTHORED_ROOT_FILES = Object.freeze([
  'brief.md',
  'outline.md',
  'theme.css',
  '.presentation/intent.json',
]);

const CORE_IMMUTABLE_AUTHORED_SLIDE_FILENAMES = Object.freeze([
  'slide.html',
  'slide.css',
]);

const CORE_MUTATION_BOUNDARY = Object.freeze({
  allowAuthoredContentWrites: false,
  protectedZone: PRESENTATION_PACKAGE_WRITE_ZONES.AUTHORED_CONTENT,
  protectedAuthoredContent: CORE_AUTHORED_CONTENT_GLOBS,
  allowedSystemWrites: CORE_SYSTEM_WRITE_GLOBS,
  reason: 'Presentation core queries and delivery operations may refresh generated structure and runtime evidence, but they must not author source or intent files.',
});

function runInsideCoreMutationBoundary(operation) {
  return withPresentationPackageMutationBoundary(CORE_MUTATION_BOUNDARY, operation);
}

function snapshotAuthoredContentFile(projectRoot, relativePath, snapshot) {
  const absolutePath = resolve(projectRoot, relativePath);
  snapshot.set(relativePath, existsSync(absolutePath) ? readFileSync(absolutePath, 'utf8') : null);
}

function snapshotAuthoredSlideFiles(projectRoot, relativeDir, snapshot) {
  const absoluteDir = resolve(projectRoot, relativeDir);
  if (!existsSync(absoluteDir)) {
    return;
  }

  const entries = readdirSync(absoluteDir, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const childRelativePath = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) {
      snapshotAuthoredSlideFiles(projectRoot, childRelativePath, snapshot);
      continue;
    }

    if (entry.isFile() && CORE_IMMUTABLE_AUTHORED_SLIDE_FILENAMES.includes(entry.name)) {
      snapshotAuthoredContentFile(projectRoot, childRelativePath, snapshot);
    }
  }
}

function snapshotCoreAuthoredContent(projectRoot) {
  const snapshot = new Map();
  for (const relativePath of CORE_IMMUTABLE_AUTHORED_ROOT_FILES) {
    snapshotAuthoredContentFile(projectRoot, relativePath, snapshot);
  }
  snapshotAuthoredSlideFiles(projectRoot, 'slides', snapshot);
  return snapshot;
}

function getChangedAuthoredPaths(beforeSnapshot, afterSnapshot) {
  const changedPaths = [];
  const allPaths = new Set([...beforeSnapshot.keys(), ...afterSnapshot.keys()]);

  for (const relativePath of [...allPaths].sort((left, right) => left.localeCompare(right))) {
    if (beforeSnapshot.get(relativePath) !== afterSnapshot.get(relativePath)) {
      changedPaths.push(relativePath);
    }
  }

  return changedPaths;
}

async function enforceCoreAuthoredContentImmutability(projectRoot, operationName, operation) {
  const beforeSnapshot = snapshotCoreAuthoredContent(projectRoot);
  let failure = null;
  let result;

  try {
    result = await operation();
  } catch (error) {
    failure = error;
  }

  const changedPaths = getChangedAuthoredPaths(beforeSnapshot, snapshotCoreAuthoredContent(projectRoot));
  if (changedPaths.length > 0) {
    throw createCoreError(`Presentation core ${operationName} must not modify authored content: ${changedPaths.join(', ')}.`, {
      extra: {
        scope: {
          kind: 'authored-content',
          operation: operationName,
          projectRoot,
        },
        changedPaths,
        failureMessage: failure?.message || null,
      },
    });
  }

  if (failure) {
    throw failure;
  }

  return result;
}

function buildStatusResult(state) {
  const blockers = state.lastPolicyError ? [state.lastPolicyError] : [];

  return {
    kind: 'presentation-status',
    projectRoot: state.projectRoot,
    workflow: state.workflow,
    summary: state.statusSummary,
    blockers,
    facets: state.facets,
    nextBoundary: state.nextBoundary,
    nextFocus: state.nextFocus,
    evidence: [
      '.presentation/runtime/render-state.json',
      '.presentation/runtime/artifacts.json',
    ],
    freshness: {
      relativeToSource: state.facets?.evidence || 'unknown',
    },
  };
}

function buildPreviewResult(projectRoot, services) {
  const paths = services.getProjectPaths(projectRoot);

  try {
    const assembled = services.renderPresentationHtml({ projectRoot: paths.projectRootAbs });
    return {
      kind: 'slides',
      projectRoot: paths.projectRootAbs,
      title: assembled.title,
      slideIds: assembled.slideIds,
      html: assembled.html,
      viewport: { ...services.canvasStage.viewport },
    };
  } catch (error) {
    const fallback = services.renderPresentationFailureHtml({ projectRoot: paths.projectRootAbs }, error);
    return {
      kind: fallback.kind,
      projectRoot: paths.projectRootAbs,
      title: paths.title || 'Preview',
      slideIds: [],
      html: fallback.html,
      viewport: null,
    };
  }
}

function getAuditRunner(family, services) {
  switch (family) {
    case 'theme':
      return services.runThemeAudit;
    case 'canvas':
      return services.runCanvasAudit;
    case 'boundaries':
      return services.runBoundaryAudit;
    case 'all':
      return services.runAuditAll;
    default:
      throw createCoreError(`Unsupported audit family "${family}".`, {
        extra: {
          scope: { kind: 'audit-family', family },
        },
      });
  }
}

function timestampSegment() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function buildExportScope(target, projectRoot) {
  return {
    kind: 'export',
    format: target,
    projectRoot,
  };
}

function normalizeRequestedSlideIds(slideIds) {
  return Array.isArray(slideIds)
    ? slideIds.map((slideId) => String(slideId || '').trim()).filter(Boolean)
    : [];
}

function getMissingSlideSelections(manifest, slideIds) {
  const availableSlideIds = new Set(manifest.slides.map((slide) => slide.id));
  return slideIds.filter((slideId) => !availableSlideIds.has(slideId));
}

function toProjectRelativeOutputPath(projectRoot, pathValue, scope) {
  try {
    return toRelativeWithin(projectRoot, resolve(projectRoot, pathValue));
  } catch {
    throw createCoreError(`Export outputs must stay within the project root: ${projectRoot}.`, {
      extra: { scope },
    });
  }
}

function toProjectRelativeOutputDir(paths, outputDir, scope) {
  try {
    return toRelativeWithin(paths.projectRootAbs, resolve(paths.projectRootAbs, outputDir));
  } catch {
    throw createCoreError(`Export output directories must stay within the project root: ${paths.projectRootAbs}.`, {
      extra: { scope },
    });
  }
}

function toProjectRelativeOutputFile(paths, outputDir, outputFile, scope) {
  const requestedOutputFile = String(outputFile || '').trim();
  if (!requestedOutputFile) {
    return '';
  }

  const outputDirAbs = resolve(paths.projectRootAbs, outputDir);

  try {
    return toRelativeWithin(outputDirAbs, resolve(outputDirAbs, requestedOutputFile));
  } catch {
    throw createCoreError(`Export output files must stay within the requested output directory: ${outputDirAbs}.`, {
      extra: { scope },
    });
  }
}

function toExportRequestCoreError(error, scope) {
  if (error instanceof PresentationCoreError) {
    return error;
  }

  const message = error?.message || '';
  if (
    message === 'Export format must be either "pdf" or "png".'
    || message === 'Select at least one slide to export.'
    || message === 'Choose a destination folder before exporting.'
    || message.startsWith('Unknown slide selections: ')
  ) {
    return createCoreError(message, {
      status: 'invalid-request',
      extra: { scope },
    });
  }

  return null;
}

export function createPresentationCore(deps = {}) {
  const services = {
    canvasStage: CANVAS_STAGE,
    getProjectPaths,
    ensurePresentationPackageFiles,
    readRenderState,
    readArtifacts,
    getProjectState,
    renderPresentationHtml,
    renderPresentationFailureHtml,
    runThemeAudit,
    runCanvasAudit,
    runBoundaryAudit,
    runAuditAll,
    finalizePresentation,
    exportPresentation: exportPresentationOperation,
    validatePresentation: validatePresentationOperation,
    capturePresentation: capturePresentationOperation,
    ...deps,
  };

  return {
    inspectPackage(projectRoot, options = {}) {
      return runInsideCoreMutationBoundary(() => {
        const target = String(options.target || 'package').trim().toLowerCase() || 'package';
        if (target !== 'package') {
          throw createCoreError(`Unsupported inspect target "${target}". Only "package" is available in Task 9.`, {
            extra: {
              scope: { kind: 'inspect-target', target },
            },
          });
        }

        const { paths, manifest } = services.ensurePresentationPackageFiles(projectRoot);
        const renderState = services.readRenderState(paths.projectRootAbs);
        const artifacts = services.readArtifacts(paths.projectRootAbs);
        const status = buildStatusResult(services.getProjectState(paths.projectRootAbs));

        return {
          kind: 'presentation-package',
          projectRoot: paths.projectRootAbs,
          title: paths.title,
          slug: paths.slug,
          manifest,
          renderState,
          artifacts,
          status,
          evidence: [
            paths.packageManifestRel,
            paths.renderStateRel,
            paths.artifactsRel,
          ],
          freshness: {
            relativeToSource: status.freshness.relativeToSource,
          },
        };
      });
    },

    getStatus(projectRoot) {
      return runInsideCoreMutationBoundary(() => buildStatusResult(services.getProjectState(projectRoot)));
    },

    getPreview(projectRoot) {
      return runInsideCoreMutationBoundary(() => buildPreviewResult(projectRoot, services));
    },

    async runAudit(projectRoot, options = {}) {
      return await runInsideCoreMutationBoundary(async () => {
        const family = String(options.family || 'all').trim().toLowerCase() || 'all';
        const runner = getAuditRunner(family, services);
        const result = await runner(projectRoot, {
          slideId: options.slideId || null,
          path: options.path || null,
          deck: Boolean(options.deck),
          severity: options.severity || 'error',
          strict: Boolean(options.strict),
          render: Boolean(options.render),
        });

        return {
          kind: 'presentation-audit',
          family: result.family,
          projectRoot: result.scope.projectRoot,
          slideId: result.scope.slideId ?? null,
          status: result.status,
          issueCount: result.issueCount,
          issues: result.issues,
          nextFocus: result.nextFocus,
          families: result.families,
        };
      });
    },

    async validatePresentation(projectRoot, options = {}) {
      return await runInsideCoreMutationBoundary(async () => {
        const target = String(options.target || 'run').trim().toLowerCase() || 'run';
        if (target !== 'run') {
          throw createCoreError(`Unsupported validate target "${target}".`, {
            extra: {
              scope: { kind: 'validate-target', target },
            },
          });
        }

        const { target: ignoredTarget, ...request } = options;
        const paths = services.getProjectPaths(projectRoot);
        const result = await services.validatePresentation({ projectRoot: paths.projectRootAbs }, request);

        return {
          kind: 'presentation-validation',
          projectRoot: paths.projectRootAbs,
          ...result,
          failures: result.failures || [],
          evidenceUpdated: [paths.renderStateRel],
        };
      });
    },

    async capturePresentation(projectRoot, options = {}) {
      return await runInsideCoreMutationBoundary(async () => {
        const target = String(options.target || 'run').trim().toLowerCase() || 'run';
        if (target !== 'run') {
          throw createCoreError(`Unsupported capture target "${target}".`, {
            extra: {
              scope: { kind: 'capture-target', target },
            },
          });
        }

        const { target: ignoredTarget, outputDir, ...request } = options;
        const paths = services.getProjectPaths(projectRoot);
        const result = await services.capturePresentation({ projectRoot: paths.projectRootAbs }, outputDir, request);

        return {
          kind: 'presentation-capture',
          projectRoot: paths.projectRootAbs,
          ...result,
        };
      });
    },

    async finalize(projectRoot, options = {}) {
      return await runInsideCoreMutationBoundary(async () => {
        const target = String(options.target || 'run').trim().toLowerCase() || 'run';
        if (target !== 'run') {
          throw createCoreError(`Unsupported finalize target "${target}".`, {
            extra: {
              scope: { kind: 'finalize-target', target },
            },
          });
        }

        const { target: ignoredTarget, ...request } = options;
        const paths = services.getProjectPaths(projectRoot);

        return await enforceCoreAuthoredContentImmutability(paths.projectRootAbs, 'finalize', async () => {
          const result = await services.finalizePresentation({ projectRoot }, request);

          return {
            kind: 'presentation-finalize',
            projectRoot: paths.projectRootAbs,
            status: result.status,
            outputs: result.outputs,
            evidenceUpdated: [
              paths.renderStateRel,
              paths.artifactsRel,
            ],
            issues: result.issues || [],
          };
        });
      });
    },

    async exportPresentation(projectRoot, options = {}) {
      return await runInsideCoreMutationBoundary(async () => {
        const paths = services.getProjectPaths(projectRoot);

        return await enforceCoreAuthoredContentImmutability(paths.projectRootAbs, 'export', async () => {
          const target = String(options.target || '').trim().toLowerCase();
          if (!['pdf', 'screenshots'].includes(target)) {
            throw createCoreError(`Unsupported export target "${target || '(missing)'}". Use "pdf" or "screenshots".`, {
              extra: {
                scope: { kind: 'export-target', target: target || null },
              },
            });
          }

          const inspection = await this.inspectPackage(paths.projectRootAbs, { target: 'package' });
          const manifest = inspection.manifest;
          const requestedSlideIds = normalizeRequestedSlideIds(options.slideIds);
          const slideIds = requestedSlideIds.length > 0
            ? requestedSlideIds
            : manifest.slides.map((slide) => slide.id);
          const scope = buildExportScope(target, paths.projectRootAbs);

          if (slideIds.length === 0) {
            throw createCoreError('No slides are available to export.', {
              status: 'unavailable',
              extra: { scope },
            });
          }

          const missingSlideIds = getMissingSlideSelections(manifest, slideIds);
          if (missingSlideIds.length > 0) {
            throw createCoreError(`Unknown slide selections: ${missingSlideIds.join(', ')}`, {
              status: 'invalid-request',
              extra: { scope },
            });
          }

          const format = target === 'pdf' ? 'pdf' : 'png';
          const outputDir = options.outputDir
            ? toProjectRelativeOutputDir(paths, options.outputDir, scope)
            : `${paths.exportsOutputDirRel}/${timestampSegment()}/${target}`;
          const outputFile = toProjectRelativeOutputFile(paths, outputDir, options.outputFile, scope);

          let result;
          try {
            result = await services.exportPresentation(
              { projectRoot: paths.projectRootAbs },
              {
                format,
                slideIds,
                outputDir,
                outputFile,
              },
              { cwd: paths.projectRootAbs }
            );
          } catch (error) {
            const coreError = toExportRequestCoreError(error, scope);
            if (coreError) {
              throw coreError;
            }
            throw error;
          }

          return {
            kind: 'presentation-export',
            projectRoot: paths.projectRootAbs,
            status: 'pass',
            scope,
            outputDir: toProjectRelativeOutputPath(paths.projectRootAbs, result.outputDir, scope),
            artifacts: (result.outputPaths || [])
              .map((outputPath) => toProjectRelativeOutputPath(paths.projectRootAbs, outputPath, scope)),
            evidenceUpdated: [paths.artifactsRel],
            issues: [],
          };
        });
      });
    },
  };
}
