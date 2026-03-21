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
  assert.match(preview.html, /Presentation in progress/i);
  assert.match(preview.html, /Ask the assistant to turn your idea into the first presentation brief/i);
});

test('renderPresentationFailureHtml returns policy-error HTML for authoring violations', async (t) => {
  const projectRoot = createTempProjectRoot();
  t.after(() => rmSync(projectRoot, { recursive: true, force: true }));

  await createPresentationScaffold({ projectRoot }, { slideCount: 1, copyFramework: false });
  fillBrief(projectRoot);

  const preview = renderPresentationFailureHtml(
    { projectRoot },
    new Error('Deck policy violation in slides/010-hero/slide.html:\n- Inline styles are not allowed.')
  );

  assert.equal(preview.kind, 'policy_error');
  assert.match(preview.html, /This presentation needs a quick fix/i);
  assert.match(preview.html, /Inline styles are not allowed/i);
});
