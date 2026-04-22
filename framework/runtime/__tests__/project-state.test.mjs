import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { refreshDesignState } from '../design-state.js';
import { getProjectState } from '../project-state.js';
import { writeArtifacts, writeDesignState, writeRenderState } from '../presentation-runtime-state.js';
import { computeSourceFingerprint } from '../source-fingerprint.js';

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

test('getProjectState marks design state stale when source moves after ledger generation', () => {
  const projectRoot = createTempProjectRoot();

  try {
    createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
    fillBrief(projectRoot);
    fillAllSlides(projectRoot);
    refreshDesignState(projectRoot);
    writeFileSync(
      resolve(projectRoot, 'theme.css'),
      '@layer theme { :root { --color-accent: #000000; } }\n'
    );

    const state = getProjectState(projectRoot);

    assert.equal(state.facets.designState, 'stale');
    assert.equal(state.designStateAvailable, true);
    assert.match(state.lastDesignStateGeneratedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(state.nextFocus.includes('presentation audit all'));
    assert.match(state.nextStep, /design-state ledger is not current/i);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('getProjectState points nextStep at audit when render evidence is current but design state is stale', () => {
  const projectRoot = createTempProjectRoot();

  try {
    createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
    fillBrief(projectRoot);
    fillAllSlides(projectRoot);

    const sourceFingerprint = computeSourceFingerprint(projectRoot);
    writeRenderState(projectRoot, {
      status: 'pass',
      sourceFingerprint,
      generatedAt: '2026-04-22T00:00:00.000Z',
    });
    writeDesignState(projectRoot, {
      sourceFingerprint: 'sha256:stale-design-state',
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    const state = getProjectState(projectRoot);

    assert.equal(state.facets.evidence, 'current');
    assert.equal(state.facets.designState, 'stale');
    assert.deepEqual(state.nextFocus, ['presentation audit all']);
    assert.match(state.nextStep, /presentation audit all/i);
    assert.match(state.nextStep, /design-state ledger is not current/i);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('getProjectState keeps nextStep audit-focused when finalized output and design state are stale', () => {
  const projectRoot = createTempProjectRoot();

  try {
    createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
    fillBrief(projectRoot);
    fillAllSlides(projectRoot);

    const sourceFingerprint = computeSourceFingerprint(projectRoot);
    writeFileSync(resolve(projectRoot, 'deck.pdf'), 'stale finalized pdf\n');
    writeArtifacts(projectRoot, {
      sourceFingerprint,
      finalized: {
        exists: true,
        pdf: { path: 'deck.pdf' },
      },
    });
    writeDesignState(projectRoot, {
      sourceFingerprint,
      generatedAt: '2026-04-22T00:00:00.000Z',
    });

    writeFileSync(
      resolve(projectRoot, 'theme.css'),
      '@layer theme { :root { --color-accent: #111111; } }\n'
    );

    const state = getProjectState(projectRoot);

    assert.equal(state.facets.delivery, 'finalized_stale');
    assert.equal(state.facets.designState, 'stale');
    assert.deepEqual(state.nextFocus, ['presentation audit all']);
    assert.match(state.nextStep, /presentation audit all/i);
    assert.match(state.nextStep, /design-state ledger is not current/i);
    assert.doesNotMatch(state.nextStep, /presentation export again/i);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
