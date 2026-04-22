import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePackageStatus } from '../status-service.js';

test('derivePackageStatus returns authoring with stale finalized outputs when source changed after finalize', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'finalized_stale',
    evidence: 'current',
    canonicalPdfPath: 'deck.pdf',
  });

  assert.equal(status.workflow, 'authoring');
  assert.deepEqual(status.facets, {
    delivery: 'finalized_stale',
    evidence: 'current',
    designState: 'unknown',
  });
  assert.deepEqual(status.nextFocus, ['presentation export', 'deck.pdf']);
});

test('derivePackageStatus returns ready_for_finalize with export-focused guidance when blockers are absent and evidence is current', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'not_finalized',
    evidence: 'current',
  });

  assert.equal(status.workflow, 'ready_for_finalize');
  assert.deepEqual(status.facets, {
    delivery: 'not_finalized',
    evidence: 'current',
    designState: 'unknown',
  });
  assert.deepEqual(status.nextFocus, ['presentation export']);
});

test('derivePackageStatus focuses audit when design state is stale without blocking authoring', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'not_finalized',
    evidence: 'current',
    designStateEvidence: 'stale',
  });

  assert.equal(status.workflow, 'authoring');
  assert.equal(status.facets.designState, 'stale');
  assert.deepEqual(status.nextFocus, ['presentation audit all']);
});

test('derivePackageStatus focuses audit when design state is stale even if finalized delivery is stale', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'finalized_stale',
    evidence: 'current',
    designStateEvidence: 'stale',
    canonicalPdfPath: 'deck.pdf',
  });

  assert.equal(status.workflow, 'authoring');
  assert.deepEqual(status.facets, {
    delivery: 'finalized_stale',
    evidence: 'current',
    designState: 'stale',
  });
  assert.match(status.summary, /design-state ledger is not current/i);
  assert.deepEqual(status.nextFocus, ['presentation audit all']);
});

test('derivePackageStatus focuses audit when design state is missing without blocking authoring', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'not_finalized',
    evidence: 'current',
    designStateEvidence: 'missing',
  });

  assert.equal(status.workflow, 'authoring');
  assert.equal(status.facets.designState, 'missing');
  assert.deepEqual(status.nextFocus, ['presentation audit all']);
});

test('derivePackageStatus returns blocked when a hard blocker is present', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 1,
    delivery: 'finalize_blocked',
    evidence: 'stale',
  });

  assert.equal(status.workflow, 'blocked');
  assert.deepEqual(status.facets, {
    delivery: 'finalize_blocked',
    evidence: 'stale',
    designState: 'unknown',
  });
});

test('derivePackageStatus returns finalized with the canonical root pdf as the next focus', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'finalized_current',
    evidence: 'current',
    canonicalPdfPath: 'deck.pdf',
  });

  assert.equal(status.workflow, 'finalized');
  assert.deepEqual(status.facets, {
    delivery: 'finalized_current',
    evidence: 'current',
    designState: 'unknown',
  });
  assert.deepEqual(status.nextFocus, ['deck.pdf']);
});

test('derivePackageStatus does not promote finalized delivery to finalized when evidence is missing', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'finalized_current',
    evidence: 'missing',
    canonicalPdfPath: 'deck.pdf',
  });

  assert.equal(status.workflow, 'authoring');
  assert.deepEqual(status.facets, {
    delivery: 'finalized_current',
    evidence: 'missing',
    designState: 'unknown',
  });
  assert.deepEqual(status.nextFocus, ['presentation audit all']);
});

test('derivePackageStatus keeps onboarding focused on brief.md and slides for normal scaffolds', () => {
  const status = derivePackageStatus({
    sourceComplete: false,
    blockerCount: 0,
    delivery: 'not_finalized',
    evidence: 'missing',
  });

  assert.equal(status.workflow, 'onboarding');
  assert.deepEqual(status.nextFocus, ['brief.md', 'slides/']);
});

test('derivePackageStatus adds outline.md guidance when long-deck onboarding is blocked on the outline', () => {
  const status = derivePackageStatus({
    sourceComplete: false,
    blockerCount: 0,
    delivery: 'not_finalized',
    evidence: 'missing',
    briefComplete: true,
    outlineRequired: true,
    outlineComplete: false,
    remainingSlideCount: 0,
  });

  assert.equal(status.workflow, 'onboarding');
  assert.deepEqual(status.nextFocus, ['outline.md']);
});
