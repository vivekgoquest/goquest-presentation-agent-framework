import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { CANVAS_STAGE } from '../canvas/canvas-contract.mjs';
import {
  PROJECT_METADATA_FILENAME,
  PROJECT_PREVIEW_PATH,
  PROJECT_SYSTEM_DIRNAME,
  createPresentationTarget,
  getPresentationOutputPaths,
  getProjectPaths,
} from '../runtime/deck-paths.js';
import { ensurePresentationPackageFiles } from '../runtime/presentation-package.js';
import { buildProjectTreeNode } from '../runtime/project-tree.js';
import { getProjectState } from '../runtime/project-state.js';
import { listSlideSourceEntries } from '../runtime/deck-source.js';
import { renderPresentationHtml } from '../runtime/deck-assemble.js';
import { renderPresentationFailureHtml } from '../runtime/preview-state-page.js';
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
  if (!Number.isFinite(slideCount) || slideCount < 1 || slideCount > 99) {
    throw new Error('Slides must be a whole number between 1 and 99.');
  }
  return slideCount;
}

export function createProjectQueryService(options = {}) {
  const frameworkRoot = options.frameworkRoot || process.cwd();
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

  function getMeta() {
    if (!activeProjectPaths) {
      return {
        active: false,
        kind: 'none',
        projectRoot: '',
        previewPath: PROJECT_PREVIEW_PATH,
      };
    }

    return {
      active: true,
      kind: 'project',
      projectRoot: activeProjectPaths.projectRootAbs,
      title: activeProjectPaths.title,
      slug: activeProjectPaths.slug,
      previewPath: PROJECT_PREVIEW_PATH,
      projectMode: activeProjectPaths.metadata.projectMode,
      frameworkMode: activeProjectPaths.metadata.frameworkMode,
      frameworkVersion: activeProjectPaths.metadata.frameworkVersion,
      frameworkCopiedAt: activeProjectPaths.metadata.frameworkCopiedAt,
      canvasPolicy: activeProjectPaths.metadata.canvasPolicy,
      historyPolicy: activeProjectPaths.metadata.historyPolicy,
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

    return getProjectState(activeProjectPaths.projectRootAbs);
  }

  function getFiles() {
    const projectPaths = requireActiveProjectPaths();
    return {
      root: projectPaths.projectRootAbs,
      tree: buildProjectTreeNode(projectPaths.projectRootAbs, projectPaths.projectRootAbs),
    };
  }

  function getSlides() {
    const projectPaths = requireActiveProjectPaths();
    const { manifest } = ensurePresentationPackageFiles(projectPaths.projectRootAbs);
    if (Array.isArray(manifest?.slides)) {
      return manifest.slides.map((slide) => ({
        id: slide.id,
        dirName: slide.dir.split('/').at(-1) || slide.id,
        orderLabel: slide.orderLabel,
        orderValue: slide.orderValue,
      }));
    }

    return listSlideSourceEntries(projectPaths)
      .filter((entry) => entry.isValidName)
      .map((entry) => ({
        id: entry.slideId,
        dirName: entry.dirName,
        orderLabel: entry.orderLabel,
        orderValue: entry.orderValue,
      }));
  }

  function getOutputPaths() {
    return getPresentationOutputPaths(requireActiveProjectTarget());
  }

  function buildPreviewDocument() {
    const target = requireActiveProjectTarget();
    const paths = requireActiveProjectPaths();

    let html;
    let slideIds;
    let title;
    let previewKind = 'slides';
    let viewport = null;

    try {
      const assembled = renderPresentationHtml(target);
      html = assembled.html;
      slideIds = assembled.slideIds;
      title = assembled.title;
      viewport = { ...CANVAS_STAGE.viewport };
    } catch (error) {
      const fallback = renderPresentationFailureHtml(target, error);
      html = fallback.html;
      slideIds = [];
      title = paths.title || 'Preview';
      previewKind = fallback.kind;
    }

    html = html.replaceAll('/project-files/', 'presentation://project-files/');
    html = html.replaceAll('/project-framework/', 'presentation://project-framework/');

    return { html, slideIds, title, kind: previewKind, viewport };
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
