import { existsSync, readFileSync } from 'fs';
import {
  createPresentationTarget,
  createWorkspaceRef,
  getPresentationId,
  getPresentationOutputPaths,
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

function getExportBar(target) {
  if (target.kind === 'workspace' && target.ownerType !== 'deck') {
    return '';
  }

  return `
  <div class="export-bar">
    <span class="status" id="export-status"></span>
    <button type="button" data-export-pdf>Export to PDF</button>
  </div>`;
}

function buildHtmlDataAttributes(target, savePath, previewPath) {
  const attrs = [
    ['data-deck-source', 'slides'],
    ['data-target-kind', target.kind],
    ['data-export-save-path', savePath],
    ['data-preview-path', previewPath],
  ];

  if (target.kind === 'workspace') {
    attrs.push(['data-owner-type', target.ownerType]);
    attrs.push(['data-owner-name', target.ownerName]);
  } else {
    attrs.push(['data-project-root', target.projectRootAbs]);
  }

  return attrs
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(' ');
}

function buildVirtualDeckHtml(target, paths, slideEntries) {
  const title = getPresentationTitle(paths);
  let savePath = '';
  try {
    savePath = getPresentationOutputPaths(target).pdfRel;
  } catch {
    savePath = '';
  }
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
  const htmlDataAttrs = buildHtmlDataAttributes(target, savePath, previewPath);

  return `<!DOCTYPE html>
<!-- VIRTUAL RUNTIME OUTPUT. Edit ${paths.themeCssRel} and ${paths.slidesDirRel}/* instead. -->
<html lang="en" ${htmlDataAttrs}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>

  <style>@layer content, theme, canvas;</style>

  <link rel="stylesheet" href="${escapeHtml(paths.buildFrameworkPreviewPath('canvas/canvas.css'))}">
  <link rel="stylesheet" href="${escapeHtml(paths.buildProjectFilePreviewPath(paths.themeCssAbs))}">
${slideStylesBlock}  <script defer src="${escapeHtml(paths.buildFrameworkPreviewPath('client/animations.js'))}"></script>
  <script defer src="${escapeHtml(paths.buildFrameworkPreviewPath('client/nav.js'))}"></script>
  <script defer src="${escapeHtml(paths.buildFrameworkPreviewPath('client/counter.js'))}"></script>
  <script defer src="${escapeHtml(paths.buildFrameworkPreviewPath('client/export.js'))}"></script>
</head>
<body>
${getExportBar(target)}

${sections}
</body>
</html>
`;
}

export function renderPresentationHtml(input) {
  const target = createPresentationTarget(input);
  const paths = getPresentationPaths(target);

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

export function renderOwnedWorkspaceHtml(input) {
  const workspaceRef = createWorkspaceRef(input.ownerType, input.ownerName);
  const rendered = renderPresentationHtml(workspaceRef);
  return {
    ...rendered,
    ownerType: workspaceRef.ownerType,
    ownerName: workspaceRef.ownerName,
    workspaceId: rendered.presentationId,
  };
}
