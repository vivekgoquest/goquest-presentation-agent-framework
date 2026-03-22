import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';

test('preview document shell passes through non-slides content unchanged', async () => {
  const { renderElectronPreviewHtml } = await import('../preview-document-shell.mjs');
  const raw = '<html><body>raw</body></html>';
  assert.equal(renderElectronPreviewHtml(raw, 'document'), raw, 'non-slides kind should pass through');
  assert.equal(renderElectronPreviewHtml('', 'slides'), '', 'empty string should pass through');
});

function fillBrief(projectRoot, title = 'Electron Preview Brief') {
  writeFileSync(
    resolve(projectRoot, 'brief.md'),
    [
      `# ${title}`,
      '',
      '## Goal',
      '',
      'Verify the Electron preview shell against a ready presentation project.',
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
      '- Standard slide framing inside the Electron preview.',
      '- Preview stays a rendering layer for the assembled HTML.',
      '',
      '## Constraints',
      '',
      '- Keep the project-folder contract intact.',
      '',
      '## Open Questions',
      '',
      '- none',
      '',
    ].join('\n')
  );
}

async function waitForCondition(predicate, attempts = 40, delayMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

async function waitForPreviewFrame(page) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const frame = page.frames().find((candidate) => candidate.url().startsWith('presentation://preview/current'));
    if (frame) {
      return frame;
    }

    await page.waitForTimeout(250);
  }

  throw new Error('Timed out waiting for the Electron preview frame.');
}

test('electron shell boots and can create a project through the preload bridge', async (t) => {
  const { _electron: electron } = await import('playwright');
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-electron-app-'));

  t.after(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  const app = await electron.launch({
    args: [resolve(process.cwd(), 'electron/main.mjs')],
    cwd: process.cwd(),
  });

  t.after(async () => {
    await app.close();
  });

  const page = await app.firstWindow();
  await page.waitForSelector('#app-shell');

  const electronSurfaceKeys = await page.evaluate(() => Object.keys(window.electron || {}).sort());
  assert.deepEqual(
    electronSurfaceKeys,
    ['actions', 'build', 'events', 'export', 'preview', 'project', 'review', 'system', 'terminal', 'watch']
  );

  const electronMethodShape = await page.evaluate(() => ({
    projectCreate: typeof window.electron.project.create,
    projectChanged: typeof window.electron.project.onChanged,
    previewMeta: typeof window.electron.preview.getMeta,
    previewChanged: typeof window.electron.preview.onChanged,
    buildFinalize: typeof window.electron.build.finalize,
    exportStart: typeof window.electron.export.start,
    reviewRun: typeof window.electron.review.run,
    terminalStart: typeof window.electron.terminal.start,
    revealInFinder: typeof window.electron.system.revealInFinder,
  }));
  assert.deepEqual(electronMethodShape, {
    projectCreate: 'function',
    projectChanged: 'function',
    previewMeta: 'function',
    previewChanged: 'function',
    buildFinalize: 'function',
    exportStart: 'function',
    reviewRun: 'function',
    terminalStart: 'function',
    revealInFinder: 'function',
  });

  // Verify the app shell loaded and shows the welcome state
  const welcomeText = await page.locator('#welcome-panel h2').textContent();
  assert.match(welcomeText || '', /Presentation Desktop/i);

  // Set path via hidden input and trigger create through JS
  // (the real UI uses a folder picker, but tests set it programmatically)
  await page.evaluate((path) => {
    document.getElementById('project-path').value = path;
  }, projectRoot);
  await page.evaluate(() => {
    // Directly call the IPC to create, bypassing the folder picker
    return window.electron.project.create({
      projectRoot: document.getElementById('project-path').value,
      slideCount: 3,
    });
  });

  // Wait for project to become active
  await page.waitForFunction(() => {
    const metaEl = document.querySelector('#meta-json');
    return metaEl?.textContent?.includes('"active": true');
  });

  // Verify terminal meta is available in diagnostics
  const terminalStatus = await page.locator('#terminal-meta').textContent();
  assert.match(terminalStatus || '', /"state"/);

  await page.waitForSelector('#terminal-pane');
  await page.waitForSelector('#preview-pane');

  const terminalTitle = await page.locator('.terminal-title').textContent();
  const previewTitle = await page.locator('.preview-title').textContent();
  assert.match(terminalTitle || '', /assistant/i);
  assert.match(previewTitle || '', /presentation/i);

  const visibleActions = await page.evaluate(() => {
    const primary = document.getElementById('primary-action');
    const secondary = document.getElementById('secondary-action');
    return {
      primaryText: primary?.textContent || '',
      primaryHidden: primary?.style.display === 'none',
      secondaryText: secondary?.textContent || '',
      secondaryHidden: secondary?.style.display === 'none',
    };
  });
  assert.equal(visibleActions.primaryHidden, false);
  assert.match(visibleActions.primaryText, /export presentation/i);
  assert.equal(visibleActions.secondaryHidden, false);
  assert.match(visibleActions.secondaryText, /validate presentation/i);

  const reviewAvailability = await page.evaluate(async () => {
    return window.electron.review.getAvailability();
  });
  assert.equal(reviewAvailability.reviewNarrative, true);
  assert.equal(reviewAvailability.reviewVisual, true);

  const filmstripCount = await page.locator('#filmstrip').count();
  assert.equal(filmstripCount, 0);

  const diagnosticsButtonCount = await page.locator('#toggle-diagnostics').count();
  assert.equal(diagnosticsButtonCount, 0);

  const welcomeCopy = await page.locator('#welcome-panel p').textContent();
  assert.match(welcomeCopy || '', /assistant/i);
  assert.doesNotMatch(welcomeCopy || '', /browser|deck policy/i);
});

test('electron preview applies a generic viewport shell for ready slide decks', async (t) => {
  const [{ _electron: electron }, { createProjectScaffold }] = await Promise.all([
    import('playwright'),
    import('../../framework/application/project-scaffold-service.mjs'),
  ]);
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-electron-ready-preview-'));

  t.after(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot, 'Electron Ready Preview Brief');

  const app = await electron.launch({
    args: [resolve(process.cwd(), 'electron/main.mjs')],
    cwd: process.cwd(),
  });

  t.after(async () => {
    await app.close();
  });

  const page = await app.firstWindow();
  await page.waitForSelector('#app-shell');

  await page.evaluate((path) => window.electron.project.open({ projectRoot: path }), projectRoot);
  const previewMeta = await page.evaluate(() => window.electron.preview.getMeta());
  assert.equal(previewMeta.kind, 'slides');
  const previewFrame = await waitForPreviewFrame(page);
  await previewFrame.waitForSelector('#electron-preview-stage');

  const stageFrame = previewFrame.childFrames()[0];
  assert.ok(stageFrame, 'expected inner preview stage frame');
  await stageFrame.waitForSelector('section[data-slide]');

  const hostDetails = await previewFrame.evaluate(() => {
    const shell = document.getElementById('electron-preview-shell');
    const stage = document.getElementById('electron-preview-stage');
    const shellStyle = shell ? getComputedStyle(shell) : null;
    const stageStyle = stage ? getComputedStyle(stage) : null;
    const paddingLeft = shellStyle ? parseFloat(shellStyle.paddingLeft) : 0;
    const paddingRight = shellStyle ? parseFloat(shellStyle.paddingRight) : 0;
    const paddingTop = shellStyle ? parseFloat(shellStyle.paddingTop) : 0;
    const paddingBottom = shellStyle ? parseFloat(shellStyle.paddingBottom) : 0;
    const zoom = stageStyle ? Number(stageStyle.zoom || '1') : 1;
    const stageClientWidth = stage?.clientWidth || 0;
    const stageClientHeight = stage?.clientHeight || 0;
    const zoomedWidth = stageClientWidth * zoom;
    const zoomedHeight = stageClientHeight * zoom;

    return {
      host: document.documentElement.dataset.electronPreviewHost || '',
      shellClientWidth: shell?.clientWidth || 0,
      shellClientHeight: shell?.clientHeight || 0,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      stageWidth: stageClientWidth,
      stageHeight: stageClientHeight,
      stageZoom: stageStyle?.zoom || '',
      zoomedWidth,
      zoomedHeight,
      overflowX: zoomedWidth + paddingLeft + paddingRight - (shell?.clientWidth || 0),
      overflowY: zoomedHeight + paddingTop + paddingBottom - (shell?.clientHeight || 0),
    };
  });

  const stageDetails = await stageFrame.evaluate(() => {
    const firstSection = document.querySelector('section[data-slide]');
    const slide = document.querySelector('.slide, .slide-wide, .slide-hero');
    const bodyStyle = getComputedStyle(document.body);

    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      slideCount: document.querySelectorAll('section[data-slide]').length,
      hasExportBar: Boolean(document.querySelector('.runtime-export-bar')),
      bodyGap: bodyStyle.gap,
      slideAspectRatio: slide ? getComputedStyle(slide).aspectRatio : '',
      firstSectionWidth: firstSection?.clientWidth || 0,
    };
  });

  assert.equal(hostDetails.host, 'slides');
  assert.equal(hostDetails.stageWidth, 1280);
  assert.equal(hostDetails.stageHeight, 720);
  assert.notEqual(hostDetails.stageZoom, '1');
  assert.ok(
    hostDetails.overflowX <= 1,
    `expected stage to fit horizontally within shell, saw overflow ${hostDetails.overflowX}`
  );
  assert.ok(
    hostDetails.overflowY <= 1,
    `expected stage to fit vertically within shell, saw overflow ${hostDetails.overflowY}`
  );

  assert.equal(stageDetails.innerWidth, 1280);
  assert.equal(stageDetails.innerHeight, 720);
  assert.equal(stageDetails.slideCount, 2);
  assert.equal(stageDetails.hasExportBar, false);
  assert.match(stageDetails.bodyGap, /px/);
  assert.equal(stageDetails.slideAspectRatio, '16 / 9');
  assert.ok(stageDetails.firstSectionWidth >= 1200);
});

test('electron export action runs directly from the toolbar without opening the legacy export modal', async (t) => {
  const [{ _electron: electron }, { createProjectScaffold }] = await Promise.all([
    import('playwright'),
    import('../../framework/application/project-scaffold-service.mjs'),
  ]);
  const projectRoot = mkdtempSync(resolve(tmpdir(), 'pf-electron-export-modal-'));

  t.after(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  await createProjectScaffold({ projectRoot }, { slideCount: 2, copyFramework: false });
  fillBrief(projectRoot, 'Electron Export Modal Brief');

  const app = await electron.launch({
    args: [resolve(process.cwd(), 'electron/main.mjs')],
    cwd: process.cwd(),
  });

  t.after(async () => {
    await app.close();
  });

  const page = await app.firstWindow();
  await page.waitForSelector('#app-shell');
  await page.evaluate((path) => window.electron.project.open({ projectRoot: path }), projectRoot);
  await page.waitForFunction(() => document.getElementById('primary-action')?.textContent?.match(/export presentation/i));

  await page.locator('#primary-action').click();
  await page.waitForFunction(() => /export/i.test(document.getElementById('action-status-label')?.textContent || ''));

  const exportState = await page.evaluate(() => ({
    modalOpen: document.getElementById('export-modal')?.dataset.open === 'true',
    actionStatus: document.getElementById('action-status-label')?.textContent || '',
  }));

  assert.equal(exportState.modalOpen, false);
  assert.match(exportState.actionStatus, /export/i);
  const pdfReady = await waitForCondition(() => existsSync(resolve(projectRoot, 'outputs', 'deck.pdf')));
  assert.equal(pdfReady, true);
});
