import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { LONG_DECK_OUTLINE_THRESHOLD, getProjectPaths } from './deck-paths.js';
import { listSlideSourceEntries } from './deck-source.js';

const TODO_MARKER_RE = /\[\[TODO_[A-Z0-9_]+\]\]/;

function readIfExists(absPath) {
  if (!existsSync(absPath)) {
    return '';
  }
  return readFileSync(absPath, 'utf8');
}

function hasTodoMarkers(content) {
  return TODO_MARKER_RE.test(content || '');
}

export function createInitialPresentationIntent(paths) {
  return {
    schemaVersion: 1,
    presentationTitle: paths.title,
    audience: '',
    objective: '',
    tone: '',
    targetSlideCount: 0,
    narrativeNotes: '',
    slideIntent: {},
  };
}

export function generatePresentationPackageManifest(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  const slideEntries = listSlideSourceEntries(paths).filter((entry) => entry.isValidName);

  const briefContent = readIfExists(paths.briefAbs);
  const outlineContent = readIfExists(paths.outlineAbs);
  const outlineRequired = slideEntries.length > LONG_DECK_OUTLINE_THRESHOLD;

  return {
    schemaVersion: 1,
    projectSlug: paths.slug,
    title: paths.title,
    brief: {
      path: paths.briefRel,
      exists: existsSync(paths.briefAbs),
      complete: Boolean(briefContent.trim()) && !hasTodoMarkers(briefContent),
    },
    outline: {
      path: paths.outlineRel,
      exists: existsSync(paths.outlineAbs),
      required: outlineRequired,
      complete: !outlineRequired || (Boolean(outlineContent.trim()) && !hasTodoMarkers(outlineContent)),
    },
    theme: {
      path: paths.themeCssRel,
      exists: existsSync(paths.themeCssAbs),
    },
    slides: slideEntries.map((entry) => ({
      id: entry.slideId,
      orderLabel: entry.orderLabel,
      orderValue: entry.orderValue,
      dir: entry.slideDirRel,
      html: entry.slideHtmlRel,
      css: entry.slideCssRel,
      hasCss: existsSync(entry.slideCssAbs),
      assetsDir: entry.assetsDirRel,
      hasAssetsDir: existsSync(entry.assetsDirAbs),
    })),
    sharedAssets: {
      dir: paths.assetsDirRel,
      exists: existsSync(paths.assetsDirAbs),
    },
    outputs: {
      dir: paths.outputsDirRel,
    },
    counts: {
      slidesTotal: slideEntries.length,
    },
  };
}

export function writePresentationPackageManifest(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  const manifest = generatePresentationPackageManifest(projectRootInput);
  mkdirSync(dirname(paths.packageManifestAbs), { recursive: true });
  writeFileSync(paths.packageManifestAbs, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function writeInitialPresentationIntent(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  const intent = createInitialPresentationIntent(paths);
  mkdirSync(dirname(paths.intentAbs), { recursive: true });
  writeFileSync(paths.intentAbs, `${JSON.stringify(intent, null, 2)}\n`);
  return intent;
}
