import { existsSync, readFileSync, statSync } from 'fs';
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
import { renderPresentationHtml } from '../../framework/runtime/deck-assemble.js';
import { listSlideSourceEntries } from '../../framework/runtime/deck-source.js';
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

  function getPreviewHtml() {
    const target = requireActiveProjectTarget();
    const paths = requireActiveProjectPaths();

    let html;
    let slideIds;
    let title;

    try {
      const assembled = renderPresentationHtml(target);
      html = assembled.html;
      slideIds = assembled.slideIds;
      title = assembled.title;
    } catch {
      // Validation may fail for incomplete projects (TODO markers, etc.)
      // Build a minimal preview from raw slide files so the user can still see content
      const entries = listSlideSourceEntries(paths).filter(e => e.isValidName);
      slideIds = entries.map(e => e.slideId);
      title = paths.title || 'Preview';

      const slideHtml = entries.map(entry => {
        let content = '';
        try { content = readFileSync(entry.slideHtmlAbs, 'utf-8').trim(); } catch { content = '<div class="slide"><p>Empty slide</p></div>'; }
        return `<section id="${entry.slideId}" data-slide>\n${content}\n</section>`;
      }).join('\n');

      html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>@layer content, theme, canvas;</style>
<link rel="stylesheet" href="/project-framework/canvas/canvas.css">
<link rel="stylesheet" href="/project-files/theme.css">
</head><body>\n${slideHtml}\n</body></html>`;
    }

    // Rewrite asset URLs for the presentation:// protocol
    html = html.replaceAll('/project-files/', 'presentation://project-files/');
    html = html.replaceAll('/project-framework/', 'presentation://project-framework/');

    // Inject snap-to-slide CSS (does not modify canvas.css — overlay only)
    const snapCss = `<style>
html, body { height: 100%; overflow: hidden; }
body { scroll-snap-type: y mandatory; overflow-y: auto; padding: 0; gap: 0; }
section[data-slide] { scroll-snap-align: center; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.dot-nav, .export-bar { display: none !important; }
</style>`;

    // Inject navigation script for parent postMessage control
    const navScript = `<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'navigate-slide') {
    var el = document.getElementById(e.data.slideId);
    if (el) el.scrollIntoView({ behavior: 'instant', block: 'center' });
  }
});
var _obs = new IntersectionObserver(function(entries) {
  entries.forEach(function(entry) {
    if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
      window.parent.postMessage({ type: 'slide-visible', slideId: entry.target.id }, '*');
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-slide]').forEach(function(s) { _obs.observe(s); });
</script>`;

    html = html.replace('</head>', `${snapCss}\n</head>`);
    html = html.replace('</body>', `${navScript}\n</body>`);

    return { html, slideIds, title };
  }

  return {
    createProject,
    getFiles,
    getMeta,
    getOutputPaths,
    getPreviewHtml,
    getState,
    getTarget: requireActiveProjectTarget,
    openProject,
    requireActiveProjectPaths,
    requireActiveProjectTarget,
    setActiveProject,
  };
}
