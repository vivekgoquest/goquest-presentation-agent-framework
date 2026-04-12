import test from 'node:test';
import assert from 'node:assert/strict';

import { derivePackageStatus } from '../status-service.js';

test('derivePackageStatus returns authoring with stale finalized outputs when source changed after finalize', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'finalized_stale',
    evidence: 'current',
  });

  assert.equal(status.workflow, 'authoring');
  assert.deepEqual(status.facets, {
    delivery: 'finalized_stale',
    evidence: 'current',
  });
});

test('derivePackageStatus returns ready_for_finalize when blockers are absent and evidence is current', () => {
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
  });
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
  });
});

test('derivePackageStatus returns finalized when finalized delivery is current', () => {
  const status = derivePackageStatus({
    sourceComplete: true,
    blockerCount: 0,
    delivery: 'finalized_current',
    evidence: 'current',
  });

  assert.equal(status.workflow, 'finalized');
  assert.deepEqual(status.facets, {
    delivery: 'finalized_current',
    evidence: 'current',
  });
});
