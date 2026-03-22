import { existsSync, readFileSync } from 'fs';
import {
  createPresentationTarget,
  getPresentationId,
  getPresentationPaths,
  getPresentationPreviewPath,
} from './deck-paths.js';
import {
  getSlideAssetRoots,
  getPresentationTitle,
  listSlideSourceEntries,
  resolveAuthoredAssetReference,
} from './deck-source.js';
import {
  CANVAS_LAYER_ORDER,
} from '../canvas/canvas-contract.mjs';
import { ensurePresentationPackageFiles } from './presentation-package.js';
import {
  validateDeckSource,
  validateSlideDeckWorkspace,
} from './deck-policy.js';
import { checkDeckQuality } from './deck-quality.js';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function indentBlock(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line ? `${prefix}${line}` : ''))
    .join('\n');
}

function rewriteHtmlAssetReferences(fragment, paths, slideEntry) {
  return fragment.replace(
    /\b(src|href|poster)\s*=\s*(["'])([^"']*)\2/gi,
    (match, attr, quote, value) => {
      const resolved = resolveAuthoredAssetReference(value.trim(), {
        sourceName: `${slideEntry.slideHtmlRel} (${attr})`,
        baseDirAbs: slideEntry.slideDirAbs,
        allowedRoots: getSlideAssetRoots(paths, slideEntry),
        previewPathBuilder: paths.buildProjectFilePreviewPath,
        owningRootAbs: paths.sourceDirAbs,
      });
      return `${attr}=${quote}${escapeHtml(resolved.previewValue)}${quote}`;
    }
  );
}

function buildHtmlDataAttributes(target, previewPath) {
  const attrs = [
    ['data-deck-source', 'slides'],
    ['data-target-kind', 'project'],
    ['data-preview-path', previewPath],
    ['data-project-root', target.projectRootAbs],
  ];

  return attrs
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(' ');
}

function buildVirtualDeckHtml(target, paths, slideEntries) {
  const title = getPresentationTitle(paths);
  const previewPath = getPresentationPreviewPath(target);

  const slideStyleLinks = slideEntries
    .filter((entry) => existsSync(entry.slideCssAbs))
    .map((entry) => `  <link rel="stylesheet" href="${escapeHtml(paths.buildProjectFilePreviewPath(entry.slideCssAbs))}">`)
    .join('\n');

  const sections = slideEntries.map((entry) => {
    const fragment = rewriteHtmlAssetReferences(
      readFileSync(entry.slideHtmlAbs, 'utf-8').trim(),
      paths,
      entry
    );

    return [
      `  <!-- SOURCE: ${entry.slideDirRel} -->`,
      `  <section id="${escapeHtml(entry.slideId)}" data-slide>`,
      indentBlock(fragment, 4),
      '  </section>',
    ].join('\n');
  }).join('\n\n');

  const slideStylesBlock = slideStyleLinks ? `${slideStyleLinks}\n` : '';
  const htmlDataAttrs = buildHtmlDataAttributes(target, previewPath);

  return `<!DOCTYPE html>
<!-- VIRTUAL RUNTIME OUTPUT. Edit ${paths.themeCssRel} and ${paths.slidesDirRel}/* instead. -->
<html lang="en" ${htmlDataAttrs}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>

  <style>${CANVAS_LAYER_ORDER}</style>

  <link rel="stylesheet" href="${escapeHtml(paths.buildFrameworkPreviewPath('canvas/canvas.css'))}">
  <link rel="stylesheet" href="${escapeHtml(paths.buildFrameworkPreviewPath('runtime/runtime-chrome.css'))}">
  <link rel="stylesheet" href="${escapeHtml(paths.buildProjectFilePreviewPath(paths.themeCssAbs))}">
${slideStylesBlock}  <script defer src="${escapeHtml(paths.buildFrameworkPreviewPath('client/animations.js'))}"></script>
  <script defer src="${escapeHtml(paths.buildFrameworkPreviewPath('client/nav.js'))}"></script>
  <script defer src="${escapeHtml(paths.buildFrameworkPreviewPath('client/counter.js'))}"></script>
</head>
<body>
${sections}
</body>
</html>
`;
}

export function renderPresentationHtml(input) {
  const target = createPresentationTarget(input);
  const paths = getPresentationPaths(target);
  ensurePresentationPackageFiles(paths.projectRootAbs);

  validateSlideDeckWorkspace(paths);

  const slideEntries = listSlideSourceEntries(paths).filter((entry) => entry.isValidName);
  const html = buildVirtualDeckHtml(target, paths, slideEntries);
  validateDeckSource(html, `${getPresentationId(target)} (virtual)`);

  const quality = checkDeckQuality(slideEntries);

  return {
    html,
    title: getPresentationTitle(paths),
    slideIds: slideEntries.map((entry) => entry.slideId),
    target,
    presentationId: getPresentationId(target),
    previewPath: getPresentationPreviewPath(target),
    paths,
    qualityWarnings: quality.warnings,
  };
}
