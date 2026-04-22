import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

function createTempRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-source-fingerprint-'));
}

test('computeFileFingerprint and computePathFingerprint hash files deterministically', async () => {
  const { computeFileFingerprint, computePathFingerprint } = await import('../source-fingerprint.js');

  const root = createTempRoot();
  try {
    const singleFileAbs = resolve(root, 'theme.css');
    writeFileSync(singleFileAbs, 'body { color: black; }\n');

    const nestedDirAbs = resolve(root, 'assets', 'icons');
    mkdirSync(nestedDirAbs, { recursive: true });
    writeFileSync(resolve(nestedDirAbs, 'b.txt'), 'bravo\n');
    writeFileSync(resolve(nestedDirAbs, 'a.txt'), 'alpha\n');

    const fileFingerprint = computeFileFingerprint(singleFileAbs);
    const expectedFileHash = createHash('sha256').update('body { color: black; }\n').digest('hex');
    assert.equal(fileFingerprint, `sha256:${expectedFileHash}`);

    const pathFingerprint = computePathFingerprint(root, 'assets');
    assert.match(pathFingerprint, /^sha256:[0-9a-f]{64}$/);

    const expectedHash = createHash('sha256');
    expectedHash.update('assets/icons/a.txt\n');
    expectedHash.update('alpha\n');
    expectedHash.update('\n');
    expectedHash.update('assets/icons/b.txt\n');
    expectedHash.update('bravo\n');
    expectedHash.update('\n');

    assert.equal(pathFingerprint, `sha256:${expectedHash.digest('hex')}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
