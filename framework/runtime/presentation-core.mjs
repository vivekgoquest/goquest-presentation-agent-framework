import { CANVAS_STAGE } from '../canvas/canvas-contract.mjs';
import {
  runAuditAll,
  runBoundaryAudit,
  runCanvasAudit,
  runThemeAudit,
} from './audit-service.js';
import { getProjectPaths } from './deck-paths.js';
import { renderPresentationHtml } from './deck-assemble.js';
import { ensurePresentationPackageFiles } from './presentation-package.js';
import { readArtifacts, readRenderState } from './presentation-runtime-state.js';
import { renderPresentationFailureHtml } from './preview-state-page.js';
import { getProjectState } from './project-state.js';
import {
  exportPresentation as exportPresentationOperation,
  finalizePresentation,
} from './services/presentation-ops-service.mjs';

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
      throw new Error(`Unsupported audit family "${family}".`);
  }
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
    ...deps,
  };

  return {
    async inspectPackage(projectRoot) {
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
    },

    async getStatus(projectRoot) {
      return buildStatusResult(services.getProjectState(projectRoot));
    },

    async getPreview(projectRoot) {
      return buildPreviewResult(projectRoot, services);
    },

    async runAudit(projectRoot, options = {}) {
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
    },

    async finalize(projectRoot, options = {}) {
      return services.finalizePresentation({ projectRoot }, options);
    },

    async exportPresentation(projectRoot, options = {}) {
      const { cwd, ...request } = options;
      return services.exportPresentation(
        { projectRoot },
        request,
        cwd ? { cwd } : {}
      );
    },
  };
}
