import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { getProjectPaths } from '../deck-paths.js';
import { validateSlideDeckWorkspace } from '../deck-policy.js';

function createTempProjectRoot() {
  return mkdtempSync(resolve(tmpdir(), 'pf-deck-policy-'));
}

function fillBrief(projectRoot, title = 'Deck Policy Brief') {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      `# ${title}`,
      '',
      '## Goal',
      '',
      'Validate the deck policy contract.',
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
      '- No structural canvas overrides.',
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

test('deck policy rejects theme overrides of structural canvas tokens', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot, 'Theme Structural Token Override');

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

  assert.throws(
    () => validateSlideDeckWorkspace(getProjectPaths(projectRoot)),
    /--slide-max-w/i
  );
});

test('deck policy rejects slide-local css that targets runtime chrome selectors', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot, 'Runtime Chrome Scope Violation');

  const slideCssPath = resolve(projectRoot, 'slides', '010-intro', 'slide.css');
  writeFileSync(
    slideCssPath,
    [
      '@layer content {',
      '  #010-intro .runtime-dot-nav {',
      '    opacity: 0.25;',
      '  }',
      '}',
      '',
    ].join('\n')
  );

  assert.throws(
    () => validateSlideDeckWorkspace(getProjectPaths(projectRoot)),
    /runtime-dot-nav/i
  );
});

test('deck policy rejects slide-local css that mutates structural tokens through the generated slide wrapper', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot, 'Wrapper Structural Token Override');

  const slideCssPath = resolve(projectRoot, 'slides', '010-intro', 'slide.css');
  writeFileSync(
    slideCssPath,
    [
      '@layer content {',
      '  #intro {',
      '    --slide-ratio: 1 / 1;',
      '  }',
      '}',
      '',
    ].join('\n')
  );

  assert.throws(
    () => validateSlideDeckWorkspace(getProjectPaths(projectRoot)),
    /--slide-ratio|wrapper|section/i
  );
});

test('deck policy rejects slide fragments with extra top-level nodes outside the slide root', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot, 'Extra Top Level Nodes');

  const slideHtmlPath = resolve(projectRoot, 'slides', '010-intro', 'slide.html');
  writeFileSync(
    slideHtmlPath,
    [
      '<div class="slide slide-hero">',
      '  <h1>Valid root</h1>',
      '</div>',
      '<div class="rogue-node">outside root</div>',
      '',
    ].join('\n')
  );

  assert.throws(
    () => validateSlideDeckWorkspace(getProjectPaths(projectRoot)),
    /exactly one top-level|single top-level|wrapper nodes/i
  );
});

test('deck policy rejects slide-local css that targets the slide root through a custom root class', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot, 'Custom Root Class Contamination');

  const slideHtmlPath = resolve(projectRoot, 'slides', '010-intro', 'slide.html');
  writeFileSync(
    slideHtmlPath,
    [
      '<div class="slide slide-hero hero-surface">',
      '  <h1>Valid root</h1>',
      '</div>',
      '',
    ].join('\n')
  );

  const slideCssPath = resolve(projectRoot, 'slides', '010-intro', 'slide.css');
  writeFileSync(
    slideCssPath,
    [
      '@layer content {',
      '  #intro .hero-surface {',
      '    max-width: 800px;',
      '  }',
      '}',
      '',
    ].join('\n')
  );

  assert.throws(
    () => validateSlideDeckWorkspace(getProjectPaths(projectRoot)),
    /hero-surface|slide root|root class/i
  );
});
