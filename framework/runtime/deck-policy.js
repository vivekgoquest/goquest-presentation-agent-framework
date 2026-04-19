import { existsSync, readFileSync, readdirSync } from 'fs';
import {
  CANVAS_LAYER_ORDER,
  CANVAS_STAGE,
  CANVAS_STRUCTURAL_TOKENS,
  CANVAS_THEME_VARIABLE_ALLOWLIST,
  PROTECTED_CANVAS_SELECTORS,
} from '../canvas/canvas-contract.mjs';
import { LONG_DECK_OUTLINE_THRESHOLD, resolveProjectFrameworkAssetAbs } from './deck-paths.js';
import {
  findCssUrlReferences,
  getSlideAssetRoots,
  getThemeAssetRoots,
  listSlideSourceEntries,
  resolveAuthoredAssetReference,
} from './deck-source.js';
import { RUNTIME_CHROME_SELECTORS } from './runtime-chrome-contract.mjs';

// -----------------------------------------------------------------------------
// Policy Constants and Parsing Primitives
// -----------------------------------------------------------------------------

const INLINE_STYLE_RE = /\sstyle\s*=/i;
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const IMPORTANT_RE = /!important\b/i;
const THEME_LAYER_RE = /@layer\s+theme\b/;
const CONTENT_LAYER_RE = /@layer\s+content\b/;
const FORBIDDEN_SLIDE_TAG_RE = /<\s*(html|head|body|section)\b/i;
const DATA_SLIDE_RE = /\bdata-slide\b/i;
const SLIDE_ROOT_RE = /<([a-z][a-z0-9-]*)\b[^>]*\bclass\s*=\s*(["'])([^"']*)\2[^>]*>/gi;
const HTML_ASSET_ATTR_RE = /\b(src|href|poster)\s*=\s*(["'])([^"']*)\2/gi;
const TODO_MARKER_RE = /\[\[TODO_[A-Z0-9_]+\]\]/;
const DECK_TITLE_TOKEN_RE = /\{\{DECK_TITLE\}\}/;
const ALLOWED_SLIDE_ENTRY_NAMES = new Set(['slide.html', 'slide.css', 'assets']);
const IGNORED_SLIDE_ENTRY_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

const THEME_PRIMITIVE_RE = /(^|[\s>+~])(\.hero-title|\.sect-title|\.eyebrow|\.body-lg|\.body-text|\.body-strong|\.body-emphasis|\.hero-title-compact|\.small-text|\.body-text-dim|\.text-accent-light|\.text-on-dark-soft|\.text-accent|\.text-green|\.text-muted|\.bg-accent|\.icard|\.stat-card|\.stat-value|\.stat-label|\.stat-value-compact|\.badge(?:-[a-z0-9-]+)?|\.tkwy|\.img-round|\.img-circle|\.divider|table|th|td)(?=[\s.:#[>+~]|$)/i;
const RESTRICTED_THEME_DECLARATION_RE = /(^|;)\s*(color|background(?:-color|-image)?|font(?:-size|-family|-weight)?|line-height|letter-spacing|text-transform|border(?:-color|-radius)?|box-shadow)\s*:/i;
const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

function normalizeSelector(selector) {
  return selector.trim().replace(/\s+/g, ' ');
}

function extractCssRules(css) {
  const rules = [];
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');

  function walk(block) {
    let index = 0;
    while (index < block.length) {
      while (index < block.length && /[\s}]/.test(block[index])) {
        index += 1;
      }

      if (index >= block.length) {
        break;
      }

      const start = index;
      while (index < block.length && block[index] !== '{' && block[index] !== '}') {
        index += 1;
      }

      if (index >= block.length || block[index] !== '{') {
        break;
      }

      const prelude = block.slice(start, index).trim();
      index += 1;
      let depth = 1;
      const innerStart = index;

      while (index < block.length && depth > 0) {
        if (block[index] === '{') {
          depth += 1;
        } else if (block[index] === '}') {
          depth -= 1;
        }
        index += 1;
      }

      const inner = block.slice(innerStart, index - 1).trim();
      if (!prelude) {
        continue;
      }

      if (prelude.startsWith('@media') || prelude.startsWith('@supports') || prelude.startsWith('@layer')) {
        walk(inner);
      } else if (!prelude.startsWith('@')) {
        rules.push({
          selectorGroup: prelude,
          declarations: inner,
        });
      }
    }
  }

  walk(source);
  return rules;
}

function selectorStartsWithPrefix(selector, prefix) {
  return selector === prefix
    || selector.startsWith(`${prefix} `)
    || selector.startsWith(`${prefix}.`)
    || selector.startsWith(`${prefix}:`)
    || selector.startsWith(`${prefix}[`)
    || selector.startsWith(`${prefix}::`)
    || selector.startsWith(`${prefix}>`)
    || selector.startsWith(`${prefix}+`)
    || selector.startsWith(`${prefix}~`);
}

function selectorContainsPrefix(selector, prefix) {
  const normalized = normalizeSelector(selector);
  const escaped = escapeRegExp(prefix);
  const matcher = new RegExp(`(^|[\\s>+~,(])${escaped}(?=[\\s.:#[>+~,(]|$)`);
  return matcher.test(normalized);
}

function isProtectedCanvasSelector(selector) {
  const normalized = normalizeSelector(selector);
  return PROTECTED_CANVAS_SELECTORS.some((prefix) => selectorContainsPrefix(normalized, prefix));
}

function isRuntimeChromeSelector(selector) {
  const normalized = normalizeSelector(selector);
  return RUNTIME_CHROME_SELECTORS.some((prefix) => selectorContainsPrefix(normalized, prefix));
}

function selectorTouchesThemePrimitive(selector) {
  return THEME_PRIMITIVE_RE.test(` ${normalizeSelector(selector)}`);
}

// -----------------------------------------------------------------------------
// Shared Validation Helpers
// -----------------------------------------------------------------------------

function formatFailures(sourceName, failures) {
  const details = failures.map((msg) => `- ${msg}`).join('\n');
  throw new Error(
    `Deck policy violation in ${sourceName}:\n${details}\n\nFix the workspace files and rerun audit, preview, export, or finalize.`
  );
}

function createPolicyFinding(sourceName, layer, message, slideId = null) {
  return {
    layer,
    message,
    slideId,
    sourceName,
  };
}

function throwFindings(sourceName, findings) {
  if (findings.length > 0) {
    formatFailures(sourceName, findings.map((finding) => finding.message));
  }
}

function getNonEmptyStyleBlockCount(html) {
  let count = 0;
  for (const match of html.matchAll(STYLE_BLOCK_RE)) {
    const css = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (css) {
      count += 1;
    }
  }

  return count;
}

function stripHtmlComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function hasSlideRootClass(className) {
  const classes = className.split(/\s+/).filter(Boolean);
  return classes.includes('slide') || classes.includes('slide-wide') || classes.includes('slide-hero');
}

function getSlideRootClassList(html) {
  const normalized = stripHtmlComments(html);
  const rootMatch = [...normalized.matchAll(SLIDE_ROOT_RE)]
    .filter((match) => hasSlideRootClass(match[3]))[0];
  if (!rootMatch) {
    return [];
  }
  return rootMatch[3].split(/\s+/).filter(Boolean);
}

function validateHtmlAssetReferences(html, options) {
  const failures = [];
  for (const match of html.matchAll(HTML_ASSET_ATTR_RE)) {
    const attr = match[1];
    const value = match[3].trim();
    try {
      resolveAuthoredAssetReference(value, {
        ...options,
        sourceName: `${options.sourceName} (${attr})`,
        allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
      });
    } catch (err) {
      failures.push(err.message);
    }
  }

  return failures;
}

function validateCssAssetReferences(css, options) {
  const failures = [];
  for (const { rawValue } of findCssUrlReferences(css)) {
    try {
      resolveAuthoredAssetReference(rawValue, {
        ...options,
        sourceName: `${options.sourceName} (url(${rawValue}))`,
        allowedSchemes: ['data'],
      });
    } catch (err) {
      failures.push(err.message);
    }
  }

  return failures;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasSingleTopLevelElement(html) {
  const source = stripHtmlComments(html);
  let index = 0;
  let depth = 0;
  let topLevelElements = 0;

  function advanceTagEnd(startIndex) {
    let cursor = startIndex;
    let quote = null;
    while (cursor < source.length) {
      const char = source[cursor];
      if (quote) {
        if (char === quote) {
          quote = null;
        }
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        return cursor;
      }
      cursor += 1;
    }
    return -1;
  }

  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }

    if (source[index] !== '<') {
      const nextTag = source.indexOf('<', index);
      const text = (nextTag === -1 ? source.slice(index) : source.slice(index, nextTag)).trim();
      if (text && depth === 0) {
        return false;
      }
      index = nextTag === -1 ? source.length : nextTag;
      continue;
    }

    if (source.startsWith('<!--', index)) {
      const commentEnd = source.indexOf('-->', index + 4);
      if (commentEnd === -1) {
        return false;
      }
      index = commentEnd + 3;
      continue;
    }

    if (source.startsWith('</', index)) {
      const tagEnd = advanceTagEnd(index + 2);
      if (tagEnd === -1 || depth === 0) {
        return false;
      }
      depth -= 1;
      index = tagEnd + 1;
      continue;
    }

    if (source[index + 1] === '!' || source[index + 1] === '?') {
      return false;
    }

    const tagEnd = advanceTagEnd(index + 1);
    if (tagEnd === -1) {
      return false;
    }

    const rawTag = source.slice(index + 1, tagEnd).trim();
    const nameMatch = rawTag.match(/^([a-z][a-z0-9-]*)/i);
    if (!nameMatch) {
      return false;
    }

    const tagName = nameMatch[1].toLowerCase();
    const selfClosing = /\/\s*$/.test(rawTag) || VOID_HTML_TAGS.has(tagName);

    if (depth === 0) {
      topLevelElements += 1;
      if (topLevelElements > 1) {
        return false;
      }
    }

    if (!selfClosing) {
      depth += 1;
    }

    index = tagEnd + 1;
  }

  return topLevelElements === 1 && depth === 0;
}

function findStructuralTokenOverrides(css) {
  const overrides = [];
  for (const token of CANVAS_STRUCTURAL_TOKENS) {
    const matcher = new RegExp(`(^|[;{\\s])${escapeRegExp(token)}\\s*:`, 'm');
    if (matcher.test(css)) {
      overrides.push(token);
    }
  }
  return overrides;
}

function findUnknownCanvasThemeVariables(css) {
  const matches = css.match(/--canvas-[a-z0-9-]+\s*:/gi) || [];
  return matches
    .map((match) => match.replace(':', '').trim())
    .filter((variableName) => !CANVAS_THEME_VARIABLE_ALLOWLIST.includes(variableName));
}

function hasDeclarationValue(declarations, propertyName, expectedValue) {
  const matcher = new RegExp(`(^|;)\\s*${escapeRegExp(propertyName)}\\s*:\\s*${escapeRegExp(expectedValue)}\\s*(;|$)`, 'm');
  return matcher.test(declarations);
}

function findRuleByExactSelector(rules, selector) {
  return rules.find((rule) =>
    rule.selectorGroup
      .split(',')
      .map((entry) => normalizeSelector(entry))
      .includes(selector)
  );
}

function collectEffectiveCanvasFailures(paths) {
  const failures = [];
  const canvasCssAbs = resolveProjectFrameworkAssetAbs(paths, 'canvas/canvas.css');
  const css = readFileSync(canvasCssAbs, 'utf-8');
  const rules = extractCssRules(css);

  const requiredTokenValues = new Map([
    ['--slide-max-w', `${CANVAS_STAGE.slideMaxWidth}px`],
    ['--slide-wide-max-w', `${CANVAS_STAGE.slideWideMaxWidth}px`],
    ['--slide-ratio', CANVAS_STAGE.slideRatio],
  ]);

  for (const [token, expectedValue] of requiredTokenValues) {
    const matcher = new RegExp(`(^|[;{\\s])${escapeRegExp(token)}\\s*:\\s*${escapeRegExp(expectedValue)}\\s*;`, 'm');
    if (!matcher.test(css)) {
      failures.push(`Keep structural canvas token "${token}" fixed at "${expectedValue}" in the effective framework canvas.`);
    }
  }

  const slideRule = findRuleByExactSelector(rules, '.slide');
  if (!slideRule || !hasDeclarationValue(slideRule.declarations, 'max-width', 'var(--slide-max-w)')) {
    failures.push('Keep the .slide stage max-width bound to var(--slide-max-w) in the effective framework canvas.');
  }
  if (!slideRule || !hasDeclarationValue(slideRule.declarations, 'aspect-ratio', 'var(--slide-ratio)')) {
    failures.push('Keep the .slide stage aspect-ratio bound to var(--slide-ratio) in the effective framework canvas.');
  }

  const slideWideRule = findRuleByExactSelector(rules, '.slide-wide');
  if (!slideWideRule || !hasDeclarationValue(slideWideRule.declarations, 'max-width', 'var(--slide-wide-max-w)')) {
    failures.push('Keep the .slide-wide stage max-width bound to var(--slide-wide-max-w) in the effective framework canvas.');
  }

  for (const selector of ['.dot-nav', '.export-bar', ...RUNTIME_CHROME_SELECTORS]) {
    const matcher = new RegExp(`${escapeRegExp(selector)}(?=[\\s.:#[>+~,(]|\\s*\\{|$)`);
    if (matcher.test(css)) {
      failures.push(`Remove runtime chrome selector "${selector}" from the effective framework canvas.`);
    }
  }

  return failures;
}

function validateEffectiveCanvasSource(paths, sourceName = 'framework/canvas/canvas.css') {
  throwFindings(sourceName, collectCanvasPolicyFindings(paths, { sourceName }));
}

export function collectCanvasPolicyFindings(paths, options = {}) {
  const sourceName = options.sourceName || 'framework/canvas/canvas.css';
  return collectEffectiveCanvasFailures(paths)
    .map((message) => createPolicyFinding(sourceName, 'canvas', message));
}

function validateSlideFolderEntries(slideEntry) {
  const failures = [];

  if (!existsSync(slideEntry.slideDirAbs)) {
    return failures;
  }

  for (const entry of readdirSync(slideEntry.slideDirAbs, { withFileTypes: true })) {
    if (IGNORED_SLIDE_ENTRY_NAMES.has(entry.name)) {
      continue;
    }

    if (!ALLOWED_SLIDE_ENTRY_NAMES.has(entry.name)) {
      failures.push(
        `Keep ${slideEntry.slideDirRel} limited to slide.html, optional slide.css, and optional assets/. Remove "${slideEntry.slideDirRel}/${entry.name}".`
      );
      continue;
    }

    if (entry.name === 'assets' && !entry.isDirectory()) {
      failures.push(`Use "${slideEntry.assetsDirRel}/" as a directory for slide-local assets.`);
      continue;
    }

    if ((entry.name === 'slide.html' || entry.name === 'slide.css') && !entry.isFile()) {
      failures.push(`Keep "${slideEntry.slideDirRel}/${entry.name}" as a file.`);
    }
  }

  return failures;
}

function validateBriefSource(markdown, sourceName = 'brief.md') {
  const failures = [];

  if (!markdown.trim()) {
    failures.push('Fill in brief.md with the normalized user request before continuing.');
  }

  if (DECK_TITLE_TOKEN_RE.test(markdown) || TODO_MARKER_RE.test(markdown)) {
    failures.push('Replace the scaffold TODO markers in brief.md with the normalized user request before continuing.');
  }

  if (failures.length > 0) {
    formatFailures(sourceName, failures);
  }
}

function validateOutlineSource(markdown, sourceName = 'outline.md') {
  const failures = [];

  if (!markdown.trim()) {
    failures.push('Fill in outline.md with the long-deck story arc before continuing.');
  }

  if (DECK_TITLE_TOKEN_RE.test(markdown) || TODO_MARKER_RE.test(markdown)) {
    failures.push('Replace the scaffold TODO markers in outline.md with the long-deck story arc before continuing.');
  }

  if (failures.length > 0) {
    formatFailures(sourceName, failures);
  }
}

// -----------------------------------------------------------------------------
// File-Level Validators
// -----------------------------------------------------------------------------

function collectThemeSourceFailures(css, paths, sourceName = 'theme.css') {
  const failures = [];

  if (!THEME_LAYER_RE.test(css)) {
    failures.push('Wrap all theme rules in @layer theme so the visual system stays below canvas.');
  }

  if (IMPORTANT_RE.test(css)) {
    failures.push('Remove !important from theme.css. The theme should work through variables and semantic primitives, not force the cascade.');
  }

  for (const token of findStructuralTokenOverrides(css)) {
    failures.push(`Do not override structural canvas token "${token}" from theme.css. Structural stage tokens must stay in framework/canvas/canvas.css.`);
  }

  for (const variableName of findUnknownCanvasThemeVariables(css)) {
    failures.push(`Theme may not introduce unknown canvas variable "${variableName}". Use the approved canvas theme variables only.`);
  }

  for (const rule of extractCssRules(css)) {
    const selectors = rule.selectorGroup.split(',').map((selector) => normalizeSelector(selector)).filter(Boolean);
    for (const selector of selectors) {
      if (isProtectedCanvasSelector(selector)) {
        failures.push(`Remove the theme override for "${selector}". Canvas-owned selectors must stay in framework/canvas/canvas.css.`);
      }
    }
  }

  failures.push(...validateCssAssetReferences(css, {
    sourceName,
    baseDirAbs: paths.sourceDirAbs,
    allowedRoots: getThemeAssetRoots(paths),
    previewPathBuilder: paths.buildProjectFilePreviewPath,
    owningRootAbs: paths.sourceDirAbs,
  }));

  return failures;
}

function validateThemeSource(css, paths, sourceName = 'theme.css') {
  throwFindings(sourceName, collectThemeSourceFailures(css, paths, sourceName)
    .map((message) => createPolicyFinding(sourceName, 'theme', message)));
}

export function collectThemePolicyFindings(paths, options = {}) {
  const sourceName = options.sourceName || paths.buildDisplayPath(paths.themeCssAbs);
  if (!existsSync(paths.themeCssAbs)) {
    return [createPolicyFinding(sourceName, 'theme', `Add theme.css in ${paths.sourceDirRel}.`)];
  }

  return collectThemeSourceFailures(readFileSync(paths.themeCssAbs, 'utf-8'), paths, sourceName)
    .map((message) => createPolicyFinding(sourceName, 'theme', message));
}

export function validateDeckSource(html, sourceName = 'virtual deck') {
  const failures = [];

  if (!html.includes(CANVAS_LAYER_ORDER)) {
    failures.push(
      `Add the exact layer declaration "${CANVAS_LAYER_ORDER}" near the top of the document so canvas stays above theme and content.`
    );
  }

  if (INLINE_STYLE_RE.test(html)) {
    failures.push(
      'Remove inline style attributes. Keep presentation styling in theme.css or slide-local CSS so the framework can enforce ownership boundaries.'
    );
  }

  for (const match of html.matchAll(STYLE_BLOCK_RE)) {
    const css = match[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!css) {
      continue;
    }

    if (!css.startsWith('@layer')) {
      failures.push(
        'Wrap every <style> block in an explicit @layer rule. Unlayered CSS can silently bypass the framework contract.'
      );
      break;
    }
  }

  if (failures.length > 0) {
    formatFailures(sourceName, failures);
  }
}

function collectSlideHtmlSourceFailures(html, slideEntry, paths, sourceName = 'slide.html') {
  const failures = [];
  const normalized = stripHtmlComments(html);
  const rootMatches = [...normalized.matchAll(SLIDE_ROOT_RE)]
    .filter((match) => hasSlideRootClass(match[3]));

  if (TODO_MARKER_RE.test(html)) {
    failures.push('Replace every [[TODO_...]] marker in slide.html before continuing.');
  }

  if (INLINE_STYLE_RE.test(html)) {
    failures.push('Remove inline style attributes from slide.html. Move styling into theme.css or this slide folder\'s slide.css.');
  }

  if (getNonEmptyStyleBlockCount(html) > 0) {
    failures.push('Remove <style> blocks from slide.html. Put all slide-specific CSS in slide.css.');
  }

  if (FORBIDDEN_SLIDE_TAG_RE.test(html) || DATA_SLIDE_RE.test(html)) {
    failures.push('Slide fragments must not include <html>, <head>, <body>, <section>, or data-slide wrappers. The runtime generates those.');
  }

  if (rootMatches.length !== 1) {
    failures.push('Each slide.html must contain exactly one slide root with class ".slide", ".slide-wide", or ".slide-hero".');
  } else if (!normalized.startsWith(rootMatches[0][0])) {
    failures.push('slide.html must begin with the slide root element directly. Remove wrapper nodes around the slide root.');
  } else if (!hasSingleTopLevelElement(normalized)) {
    failures.push('slide.html must contain exactly one top-level slide root. Remove extra siblings or text outside the slide root.');
  }

  failures.push(...validateHtmlAssetReferences(html, {
    sourceName,
    baseDirAbs: slideEntry.slideDirAbs,
    allowedRoots: getSlideAssetRoots(paths, slideEntry),
    previewPathBuilder: paths.buildProjectFilePreviewPath,
    owningRootAbs: paths.sourceDirAbs,
  }));

  return failures;
}

export function validateSlideHtmlSource(html, slideEntry, paths, sourceName = 'slide.html') {
  throwFindings(
    sourceName || `slide ${slideEntry.slideId}`,
    collectSlideHtmlSourceFailures(html, slideEntry, paths, sourceName)
      .map((message) => createPolicyFinding(sourceName, 'content', message, slideEntry.slideId))
  );
}

function collectSlideCssSourceFailures(css, slideEntry, paths, sourceName = 'slide.css') {
  const failures = [];
  const scopePrefix = `#${slideEntry.slideId}`;
  const customRootClassSelectors = getSlideRootClassList(readFileSync(slideEntry.slideHtmlAbs, 'utf-8'))
    .filter((className) => !['slide', 'slide-wide', 'slide-hero'].includes(className))
    .map((className) => `.${className}`);

  if (!CONTENT_LAYER_RE.test(css)) {
    failures.push('Wrap all slide.css rules in @layer content so slide-local tweaks stay below theme and canvas.');
  }

  if (IMPORTANT_RE.test(css)) {
    failures.push('Remove !important from slide.css. Slide-local CSS must cooperate with the framework instead of forcing overrides.');
  }

  for (const token of findStructuralTokenOverrides(css)) {
    failures.push(`Do not override structural canvas token "${token}" from slide.css. Structural stage tokens must stay in framework/canvas/canvas.css.`);
  }

  for (const rule of extractCssRules(css)) {
    const selectors = rule.selectorGroup.split(',').map((selector) => normalizeSelector(selector)).filter(Boolean);
    for (const selector of selectors) {
      if (!selectorStartsWithPrefix(selector, scopePrefix)) {
        failures.push(`Scope "${selector}" to "${scopePrefix}" so this slide cannot leak styles into other slides.`);
        continue;
      }

      const localSelector = selector.slice(scopePrefix.length).trim();
      if (!selector.startsWith(`${scopePrefix} `)) {
        failures.push(`Do not target the generated slide wrapper "${scopePrefix}" directly. Scope slide.css to descendants inside the slide root.`);
        continue;
      }
      if (localSelector && isProtectedCanvasSelector(localSelector)) {
        failures.push(`Keep canvas-owned selectors out of "${selector}". Use local wrapper classes instead of restyling canvas primitives.`);
      }

      if (localSelector && isRuntimeChromeSelector(localSelector)) {
        failures.push(`Keep runtime chrome selectors out of "${selector}". Slide CSS may not restyle preview/export controls.`);
      }

      for (const rootClassSelector of customRootClassSelectors) {
        if (localSelector && selectorContainsPrefix(localSelector, rootClassSelector)) {
          failures.push(`Do not target the slide root through custom root class "${rootClassSelector}" in "${selector}". Keep root-level stage styling inside the sacred canvas only.`);
        }
      }

      if (selectorTouchesThemePrimitive(selector) && RESTRICTED_THEME_DECLARATION_RE.test(rule.declarations)) {
        failures.push(
          `Keep theme styling out of "${selector}". Slide CSS may compose layout, but colors, typography, borders, and shadows belong in theme.css.`
        );
      }
    }
  }

  failures.push(...validateCssAssetReferences(css, {
    sourceName,
    baseDirAbs: slideEntry.slideDirAbs,
    allowedRoots: getSlideAssetRoots(paths, slideEntry),
    previewPathBuilder: paths.buildProjectFilePreviewPath,
    owningRootAbs: paths.sourceDirAbs,
  }));

  return failures;
}

export function validateSlideCssSource(css, slideEntry, paths, sourceName = 'slide.css') {
  throwFindings(
    sourceName,
    collectSlideCssSourceFailures(css, slideEntry, paths, sourceName)
      .map((message) => createPolicyFinding(sourceName, 'content', message, slideEntry.slideId))
  );
}

export function collectBoundaryPolicyFindings(paths, options = {}) {
  const findings = [];
  const entries = listSlideSourceEntries(paths);
  const requestedSlideId = options.slideId || '';

  for (const entry of entries) {
    if (!entry.isValidName) {
      if (!requestedSlideId) {
        findings.push(createPolicyFinding(
          entry.slideDirRel,
          'boundaries',
          `Rename "${entry.slideDirRel}" to use the pattern NNN-slide-id with lowercase letters, numbers, and hyphens.`
        ));
      }
      continue;
    }

    if (requestedSlideId && entry.slideId !== requestedSlideId) {
      continue;
    }

    findings.push(
      ...validateSlideFolderEntries(entry).map((message) => createPolicyFinding(entry.slideDirRel, 'boundaries', message, entry.slideId))
    );

    if (!existsSync(entry.slideHtmlAbs)) {
      findings.push(createPolicyFinding(entry.slideHtmlRel, 'boundaries', `Add slide.html inside ${entry.slideDirRel}.`, entry.slideId));
      continue;
    }

    findings.push(
      ...collectSlideHtmlSourceFailures(readFileSync(entry.slideHtmlAbs, 'utf-8'), entry, paths, entry.slideHtmlRel)
        .map((message) => createPolicyFinding(entry.slideHtmlRel, 'content', message, entry.slideId))
    );

    if (existsSync(entry.slideCssAbs)) {
      findings.push(
        ...collectSlideCssSourceFailures(readFileSync(entry.slideCssAbs, 'utf-8'), entry, paths, entry.slideCssRel)
          .map((message) => createPolicyFinding(entry.slideCssRel, 'content', message, entry.slideId))
      );
    }
  }

  return findings;
}

// -----------------------------------------------------------------------------
// Workspace Validation
// -----------------------------------------------------------------------------

export function validateSlideDeckWorkspace(paths) {
  const failures = [];
  const entries = listSlideSourceEntries(paths);

  if (!existsSync(paths.themeCssAbs)) {
    failures.push(`Add theme.css in ${paths.sourceDirRel}.`);
  }

  if (!existsSync(paths.briefAbs)) {
    failures.push(`Add brief.md in ${paths.sourceDirRel} and normalize the user's request before continuing.`);
  }

  if (entries.length === 0) {
    failures.push(`Add at least one slide folder under ${paths.slidesDirRel} using the pattern NNN-slide-id.`);
  }

  const seenOrder = new Map();
  const seenIds = new Map();
  for (const entry of entries) {
    if (!entry.isValidName) {
      failures.push(`Rename "${entry.slideDirRel}" to use the pattern NNN-slide-id with lowercase letters, numbers, and hyphens.`);
      continue;
    }

    if (seenOrder.has(entry.orderLabel)) {
      failures.push(`Slide folders "${seenOrder.get(entry.orderLabel)}" and "${entry.slideDirRel}" share the same order prefix ${entry.orderLabel}.`);
    } else {
      seenOrder.set(entry.orderLabel, entry.slideDirRel);
    }

    if (seenIds.has(entry.slideId)) {
      failures.push(`Slide folders "${seenIds.get(entry.slideId)}" and "${entry.slideDirRel}" derive the same slide id "${entry.slideId}".`);
    } else {
      seenIds.set(entry.slideId, entry.slideDirRel);
    }
  }

  if (failures.length > 0) {
    formatFailures(paths.sourceDirRel, failures);
  }

  validateThemeSource(readFileSync(paths.themeCssAbs, 'utf-8'), paths, paths.buildDisplayPath(paths.themeCssAbs));
  validateEffectiveCanvasSource(paths, 'framework/canvas/canvas.css');
  validateBriefSource(readFileSync(paths.briefAbs, 'utf-8'), paths.buildDisplayPath(paths.briefAbs));

  if (entries.length > LONG_DECK_OUTLINE_THRESHOLD) {
    if (!existsSync(paths.outlineAbs)) {
      failures.push(`Add outline.md in ${paths.sourceDirRel} before building a deck with more than ${LONG_DECK_OUTLINE_THRESHOLD} slides.`);
    } else {
      validateOutlineSource(readFileSync(paths.outlineAbs, 'utf-8'), paths.buildDisplayPath(paths.outlineAbs));
    }
  }

  for (const entry of entries.filter((item) => item.isValidName)) {
    failures.push(...validateSlideFolderEntries(entry));

    if (!existsSync(entry.slideHtmlAbs)) {
      failures.push(`Add slide.html inside ${entry.slideDirRel}.`);
      continue;
    }

    validateSlideHtmlSource(readFileSync(entry.slideHtmlAbs, 'utf-8'), entry, paths, entry.slideHtmlRel);

    if (existsSync(entry.slideCssAbs)) {
      validateSlideCssSource(readFileSync(entry.slideCssAbs, 'utf-8'), entry, paths, entry.slideCssRel);
    }
  }

  if (failures.length > 0) {
    formatFailures(paths.sourceDirRel, failures);
  }
}
