import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-native-host-'));
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Native Host Brief',
      '',
      '## Goal',
      '',
      'Validate extracted runtime services against a real scaffolded project.',
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
      '- Service extraction for Electron migration.',
      '',
      '## Constraints',
      '',
      '- Keep the existing deck contract intact.',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );
}

test('scaffold service creates a linked project scaffold', async (t) => {
  const { createPresentationScaffold } = await import('../scaffold-service.mjs');
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  const result = await createPresentationScaffold(
    { projectRoot },
    { slideCount: 3, copyFramework: false }
  );

  assert.equal(result.status, 'created');
  assert.equal(result.frameworkMode, 'linked');
  assert.ok(existsSync(resolve(projectRoot, 'theme.css')));
  assert.ok(existsSync(resolve(projectRoot, 'slides', '010-intro', 'slide.html')));
  assert.ok(existsSync(resolve(projectRoot, '.presentation', 'project.json')));

  const metadata = JSON.parse(readFileSync(resolve(projectRoot, '.presentation', 'project.json'), 'utf8'));
  assert.equal(metadata.frameworkMode, 'linked');
});

test('runtime services operate on a real scaffolded project', async (t) => {
  const [
    { createPresentationScaffold },
    { capturePresentation },
    { runDeckCheck },
    { exportDeckPdf },
    { finalizePresentation },
  ] = await Promise.all([
    import('../scaffold-service.mjs'),
    import('../capture-service.mjs'),
    import('../check-service.mjs'),
    import('../export-service.mjs'),
    import('../finalize-service.mjs'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot);

  const captureDir = resolve(projectRoot, '.artifacts', 'capture');
  const capture = await capturePresentation({ projectRoot }, captureDir);
  assert.ok(capture.slideCount >= 1);
  assert.ok(existsSync(resolve(captureDir, 'report.json')));

  const checkDir = resolve(projectRoot, '.artifacts', 'check');
  const check = await runDeckCheck({ projectRoot }, { outputDir: checkDir });
  assert.equal(check.status, 'pass');

  const exportPath = resolve(projectRoot, 'outputs', 'service-export.pdf');
  const exported = await exportDeckPdf({ projectRoot }, exportPath);
  assert.equal(exported.outputPath, exportPath);
  assert.ok(existsSync(exportPath));
  assert.equal(readFileSync(exportPath).subarray(0, 4).toString(), '%PDF');

  const finalized = await finalizePresentation({ projectRoot });
  assert.equal(finalized.status, 'pass');
  assert.ok(existsSync(resolve(projectRoot, 'outputs', 'deck.pdf')));
  assert.ok(existsSync(resolve(projectRoot, 'outputs', 'report.json')));
  assert.ok(existsSync(resolve(projectRoot, 'outputs', 'summary.md')));
});
