import { existsSync, readdirSync } from 'fs';
import { resolve, sep } from 'path';
import { slugToTitle, toRelativeWithin } from './deck-paths.js';

export const SLIDE_DIR_RE = /^(\d{3})-([a-z0-9-]+)$/;
const CSS_URL_RE = /url\(\s*(?:(["'])(.*?)\1|([^'")\s][^)]*))\s*\)/gi;

function getUrlScheme(value) {
  const match = value.match(/^([a-z][a-z0-9+.-]*):/i);
  return match ? match[1].toLowerCase() : '';
}

function splitPathSuffix(rawValue) {
  const queryIndex = rawValue.indexOf('?');
  const hashIndex = rawValue.indexOf('#');
  const cutIndex = [queryIndex, hashIndex]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (cutIndex === undefined) {
    return { pathname: rawValue, suffix: '' };
  }

  return {
    pathname: rawValue.slice(0, cutIndex),
    suffix: rawValue.slice(cutIndex),
  };
}

function isInsideRoot(targetAbs, rootAbs) {
  const normalizedTarget = resolve(targetAbs);
  const normalizedRoot = resolve(rootAbs);
  return normalizedTarget === normalizedRoot || normalizedTarget.startsWith(`${normalizedRoot}${sep}`);
}

export function listSlideSourceEntries(paths) {
  if (!existsSync(paths.slidesDirAbs)) {
    return [];
  }

  return readdirSync(paths.slidesDirAbs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => {
      const match = entry.name.match(SLIDE_DIR_RE);
      const slideDirRel = `${paths.slidesDirRel}/${entry.name}`;

      return {
        dirName: entry.name,
        slideDirRel,
        slideDirAbs: resolve(paths.slidesDirAbs, entry.name),
        orderLabel: match ? match[1] : '',
        orderValue: match ? Number.parseInt(match[1], 10) : null,
        slideId: match ? match[2] : '',
        isValidName: Boolean(match),
        slideHtmlRel: `${slideDirRel}/slide.html`,
        slideHtmlAbs: resolve(paths.slidesDirAbs, entry.name, 'slide.html'),
        slideCssRel: `${slideDirRel}/slide.css`,
        slideCssAbs: resolve(paths.slidesDirAbs, entry.name, 'slide.css'),
        assetsDirRel: `${slideDirRel}/assets`,
        assetsDirAbs: resolve(paths.slidesDirAbs, entry.name, 'assets'),
      };
    });
}

export function getPresentationTitle(paths) {
  return paths.title || slugToTitle(paths.slug);
}

export function getSlideAssetRoots(paths, slideEntry) {
  return [slideEntry.slideDirAbs, paths.assetsDirAbs];
}

export function getThemeAssetRoots(paths) {
  return [paths.assetsDirAbs];
}

export function findCssUrlReferences(css) {
  const refs = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');

  for (const match of source.matchAll(CSS_URL_RE)) {
    const rawValue = (match[2] ?? match[3] ?? '').trim();
    if (rawValue) {
      refs.push({ rawValue });
    }
  }

  return refs;
}

export function resolveAuthoredAssetReference(rawValue, options = {}) {
  const {
    sourceName = 'asset reference',
    baseDirAbs = '',
    allowedRoots = [],
    allowedSchemes = ['http', 'https', 'mailto', 'tel', 'data'],
    previewPathBuilder = null,
    owningRootAbs = '',
  } = options;
  const value = String(rawValue || '').trim();

  if (!value || value.startsWith('#')) {
    return {
      previewValue: value,
      resolvedAbs: '',
      resolvedRel: '',
    };
  }

  const scheme = getUrlScheme(value);
  if (scheme) {
    if (allowedSchemes.includes(scheme)) {
      return {
        previewValue: value,
        resolvedAbs: '',
        resolvedRel: '',
      };
    }

    throw new Error(`Unsupported asset URL scheme "${scheme}:" in ${sourceName}.`);
  }

  if (value.startsWith('/')) {
    throw new Error(`Use relative asset paths in ${sourceName}. Root-relative "${value}" bypasses workspace ownership.`);
  }

  const { pathname, suffix } = splitPathSuffix(value);
  const resolvedAbs = resolve(baseDirAbs, pathname);

  if (owningRootAbs) {
    try {
      toRelativeWithin(owningRootAbs, resolvedAbs);
    } catch {
      throw new Error(`Keep asset path "${value}" in ${sourceName} inside the current workspace.`);
    }
  }

  const isAllowed = allowedRoots.some((rootAbs) => isInsideRoot(resolvedAbs, rootAbs));
  if (!isAllowed) {
    const allowedRootsLabel = allowedRoots
      .map((rootAbs) => {
        if (owningRootAbs) {
          try {
            return `/${toRelativeWithin(owningRootAbs, rootAbs)}`;
          } catch {
            return rootAbs;
          }
        }
        return rootAbs;
      })
      .join(' or ');
    throw new Error(`Keep asset path "${value}" in ${sourceName} inside ${allowedRootsLabel}.`);
  }

  if (typeof previewPathBuilder !== 'function') {
    throw new Error(`Missing preview path builder for ${sourceName}.`);
  }

  let previewValue;
  try {
    previewValue = previewPathBuilder(resolvedAbs);
  } catch {
    throw new Error(`Keep asset path "${value}" in ${sourceName} inside the current workspace.`);
  }

  return {
    previewValue: `${previewValue}${suffix}`,
    resolvedAbs,
    resolvedRel: owningRootAbs ? toRelativeWithin(owningRootAbs, resolvedAbs) : '',
  };
}
