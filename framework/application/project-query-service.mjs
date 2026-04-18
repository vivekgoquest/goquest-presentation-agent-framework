import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  LONG_DECK_OUTLINE_THRESHOLD,
  PROJECT_METADATA_FILENAME,
  PROJECT_PREVIEW_PATH,
  PROJECT_SYSTEM_DIRNAME,
  createPresentationTarget,
  getPresentationOutputPaths,
  getProjectPaths,
  readProjectCompatibilityMetadata,
} from '../runtime/deck-paths.js';
import { createPresentationCore } from '../runtime/presentation-core.mjs';
import { buildProjectTreeNode } from '../runtime/project-tree.js';
import { createProjectScaffold } from './project-scaffold-service.mjs';

function assertProjectDirectory(projectRootAbs) {
  if (!projectRootAbs || projectRootAbs === resolve('/')) {
    throw new Error('Provide a valid project folder path.');
  }

  if (!existsSync(projectRootAbs) || !statSync(projectRootAbs).isDirectory()) {
    throw new Error(`Project folder does not exist: ${projectRootAbs}`);
  }
}

function requireProjectRootInput(value, message) {
  const projectRoot = String(value || '').trim();
  if (!projectRoot) {
    throw new Error(message);
  }
  return projectRoot;
}

function assertSlideCount(value) {
  const slideCount = Number.parseInt(String(value ?? '3'), 10);
  if (!Number.isFinite(slideCount) || slideCount < 1 || slideCount > LONG_DECK_OUTLINE_THRESHOLD) {
    throw new Error(
      `Shell-less v1 init currently supports 1-${LONG_DECK_OUTLINE_THRESHOLD} slides. Long-deck scaffolds are not supported yet.`
    );
  }
  return slideCount;
}

function normalizePreviewHtml(html = '') {
  return String(html || '')
    .replaceAll('/project-files/', 'presentation://project-files/')
    .replaceAll('/project-framework/', 'presentation://project-framework/');
}

function toLegacyProjectStatus(workflow = '') {
  switch (workflow) {
    case 'onboarding':
      return 'onboarding';
    case 'blocked':
      return 'policy_error';
    case 'ready_for_finalize':
      return 'ready_to_finalize';
    case 'finalized':
      return 'finalized';
    case 'authoring':
    default:
      return 'in_progress';
  }
}

function toAuthoringStep(focus) {
  switch (focus) {
    case 'brief.md':
      return 'Complete brief.md with the normalized user request';
    case 'outline.md':
      return 'Complete outline.md with the long-deck story arc';
    case 'slides/':
      return 'Finish the remaining slide sources';
    default:
      return `Continue authoring: ${focus}`;
  }
}

function buildNextStep(status = {}) {
  if (status.workflow === 'blocked') {
    return 'Run presentation audit all and fix the reported issues before preview or export.';
  }
  if (status.facets?.delivery === 'finalized_stale') {
    return 'Run presentation export again to refresh the canonical root PDF for the latest source.';
  }
  if (status.workflow === 'ready_for_finalize') {
    return 'Run presentation export to generate the canonical root PDF.';
  }
  if (status.workflow === 'finalized') {
    return 'Review the canonical root PDF or export updated artifacts as needed.';
  }

  const nextFocus = Array.isArray(status.nextFocus) ? status.nextFocus.filter(Boolean) : [];
  if (nextFocus.length > 0) {
    const authoringSteps = nextFocus.map((focus) => toAuthoringStep(focus));
    return `${authoringSteps.join('; ')}.`;
  }

  return 'Continue authoring the presentation package.';
}

function buildRemainingSlides(manifest = {}, renderState = null) {
  const slides = Array.isArray(manifest.slides) ? manifest.slides : [];
  const renderedSlideIds = new Set(Array.isArray(renderState?.slideIds) ? renderState.slideIds : []);

  return slides
    .filter((slide) => !renderedSlideIds.has(slide.id))
    .map((slide) => ({
      slideId: slide.id,
      relativePath: slide.html || '',
      slideDir: slide.dir || '',
    }));
}

function buildProjectState(inspection = {}, status = {}) {
  const manifest = inspection.manifest || {};
  const renderState = inspection.renderState || null;
  const artifacts = inspection.artifacts || {};
  const slides = Array.isArray(manifest.slides) ? manifest.slides : [];
  const remainingSlides = buildRemainingSlides(manifest, renderState);
  const slidesComplete = Math.max(0, slides.length - remainingSlides.length);
  const blockers = Array.isArray(status.blockers) ? status.blockers.filter(Boolean) : [];
  const finalized = artifacts.finalized || {};

  return {
    kind: 'project',
    projectRoot: inspection.projectRoot || status.projectRoot || '',
    title: inspection.title || '',
    slug: inspection.slug || '',
    workflow: status.workflow || 'authoring',
    status: toLegacyProjectStatus(status.workflow),
    facets: status.facets || {
      delivery: 'not_finalized',
      evidence: 'unknown',
    },
    statusSummary: status.summary || '',
    nextBoundary: status.nextBoundary || 'finalize',
    nextFocus: Array.isArray(status.nextFocus) ? status.nextFocus : [],
    briefComplete: Boolean(manifest.source?.brief?.complete),
    outlineRequired: Boolean(manifest.source?.outline?.required),
    outlineComplete: Boolean(manifest.source?.outline?.complete),
    slidesTotal: manifest.counts?.slidesTotal ?? slides.length,
    slidesComplete,
    remainingSlides,
    pdfReady: Boolean(finalized.pdf?.path),
    reportReady: Boolean(finalized.report?.path),
    summaryReady: Boolean(finalized.summary?.path),
    packageStateAvailable: Boolean(inspection.manifest),
    runtimeEvidenceAvailable: Boolean(renderState),
    lastRenderStatus: renderState?.status || 'unknown',
    lastCheckedAt: renderState?.lastCheckedAt || renderState?.generatedAt || '',
    lastPolicyError: blockers[0] || '',
    policyCategory: blockers.length > 0 ? 'authoring_violation' : null,
    nextStep: buildNextStep(status),
  };
}

function toSlideDescriptor(slide = {}) {
  const dirName = String(slide.dir || '').split('/').filter(Boolean).at(-1) || slide.id || '';
  return {
    id: slide.id,
    dirName,
    orderLabel: slide.orderLabel,
    orderValue: slide.orderValue,
  };
}

export function createProjectQueryService(options = {}) {
  const frameworkRoot = options.frameworkRoot || process.cwd();
  const core = options.core || createPresentationCore();
  const onProjectChanged = typeof options.onProjectChanged === 'function'
    ? options.onProjectChanged
    : () => {};

  let activeProjectTarget = null;
  let activeProjectPaths = null;

  function setActiveProject(projectRootAbs) {
    activeProjectTarget = createPresentationTarget({ projectRoot: projectRootAbs });
    activeProjectPaths = getProjectPaths(projectRootAbs);
    onProjectChanged({
      target: activeProjectTarget,
      paths: activeProjectPaths,
    });
    return activeProjectPaths;
  }

  function requireActiveProjectPaths() {
    if (!activeProjectPaths) {
      throw new Error('Open a presentation project first.');
    }
    return activeProjectPaths;
  }

  function requireActiveProjectTarget() {
    if (!activeProjectTarget) {
      throw new Error('Open a presentation project first.');
    }
    return activeProjectTarget;
  }

  function inspectActiveProject() {
    const projectPaths = requireActiveProjectPaths();
    return core.inspectPackage(projectPaths.projectRootAbs, { target: 'package' });
  }

  function getProjectStatus(projectRootInput = null) {
    const projectRootAbs = projectRootInput || requireActiveProjectPaths().projectRootAbs;
    return core.getStatus(projectRootAbs);
  }

  function getProjectPreview() {
    return core.getPreview(requireActiveProjectPaths().projectRootAbs);
  }

  function getMeta() {
    if (!activeProjectPaths) {
      return {
        active: false,
        kind: 'none',
        projectRoot: '',
        previewPath: PROJECT_PREVIEW_PATH,
      };
    }

    const compatibilityMetadata = readProjectCompatibilityMetadata(activeProjectPaths.projectRootAbs);

    return {
      active: true,
      kind: 'project',
      projectRoot: activeProjectPaths.projectRootAbs,
      title: activeProjectPaths.title,
      slug: activeProjectPaths.slug,
      previewPath: PROJECT_PREVIEW_PATH,
      projectMode: activeProjectPaths.metadata.projectMode,
      frameworkMode: activeProjectPaths.frameworkMode,
      frameworkVersion: activeProjectPaths.metadata.frameworkVersion,
      frameworkCopiedAt: compatibilityMetadata.frameworkCopiedAt,
      canvasPolicy: activeProjectPaths.metadata.canvasPolicy,
      packageModel: 'deterministic',
      outputsPath: activeProjectPaths.outputsDirAbs,
    };
  }

  function getState() {
    if (!activeProjectPaths) {
      return {
        status: 'no_project',
        projectRoot: '',
      };
    }

    const inspection = inspectActiveProject();
    const status = getProjectStatus(activeProjectPaths.projectRootAbs);
    return buildProjectState(inspection, status);
  }

  function getFiles() {
    const projectPaths = requireActiveProjectPaths();
    return {
      root: projectPaths.projectRootAbs,
      tree: buildProjectTreeNode(projectPaths.projectRootAbs, projectPaths.projectRootAbs),
    };
  }

  function getSlides() {
    const inspection = inspectActiveProject();
    const slides = Array.isArray(inspection.manifest?.slides) ? inspection.manifest.slides : [];
    return slides.map((slide) => toSlideDescriptor(slide));
  }

  function getOutputPaths() {
    return getPresentationOutputPaths(requireActiveProjectTarget());
  }

  function buildPreviewDocument() {
    const preview = getProjectPreview();
    return {
      html: normalizePreviewHtml(preview.html),
      slideIds: Array.isArray(preview.slideIds) ? preview.slideIds : [],
      title: preview.title || requireActiveProjectPaths().title || 'Preview',
      kind: preview.kind || 'slides',
      viewport: preview.viewport || null,
    };
  }

  function getPreviewDocument() {
    return buildPreviewDocument();
  }

  function getPreviewMeta() {
    const { slideIds, title, kind, viewport } = buildPreviewDocument();
    return { slideIds, title, kind, viewport };
  }

  function refreshPreview() {
    return getPreviewMeta();
  }

  function createProject(payload = {}) {
    const projectRootAbs = resolve(
      requireProjectRootInput(payload.projectRoot, 'Choose a target folder for the presentation project.')
    );
    const slideCount = assertSlideCount(payload.slides);
    const copyFramework = Boolean(payload.copyFramework);

    const result = createProjectScaffold(
      { projectRoot: projectRootAbs },
      { slideCount, copyFramework },
      { frameworkRoot }
    );

    setActiveProject(projectRootAbs);

    return {
      result,
      meta: getMeta(),
      state: getState(),
      slides: getSlides(),
      files: getFiles(),
    };
  }

  function openProject(payload = {}) {
    const projectRootAbs = resolve(
      requireProjectRootInput(payload.projectRoot, 'Choose a presentation project folder.')
    );
    assertProjectDirectory(projectRootAbs);

    const metadataAbs = resolve(projectRootAbs, PROJECT_SYSTEM_DIRNAME, PROJECT_METADATA_FILENAME);
    if (!existsSync(metadataAbs)) {
      const error = new Error('This folder is not initialized as a presentation project yet.');
      error.code = 'PROJECT_NOT_INITIALIZED';
      error.needsInitialization = true;
      throw error;
    }

    setActiveProject(projectRootAbs);

    return {
      meta: getMeta(),
      state: getState(),
      slides: getSlides(),
      files: getFiles(),
    };
  }

  return {
    createProject,
    getFiles,
    getMeta,
    getOutputPaths,
    getPreviewDocument,
    getPreviewMeta,
    getProjectStatus,
    getSlides,
    getState,
    getTarget: requireActiveProjectTarget,
    openProject,
    refreshPreview,
    requireActiveProjectPaths,
    requireActiveProjectTarget,
    setActiveProject,
  };
}
