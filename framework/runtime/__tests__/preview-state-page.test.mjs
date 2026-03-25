import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { createPresentationScaffold } from '../services/scaffold-service.mjs';
import { renderPresentationFailureHtml } from '../preview-state-page.js';

function createTempProjectRoot() {
  return mkdtempSync(resolve(tmpdir(), 'pf-preview-state-'));
}

function fillBrief(projectRoot) {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      '# Preview State Brief',
      '',
      '## Goal',
      '',
      'Make Electron preview tell the truth about project readiness.',
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
      '- Truthful onboarding and policy-error preview states.',
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

test('renderPresentationFailureHtml returns onboarding HTML for scaffolded projects', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 3, copyFramework: false });

  const preview = renderPresentationFailureHtml(
    { projectRoot },
    new Error('Deck policy violation in brief.md:\n- Fill in brief.md with the normalized user request before continuing.')
  );

  assert.equal(preview.kind, 'onboarding');
  assert.match(preview.html, /Draft preview/i);
  assert.match(preview.html, /Your slides will appear here/i);
  assert.match(preview.html, /Use the terminal to turn your idea into the first brief/i);
  assert.doesNotMatch(preview.html, /Use the terminal on the left/i);
  assert.doesNotMatch(preview.html, /is still taking shape/i);
  assert.doesNotMatch(preview.html, /<ul class="checklist">/i);
  assert.doesNotMatch(preview.html, /Slides left/i);
  assert.doesNotMatch(preview.html, /Next step/i);
  assert.doesNotMatch(preview.html, /Waiting for your first prompt/i);
});

test('renderPresentationFailureHtml returns a minimal blocked-preview HTML for authoring violations', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);

  const preview = renderPresentationFailureHtml(
    { projectRoot },
    new Error('Deck policy violation in slides/010-hero/slide.html:\n- Inline styles are not allowed.')
  );

  assert.equal(preview.kind, 'policy_error');
  assert.match(preview.html, /Preview blocked/i);
  assert.match(preview.html, /Preview unavailable/i);
  assert.match(preview.html, /Fix the issue in the shell/i);
  assert.match(preview.html, /Inline styles are not allowed/i);
  assert.doesNotMatch(preview.html, /<pre>/i);
});
