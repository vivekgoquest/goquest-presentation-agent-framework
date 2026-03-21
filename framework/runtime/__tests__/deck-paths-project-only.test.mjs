import test from 'node:test';
import assert from 'node:assert/strict';

test('parsePresentationTargetCliArgs accepts project targets only', async () => {
  const { parsePresentationTargetCliArgs } = await import('../deck-paths.js');

  const parsed = parsePresentationTargetCliArgs(['--project', '/tmp/pf-target']);
  assert.equal(parsed.target.kind, 'project');
  assert.equal(parsed.target.projectRootAbs, '/tmp/pf-target');

  assert.throws(
    () => parsePresentationTargetCliArgs(['--deck', 'legacy']),
    /Legacy workspace target "--deck" was removed/
  );
  assert.throws(
    () => parsePresentationTargetCliArgs(['--example', 'legacy']),
    /Legacy workspace target "--example" was removed/
  );
});
