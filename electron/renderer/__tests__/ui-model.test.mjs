import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveActionUiModel,
  deriveProjectUiModel,
  normalizeRuntimeActionResult,
} from '../ui-model.js';

test('deriveProjectUiModel keeps the main shell minimal during onboarding', () => {
  const model = deriveProjectUiModel({
    meta: { active: true },
    projectState: {
      status: 'onboarding',
      nextStep: 'Complete brief.md with the normalized user request.',
      slidesComplete: 0,
      slidesTotal: 3,
      briefComplete: false,
      outlineRequired: false,
      outlineComplete: true,
      pdfReady: false,
      lastPolicyError: 'Deck policy violation in brief.md',
    },
  });

  assert.equal(model.hasProject, true);
  assert.equal(model.actions.check.enabled, true);
  assert.equal(model.actions.build.enabled, false);
  assert.equal(model.actions.export.enabled, false);
  assert.equal(model.preview.showChrome, false);
  assert.equal(model.status.visible, false);
});

test('deriveProjectUiModel keeps advanced actions available when project is ready', () => {
  const model = deriveProjectUiModel({
    meta: { active: true },
    projectState: {
      status: 'ready_to_finalize',
      nextStep: 'Run finalize to generate the deck outputs.',
      slidesComplete: 3,
      slidesTotal: 3,
      briefComplete: true,
      outlineRequired: false,
      outlineComplete: true,
      pdfReady: false,
      lastPolicyError: '',
    },
  });

  assert.equal(model.actions.check.enabled, true);
  assert.equal(model.actions.build.enabled, true);
  assert.equal(model.actions.export.enabled, true);
  assert.equal(model.actions.more.enabled, true);
  assert.equal(model.preview.showChrome, false);
  assert.equal(model.status.visible, false);
});

test('normalizeRuntimeActionResult treats needs-review as warning and fail as error', () => {
  const review = normalizeRuntimeActionResult('Build', {
    status: 'needs-review',
    issues: ['These slides overflowed their canvas: 010-hero.'],
    qualityWarnings: ['Slide 010-hero has low image coverage.'],
  });

  assert.equal(review.tone, 'warning');
  assert.match(review.message, /needs review/i);
  assert.match(review.detail, /overflowed/i);

  const failure = normalizeRuntimeActionResult('Build', {
    status: 'fail',
    issues: ['Deck policy violation in brief.md'],
  });

  assert.equal(failure.tone, 'error');
  assert.match(failure.message, /failed/i);
  assert.match(failure.detail, /brief\.md/i);
});

test('deriveActionUiModel keeps toolbar actions separate from menu actions', () => {
  const model = deriveActionUiModel({
    meta: { active: true },
    projectState: { status: 'ready_to_finalize' },
    reviewAvailability: {
      run: true,
      revise: true,
      fixWarnings: false,
      reasonUnavailable: 'Review actions are unavailable right now.',
    },
  });

  assert.equal(model.primary?.id, 'build.finalize');
  assert.equal(model.secondary?.id, 'export.start');
  assert.deepEqual(
    model.menu.map((action) => action.id),
    ['build.check', 'build.captureScreenshots', 'review.run', 'review.revise', 'review.fixWarnings']
  );
  assert.equal(model.menu.find((action) => action.id === 'review.fixWarnings')?.enabled, false);
});

test('normalizeRuntimeActionResult preserves explicit detail on successful export actions', () => {
  const result = normalizeRuntimeActionResult('Export', {
    status: 'pass',
    detail: 'Saved 2 PNG files to /tmp/exports',
  });

  assert.equal(result.tone, 'success');
  assert.match(result.message, /completed/i);
  assert.match(result.detail, /Saved 2 PNG files/i);
});
