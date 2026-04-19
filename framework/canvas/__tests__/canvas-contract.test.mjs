import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { renderPresentationHtml } from '../../runtime/deck-assemble.js';
import { createPresentationScaffold } from '../../runtime/services/scaffold-service.mjs';
import {
  CANVAS_LAYER_ORDER,
  CANVAS_STAGE,
  CANVAS_STRUCTURAL_TOKENS,
  CANVAS_THEME_VARIABLE_ALLOWLIST,
  PROTECTED_CANVAS_SELECTORS,
} from '../canvas-contract.mjs';

const REPO_ROOT = process.cwd();

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-canvas-contract-'));
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Canvas Contract Brief',
      '',
      '## Goal',
      '',
      'Render shell-less preview HTML through the shared runtime assembler.',
      '',
      '## Audience',
      '',
      'Framework maintainers.',
      '',
      '## Tone',
      '',
      'Operational and concise.',
      '',
      '## Must Include',
      '',
      '- Canvas contract regression coverage.',
      '',
      '## Constraints',
      '',
      '- none',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );
}

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

test('runtime output preserves slide sections without reviving export chrome', (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);

  const rendered = renderPresentationHtml({ projectRoot });

  assert.match(rendered.html, /<section\b[^>]*data-slide\b/);
  assert.doesNotMatch(rendered.html, /runtime-export-bar/);
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
