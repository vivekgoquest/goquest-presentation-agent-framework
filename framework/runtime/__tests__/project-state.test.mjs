import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { getProjectState } from '../project-state.js';

function createTempProjectRoot() {
  return mkdtempSync(resolve(tmpdir(), 'pf-project-state-'));
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Project State Brief',
      '',
      '## Goal',
      '',
      'Validate onboarding guidance for long-deck projects.',
      '',
    ].join('\n')
  );
}

function createCompleteSlideHtml(title) {
  return [
    '<div class="slide">',
    '  <div class="eyebrow">Project State Deck</div>',
    `  <h2 class="sect-title">${title}</h2>`,
    '  <div class="g2">',
    '    <div class="icard"><p class="body-text">Point one</p></div>',
    '    <div class="icard"><p class="body-text">Point two</p></div>',
    '  </div>',
    '</div>',
    '',
  ].join('\n');
}

function fillAllSlides(projectRoot) {
  const slidesRoot = resolve(projectRoot, 'slides');
  const slideDirs = readdirSync(slidesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  for (const [index, slideDir] of slideDirs.entries()) {
    writeFileSync(
      resolve(slidesRoot, slideDir, 'slide.html'),
      createCompleteSlideHtml(`Completed slide ${index + 1}`)
    );
  }
}

function addLongDeckSlide(projectRoot) {
  const slideDir = resolve(projectRoot, 'slides', '110-wrap-up');
  mkdirSync(slideDir, { recursive: true });
  writeFileSync(resolve(slideDir, 'slide.html'), createCompleteSlideHtml('Completed slide 11'));
}

test('getProjectState restores outline-specific onboarding guidance for long decks', () => {
  const projectRoot = createTempProjectRoot();

  try {
    createPresentationScaffold({ projectRoot }, { slideCount: 10, copyFramework: false });
    fillBrief(projectRoot);
    fillAllSlides(projectRoot);
    addLongDeckSlide(projectRoot);

    const state = getProjectState(projectRoot);

    assert.equal(state.workflow, 'onboarding');
    assert.equal(state.outlineRequired, true);
    assert.equal(state.outlineComplete, false);
    assert.deepEqual(state.nextFocus, ['outline.md']);
    assert.match(state.nextStep, /outline\.md/i);
    assert.match(state.nextStep, /story arc|outline/i);
    assert.doesNotMatch(state.nextStep, /remaining long-deck source materials/i);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
