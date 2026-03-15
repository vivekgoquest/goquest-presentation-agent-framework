import { existsSync, statSync } from 'fs';
import { resolve } from 'path';
import {
  PROJECT_METADATA_FILENAME,
  PROJECT_PREVIEW_PATH,
  PROJECT_SYSTEM_DIRNAME,
  createPresentationTarget,
  getPresentationOutputPaths,
  getProjectPaths,
} from '../../framework/runtime/deck-paths.js';
import { buildProjectTreeNode } from '../../framework/runtime/project-tree.js';
import { getProjectState } from '../../framework/runtime/project-state.js';
import { createPresentationScaffold } from '../../framework/runtime/services/scaffold-service.mjs';

function assertProjectDirectory(projectRootAbs) {
  if (!projectRootAbs || projectRootAbs === resolve('/')) {
    throw new Error('Provide a valid project folder path.');
  }

  if (!existsSync(projectRootAbs) || !statSync(projectRootAbs).isDirectory()) {
    throw new Error(`Project folder does not exist: ${projectRootAbs}`);
  }
}

function assertSlideCount(value) {
  const slideCount = Number.parseInt(String(value ?? '3'), 10);
  if (!Number.isFinite(slideCount) || slideCount < 1 || slideCount > 99) {
    throw new Error('Slides must be a whole number between 1 and 99.');
  }

  return slideCount;
}

export function createProjectService(options = {}) {
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

  async function createProject(payload = {}) {
    const projectRootAbs = resolve(String(payload.projectRoot || ''));
    const slideCount = assertSlideCount(payload.slides);
    const copyFramework = Boolean(payload.copyFramework);

    if (!projectRootAbs || projectRootAbs === resolve('/')) {
      throw new Error('Choose a target folder for the presentation project.');
    }

    const result = createPresentationScaffold({ projectRoot: projectRootAbs }, {
      slideCount,
      copyFramework,
    });

    setActiveProject(projectRootAbs);

    return {
      result,
      meta: getMeta(),
      state: getState(),
      files: getFiles(),
    };
  }

  function openProject(payload = {}) {
    const projectRootAbs = resolve(String(payload.projectRoot || ''));
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
      files: getFiles(),
    };
  }

  function getOutputPaths() {
    return getPresentationOutputPaths(requireActiveProjectTarget());
  }

  return {
    createProject,
    getFiles,
    getMeta,
    getOutputPaths,
    getState,
    getTarget: requireActiveProjectTarget,
    openProject,
    requireActiveProjectPaths,
    requireActiveProjectTarget,
    setActiveProject,
  };
}
