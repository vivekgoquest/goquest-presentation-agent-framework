import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  CANVAS_STAGE,
  CANVAS_STRUCTURAL_TOKENS,
  CANVAS_THEME_VARIABLE_ALLOWLIST,
  PROTECTED_CANVAS_SELECTORS,
} from '../canvas/canvas-contract.mjs';
import { getProjectPaths } from './deck-paths.js';
import { listSlideSourceEntries } from './deck-source.js';
import { readPresentationIntent } from './presentation-intent.js';
import { readArtifacts, readRenderState } from './presentation-runtime-state.js';
import {
  computeFileFingerprint,
  computePathFingerprint,
  computeSourceFingerprint,
} from './source-fingerprint.js';

const CSS_VARIABLE_RE = /(--[a-z0-9-]+)\s*:/gi;
const CLASS_SELECTOR_RE = /(^|[\s,{])\.([a-z][a-z0-9_-]*)\b/gi;
const CSS_URL_RE = /url\((['"]?)(.*?)\1\)/gi;
const HTML_URL_RE = /\b(?:src|href|poster)\s*=\s*(["'])(.*?)\1/gi;
const SLIDE_ROOT_RE = /<([a-z][a-z0-9-]*)\b[^>]*class=(["'])([^"']*\bslide(?:\s|\b)[^"']*)\2/i;

function getDesignStateAbs(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return resolve(paths.runtimeDirAbs, 'design-state.json');
}

function readIfExists(absPath) {
  if (!existsSync(absPath)) {
    return '';
  }

  return readFileSync(absPath, 'utf8');
}

function readJsonIfExists(absPath) {
  const content = readIfExists(absPath);
  return content ? JSON.parse(content) : null;
}

function writeJson(absPath, payload) {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function extractCssVariables(css) {
  return uniqueSorted([...css.matchAll(CSS_VARIABLE_RE)].map((match) => match[1]));
}

function extractCssClasses(css) {
  return uniqueSorted([...css.matchAll(CLASS_SELECTOR_RE)].map((match) => `.${match[2]}`));
}

function extractUrlReferences(source) {
  const references = [];

  for (const match of source.matchAll(CSS_URL_RE)) {
    const value = String(match[2] || '').trim();
    if (value && !value.startsWith('data:') && !value.startsWith('#')) {
      references.push(value);
    }
  }

  for (const match of source.matchAll(HTML_URL_RE)) {
    const value = String(match[2] || '').trim();
    if (value && !value.startsWith('data:') && !value.startsWith('#')) {
      references.push(value);
    }
  }

  return uniqueSorted(references);
}

function extractCanvasVariablesUsed(tokens) {
  return uniqueSorted(tokens.filter((token) => token.startsWith('--canvas-')));
}

function normalizeWhitespace(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function extractSlideRoot(slideEntry) {
  const html = readIfExists(slideEntry.slideHtmlAbs);
  const match = html.match(SLIDE_ROOT_RE);

  return {
    slideId: slideEntry.slideId,
    rootClass: match ? normalizeWhitespace(match[3]) : '',
  };
}

function extractSlidePurposes(intent, slideEntries) {
  const slideIntent = intent?.slideIntent && typeof intent.slideIntent === 'object'
    ? intent.slideIntent
    : {};

  return slideEntries.map((entry) => {
    const value = slideIntent[entry.slideId];

    if (typeof value === 'string') {
      return { slideId: entry.slideId, purpose: value.trim(), visualIntent: '' };
    }

    if (value && typeof value === 'object') {
      return {
        slideId: entry.slideId,
        purpose: normalizeWhitespace(value.purpose || value.narrative || ''),
        visualIntent: normalizeWhitespace(value.visualIntent || ''),
      };
    }

    return { slideId: entry.slideId, purpose: '', visualIntent: '' };
  });
}

function getSlideAssetReferences(slideEntry) {
  return extractUrlReferences([
    readIfExists(slideEntry.slideHtmlAbs),
    readIfExists(slideEntry.slideCssAbs),
  ].join('\n'));
}

export function writeDesignState(projectRootInput, payload = {}) {
  const designStateAbs = getDesignStateAbs(projectRootInput);
  writeJson(designStateAbs, payload);
  return payload;
}

export function readDesignState(projectRootInput) {
  const designStateAbs = getDesignStateAbs(projectRootInput);
  return readJsonIfExists(designStateAbs);
}

export function buildDesignState(projectRootInput, options = {}) {
  const paths = getProjectPaths(projectRootInput);
  const manifest = options.manifest || readJsonIfExists(paths.packageManifestAbs);
  const intent = options.intent || readPresentationIntent(paths.projectRootAbs);
  const renderState = options.renderState || readRenderState(paths.projectRootAbs);
  const artifacts = options.artifacts || readArtifacts(paths.projectRootAbs);
  const slideEntries = listSlideSourceEntries(paths).filter((entry) => entry.isValidName);
  const themeCss = readIfExists(paths.themeCssAbs);
  const observedTokens = extractCssVariables(themeCss);

  return {
    schemaVersion: 1,
    kind: 'presentation-design-state',
    sourceFingerprint: computeSourceFingerprint(paths.projectRootAbs),
    generatedAt: new Date().toISOString(),
    project: {
      root: paths.projectRootAbs,
      slug: paths.slug,
      title: paths.title,
    },
    authority: {
      canvas: 'framework/canvas/canvas-contract.mjs',
      theme: paths.themeCssRel,
      intent: paths.intentRel,
      structure: paths.packageManifestRel,
      runtime: `${paths.runtimeDirRel}/`,
    },
    canvas: {
      status: 'fixed',
      stage: {
        ...CANVAS_STAGE,
        viewport: { ...CANVAS_STAGE.viewport },
      },
      structuralTokens: [...CANVAS_STRUCTURAL_TOKENS],
      protectedSelectors: [...PROTECTED_CANVAS_SELECTORS],
      allowedThemeVariables: [...CANVAS_THEME_VARIABLE_ALLOWLIST],
    },
    theme: {
      status: 'working',
      source: paths.themeCssRel,
      fingerprint: computeFileFingerprint(paths.themeCssAbs),
      observedTokens,
      observedPrimitives: extractCssClasses(themeCss),
      canvasVariablesUsed: extractCanvasVariablesUsed(observedTokens),
      assetReferences: extractUrlReferences(themeCss),
    },
    narrative: {
      status: 'working',
      sources: [paths.intentRel, paths.outlineRel, `${paths.slidesDirRel}/`],
      slideCount: slideEntries.length,
      slidePurposes: extractSlidePurposes(intent, slideEntries),
    },
    content: {
      status: 'working',
      slideRoots: slideEntries.map((entry) => extractSlideRoot(entry)),
      slideCssFiles: slideEntries
        .filter((entry) => existsSync(entry.slideCssAbs))
        .map((entry) => entry.slideCssRel),
      assetReferences: uniqueSorted(slideEntries.flatMap((entry) => getSlideAssetReferences(entry))),
    },
    audit: {
      lastKnownStatus: String(renderState?.status || 'unknown'),
      families: {},
    },
    driftRules: {
      changeIsAllowed: true,
      untrackedLayerBypassIsNotAllowed: true,
    },
    fingerprints: {
      source: computeSourceFingerprint(paths.projectRootAbs),
      theme: computeFileFingerprint(paths.themeCssAbs),
      intent: computeFileFingerprint(paths.intentAbs),
      outline: computeFileFingerprint(paths.outlineAbs),
      slides: computePathFingerprint(paths.projectRootAbs, paths.slidesDirRel),
      packageManifest: computeFileFingerprint(paths.packageManifestAbs),
      renderState: computeFileFingerprint(paths.renderStateAbs),
      artifacts: computeFileFingerprint(paths.artifactsAbs),
    },
    evidence: {
      manifestAvailable: Boolean(manifest),
      renderStateAvailable: Boolean(renderState),
      artifactsAvailable: Boolean(artifacts),
    },
  };
}

export function refreshDesignState(projectRootInput, options = {}) {
  return writeDesignState(projectRootInput, buildDesignState(projectRootInput, options));
}
