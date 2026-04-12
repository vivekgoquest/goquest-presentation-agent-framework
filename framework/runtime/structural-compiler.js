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

function isCompleteAuthoredText(absPath) {
  const content = readIfExists(absPath);
  return Boolean(content.trim()) && !hasTodoMarkers(content);
}

export function computeStructuralManifest(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  const slideEntries = listSlideSourceEntries(paths).filter((entry) => entry.isValidName);
  const outlineRequired = slideEntries.length > LONG_DECK_OUTLINE_THRESHOLD;

  return {
    schemaVersion: 1,
    project: {
      slug: paths.slug,
      title: paths.title,
    },
    source: {
      brief: {
        path: paths.briefRel,
        exists: existsSync(paths.briefAbs),
        complete: isCompleteAuthoredText(paths.briefAbs),
      },
      outline: {
        path: paths.outlineRel,
        exists: existsSync(paths.outlineAbs),
        required: outlineRequired,
        complete: !outlineRequired || isCompleteAuthoredText(paths.outlineAbs),
      },
      theme: {
        path: paths.themeCssRel,
        exists: existsSync(paths.themeCssAbs),
      },
      sharedAssets: {
        dir: paths.assetsDirRel,
        exists: existsSync(paths.assetsDirAbs),
      },
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
    counts: {
      slidesTotal: slideEntries.length,
    },
  };
}

export function recordStructuralManifest(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  const manifest = computeStructuralManifest(paths.projectRootAbs);
  const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;

  mkdirSync(dirname(paths.packageManifestAbs), { recursive: true });

  if (existsSync(paths.packageManifestAbs)) {
    const existingManifest = readFileSync(paths.packageManifestAbs, 'utf8');
    if (existingManifest === serializedManifest) {
      return manifest;
    }
  }

  writeFileSync(paths.packageManifestAbs, serializedManifest);
  return manifest;
}
