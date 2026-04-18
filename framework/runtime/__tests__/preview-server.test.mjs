import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { previewPresentation } from '../preview-server.mjs';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-preview-server-'));
}

test('previewPresentation starts a preview server and stops cleanly in serve mode', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const preview = await previewPresentation(projectRoot, {
    installSignalHandlers: false,
  });
  t.after(async () => {
    await preview.stop();
    await preview.waitUntilClose;
  });

  assert.equal(preview.status, 'pass');
  assert.equal(preview.summary, 'Preview server started.');
  assert.match(preview.previewUrl, /^http:\/\/127\.0\.0\.1:\d+\/preview\/$/);

  const response = await fetch(preview.previewUrl);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/i);
});

test('previewPresentation opens the preview URL in open mode before returning', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });

  const openedUrls = [];
  const preview = await previewPresentation(projectRoot, {
    mode: 'open',
    installSignalHandlers: false,
    async openPreview(previewUrl) {
      openedUrls.push(previewUrl);
    },
  });
  t.after(async () => {
    await preview.stop();
    await preview.waitUntilClose;
  });

  assert.equal(preview.status, 'pass');
  assert.equal(preview.summary, 'Preview opened in the default browser.');
  assert.deepEqual(openedUrls, [preview.previewUrl]);
});
