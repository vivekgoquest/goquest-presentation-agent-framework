import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { runAuditAll, runBoundaryAudit, runThemeAudit } from '../audit-service.js';

function createTempProjectRoot() {
  return mkdtempSync(resolve(tmpdir(), 'pf-audit-service-'));
}

function fillBrief(projectRoot, title = 'Audit Service Brief') {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      `# ${title}`,
      '',
      '## Goal',
      '',
      'Validate normalized audit envelopes.',
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
      '- Deterministic issue envelopes.',
      '',
      '## Constraints',
      '',
      '- none',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );
}

test('runThemeAudit returns deterministic issue envelopes', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot, 'Theme Audit Envelope');

  writeFileSync(
    resolve(projectRoot, 'theme.css'),
    [
      '@layer theme {',
      '  :root {',
      '    --slide-max-w: 960px;',
      '  }',
      '}',
      '',
    ].join('\n')
  );

  const result = await runThemeAudit(projectRoot);

  assert.equal(result.status, 'fail');
  assert.equal(result.family, 'theme');
  assert.deepEqual(result.nextFocus, ['theme.css']);
  assert.deepEqual(result.issues, [
    {
      code: 'theme.structural-token-override',
      family: 'theme',
      layer: 'theme',
      message: 'Do not override structural canvas token "--slide-max-w" from theme.css. Structural stage tokens must stay in framework/canvas/canvas.css.',
      severity: 'error',
      slideId: null,
      source: 'theme.css',
    },
  ]);
});

test('runBoundaryAudit reports selector scope violations', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot, 'Boundary Audit Envelope');

  writeFileSync(
    resolve(projectRoot, 'slides', '010-intro', 'slide.css'),
    [
      '@layer content {',
      '  .rogue-node {',
      '    opacity: 0.25;',
      '  }',
      '}',
      '',
    ].join('\n')
  );

  const result = await runBoundaryAudit(projectRoot, { slideId: 'intro' });

  assert.equal(result.status, 'fail');
  assert.equal(result.family, 'boundaries');
  assert.deepEqual(result.scope, {
    projectRoot,
    slideId: 'intro',
  });
  assert.deepEqual(result.nextFocus, ['slides/010-intro/slide.css']);
  assert.deepEqual(result.issues, [
    {
      code: 'boundary.illegal-selector-scope',
      family: 'boundaries',
      layer: 'content',
      message: 'Scope ".rogue-node" to "#intro" so this slide cannot leak styles into other slides.',
      severity: 'error',
      slideId: 'intro',
      source: 'slides/010-intro/slide.css',
    },
  ]);
});

test('runAuditAll merges theme, canvas, and boundary families', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: true });
  fillBrief(projectRoot, 'Audit All Merge');

  writeFileSync(
    resolve(projectRoot, 'theme.css'),
    [
      '@layer theme {',
      '  :root {',
      '    --slide-max-w: 960px;',
      '  }',
      '}',
      '',
    ].join('\n')
  );

  writeFileSync(
    resolve(projectRoot, 'slides', '010-intro', 'slide.css'),
    [
      '@layer content {',
      '  .rogue-node {',
      '    opacity: 0.25;',
      '  }',
      '}',
      '',
    ].join('\n')
  );

  const canvasCssPath = resolve(projectRoot, '.presentation', 'framework', 'base', 'canvas', 'canvas.css');
  writeFileSync(
    canvasCssPath,
    readFileSync(canvasCssPath, 'utf-8').replace('--slide-max-w: 1200px;', '--slide-max-w: 960px;')
  );

  const result = await runAuditAll(projectRoot, { slideId: 'intro' });

  assert.equal(result.status, 'fail');
  assert.equal(result.family, 'all');
  assert.deepEqual(result.issues.map((issue) => issue.code), [
    'theme.structural-token-override',
    'canvas.structural-token-drift',
    'boundary.illegal-selector-scope',
  ]);
  assert.deepEqual(result.nextFocus, [
    'theme.css',
    'framework/canvas/canvas.css',
    'slides/010-intro/slide.css',
  ]);
  assert.deepEqual(result.families, {
    theme: { issueCount: 1, status: 'fail' },
    canvas: { issueCount: 1, status: 'fail' },
    boundaries: { issueCount: 1, status: 'fail' },
  });
});
