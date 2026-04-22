import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function createTempProjectRoot() {
  return mkdtempSync(join(tmpdir(), 'pf-design-state-'));
}

test('buildDesignState reports canvas as fixed and theme/content as working', async (t) => {
  const [{ createPresentationScaffold }, { buildDesignState }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../design-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  const state = buildDesignState(projectRoot);

  assert.equal(state.kind, 'presentation-design-state');
  assert.equal(state.canvas.status, 'fixed');
  assert.equal(state.canvas.stage.slideRatio, '16 / 9');
  assert.equal(state.theme.status, 'working');
  assert.equal(state.theme.source, 'theme.css');
  assert.equal(state.narrative.status, 'working');
  assert.equal(state.content.status, 'working');
  assert.deepEqual(state.driftRules, {
    changeIsAllowed: true,
    untrackedLayerBypassIsNotAllowed: true,
  });
});

test('buildDesignState extracts theme tokens, primitives, canvas hooks, slide roots, and slide intent', async (t) => {
  const [{ createPresentationScaffold }, { buildDesignState }] = await Promise.all([
    import('../services/scaffold-service.mjs'),
    import('../design-state.js'),
  ]);

  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  writeFileSync(
    resolve(projectRoot, 'theme.css'),
    [
      '@layer theme {',
      '  :root {',
      '    --color-accent: #a52020;',
      '    --canvas-slide-bg: var(--color-accent);',
      '  }',
      '  .hero-title { color: var(--color-accent); }',
      '  .image-treatment { background-image: url("./assets/hero.png"); }',
      '}',
      '',
    ].join('\n')
  );
  writeFileSync(
    resolve(projectRoot, '.presentation', 'intent.json'),
    `${JSON.stringify({
      schemaVersion: 1,
      presentationTitle: 'Ledger Test',
      slideIntent: {
        intro: {
          purpose: 'Open with the core claim.',
          visualIntent: 'Use one strong hero image.',
        },
      },
    }, null, 2)}\n`
  );

  const state = buildDesignState(projectRoot);

  assert.ok(state.theme.observedTokens.includes('--color-accent'));
  assert.ok(state.theme.observedPrimitives.includes('.hero-title'));
  assert.ok(state.theme.canvasVariablesUsed.includes('--canvas-slide-bg'));
  assert.deepEqual(state.theme.assetReferences, ['./assets/hero.png']);
  assert.deepEqual(state.content.slideRoots, [{ slideId: 'intro', rootClass: 'slide slide-hero' }]);
  assert.deepEqual(state.narrative.slidePurposes, [{
    slideId: 'intro',
    purpose: 'Open with the core claim.',
    visualIntent: 'Use one strong hero image.',
  }]);
});
