import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CANVAS_LAYER_ORDER,
  CANVAS_STAGE,
  CANVAS_STRUCTURAL_TOKENS,
  CANVAS_THEME_VARIABLE_ALLOWLIST,
  PROTECTED_CANVAS_SELECTORS,
} from '../canvas-contract.mjs';

const REPO_ROOT = process.cwd();

test('canvas contract exports the canonical structural truth', () => {
  assert.equal(CANVAS_LAYER_ORDER, '@layer content, theme, canvas;');
  assert.equal(CANVAS_STAGE.slideMaxWidth, 1200);
  assert.equal(CANVAS_STAGE.slideWideMaxWidth, 1300);
  assert.equal(CANVAS_STAGE.slideRatio, '16 / 9');
  assert.deepEqual(CANVAS_STAGE.viewport, { width: 1280, height: 720 });

  assert(CANVAS_STRUCTURAL_TOKENS.includes('--slide-max-w'));
  assert(CANVAS_STRUCTURAL_TOKENS.includes('--slide-wide-max-w'));
  assert(CANVAS_STRUCTURAL_TOKENS.includes('--slide-ratio'));
  assert(CANVAS_THEME_VARIABLE_ALLOWLIST.includes('--canvas-slide-bg'));
  assert(PROTECTED_CANVAS_SELECTORS.includes('.slide'));
  assert(!PROTECTED_CANVAS_SELECTORS.includes('.dot-nav'));
  assert(!PROTECTED_CANVAS_SELECTORS.includes('.export-bar'));
  assert(!PROTECTED_CANVAS_SELECTORS.includes('.runtime-dot-nav'));
  assert(!PROTECTED_CANVAS_SELECTORS.includes('.runtime-export-bar'));
});

test('canvas css stays structural and does not own runtime chrome', () => {
  const canvasCss = readFileSync(resolve(REPO_ROOT, 'framework/canvas/canvas.css'), 'utf8');
  const runtimeChromeCss = readFileSync(resolve(REPO_ROOT, 'framework/runtime/runtime-chrome.css'), 'utf8');

  assert.match(canvasCss, /--slide-max-w:\s*1200px;/);
  assert.match(canvasCss, /--slide-wide-max-w:\s*1300px;/);
  assert.match(canvasCss, /--slide-ratio:\s*16 \/ 9;/);
  assert.doesNotMatch(canvasCss, /\.dot-nav\b/);
  assert.doesNotMatch(canvasCss, /\.export-bar\b/);
  assert.doesNotMatch(canvasCss, /--canvas-export-bar-bg:/);
  assert.doesNotMatch(canvasCss, /--canvas-dot-color:/);
  assert.match(runtimeChromeCss, /@layer theme\s*\{\s*:root\s*\{/);
});

test('deck policy imports the shared canvas contract instead of duplicating structural constants', () => {
  const deckPolicySource = readFileSync(resolve(REPO_ROOT, 'framework/runtime/deck-policy.js'), 'utf8');

  assert.match(deckPolicySource, /from ['"]\.\.\/canvas\/canvas-contract\.mjs['"]/);
  assert.doesNotMatch(deckPolicySource, /const EXPECTED_LAYER_ORDER = ['"]@layer content, theme, canvas;['"]/);
  assert.doesNotMatch(deckPolicySource, /const PROTECTED_CANVAS_PREFIXES = \[/);
});

test('preview host stays viewer-only and does not style protected canvas selectors', () => {
  const previewShellSource = readFileSync(resolve(REPO_ROOT, 'electron/preview-document-shell.mjs'), 'utf8');

  assert.doesNotMatch(previewShellSource, /\.slide\b/);
  assert.doesNotMatch(previewShellSource, /\.slide-wide\b/);
  assert.doesNotMatch(previewShellSource, /\.slide-hero\b/);
  assert.doesNotMatch(previewShellSource, /\.g2\b/);
  assert.doesNotMatch(previewShellSource, /\.g3\b/);
  assert.doesNotMatch(previewShellSource, /\.g4\b/);
  assert.doesNotMatch(previewShellSource, /\.runtime-dot-nav\b/);
  assert.doesNotMatch(previewShellSource, /\.runtime-export-bar\b/);
  assert.match(previewShellSource, /section\[data-slide\]/);
});

test('runtime chrome contract stays focused on viewer controls, not export actions', () => {
  const runtimeChromeCss = readFileSync(resolve(REPO_ROOT, 'framework/runtime/runtime-chrome.css'), 'utf8');
  const runtimeChromeContract = readFileSync(resolve(REPO_ROOT, 'framework/runtime/runtime-chrome-contract.mjs'), 'utf8');
  const themeCss = readFileSync(resolve(REPO_ROOT, 'framework/templates/theme.css'), 'utf8');

  assert.match(runtimeChromeContract, /\.runtime-dot-nav/);
  assert.doesNotMatch(runtimeChromeContract, /\.runtime-export-bar/);
  assert.match(runtimeChromeCss, /\.runtime-dot-nav\b/);
  assert.doesNotMatch(runtimeChromeCss, /\.runtime-export-bar\b/);
  assert.doesNotMatch(runtimeChromeCss, /--runtime-export-bar-bg:/);
  assert.doesNotMatch(themeCss, /--runtime-export-bar-bg:/);
  assert.doesNotMatch(themeCss, /--runtime-export-button-bg:/);
});
