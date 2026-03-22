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
  assert.equal(model.actions.validate.enabled, true);
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

  assert.equal(model.actions.validate.enabled, true);
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
    agentActionAvailability: {
      fixValidationIssues: false,
      reviewNarrative: true,
      applyNarrativeChanges: true,
      reviewVisual: true,
      applyVisualChanges: true,
      reasonUnavailable: 'Review actions are unavailable right now.',
    },
  });

  assert.equal(model.primary?.id, 'export_presentation');
  assert.equal(model.secondary?.id, 'validate_presentation');
  assert.deepEqual(
    model.menu.map((action) => action.id),
    [
      'capture_screenshots',
      'fix_validation_issues',
      'review_narrative_presentation',
      'apply_narrative_review_changes',
      'review_visual_presentation',
      'apply_visual_review_changes',
    ]
  );
  assert.equal(model.menu.find((action) => action.id === 'fix_validation_issues')?.enabled, false);
});

test('normalizeRuntimeActionResult treats started as success and blocked as error', () => {
  const started = normalizeRuntimeActionResult('Review visuals', {
    status: 'started',
    message: 'Visual review started in the agent terminal.',
  });
  assert.equal(started.tone, 'success');
  assert.match(started.message, /started/i);

  const blocked = normalizeRuntimeActionResult('Apply visual fixes', {
    status: 'blocked',
    message: 'Visual review issue file is missing.',
  });
  assert.equal(blocked.tone, 'error');
  assert.match(blocked.message, /missing/i);
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
