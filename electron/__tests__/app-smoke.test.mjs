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
    const handle = await page.$('#preview-frame');
    const frame = handle ? await handle.contentFrame() : null;
    if (frame) {
      return frame;
    }

    await page.waitForTimeout(250);
  }

  throw new Error('Timed out waiting for the Electron preview frame.');
}

async function waitForStageFrame(previewFrame) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      await previewFrame.waitForSelector('#electron-preview-stage', { timeout: 250 });
      const child = previewFrame.childFrames()[0];
      if (child) {
        await child.waitForSelector('section[data-slide]', { timeout: 250 });
        return child;
      }
    } catch {
      // retry until the preview host settles
    }
  }

  throw new Error('Timed out waiting for the Electron preview stage frame.');
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
    ['actions', 'preview', 'project', 'system', 'terminal']
  );

  const electronMethodShape = await page.evaluate(() => ({
    projectCreate: typeof window.electron.project.create,
    projectChanged: typeof window.electron.project.onChanged,
    previewMeta: typeof window.electron.preview.getMeta,
    previewChanged: typeof window.electron.preview.onChanged,
    actionList: typeof window.electron.actions.list,
    actionInvoke: typeof window.electron.actions.invoke,
    actionEvents: typeof window.electron.actions.onEvent,
    terminalStart: typeof window.electron.terminal.start,
    revealInFinder: typeof window.electron.system.revealInFinder,
  }));
  assert.deepEqual(electronMethodShape, {
    projectCreate: 'function',
    projectChanged: 'function',
    previewMeta: 'function',
    previewChanged: 'function',
    actionList: 'function',
    actionInvoke: 'function',
    actionEvents: 'function',
    terminalStart: 'function',
    revealInFinder: 'function',
  });

  // Verify the app shell loaded and shows the welcome state
  const welcomeText = await page.locator('#welcome-panel h2').textContent();
  assert.match(welcomeText || '', /Presentation Desktop/i);

  const welcomeActionCount = await page.locator('#welcome-panel .welcome-actions button').count();
  assert.equal(welcomeActionCount, 0);

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

  await page.waitForFunction((expectedProjectRoot) => {
    try {
      const meta = JSON.parse(document.querySelector('#terminal-meta')?.textContent || '{}');
      return meta.alive === true && meta.projectRoot === expectedProjectRoot && meta.cwd === expectedProjectRoot;
    } catch {
      return false;
    }
  }, projectRoot);

  // Verify terminal meta is available in diagnostics and auto-starts in the selected folder
  const terminalStatus = await page.locator('#terminal-meta').textContent();
  assert.match(terminalStatus || '', /"state"/);
  assert.match(terminalStatus || '', /"alive": true/);

  await page.waitForSelector('#terminal-pane');
  await page.waitForSelector('#preview-pane');

  const terminalTitle = await page.locator('.terminal-title').textContent();
  const previewTitle = await page.locator('.preview-title').textContent();
  assert.match(terminalTitle || '', /terminal/i);
  assert.match(previewTitle || '', /preview/i);

  const terminalStateLabel = await page.locator('#terminal-state-label').textContent();
  assert.match(terminalStateLabel || '', /shell open/i);
  assert.match(terminalStateLabel || '', /pf-electron-app/i);

  const projectContext = await page.locator('#project-context-label').textContent();
  assert.match(projectContext || '', /pf-electron-app/i);
  assert.match(projectContext || '', /Onboarding|In Progress|Ready|Finalized/i);

  const previewSubtitle = await page.locator('#preview-subtitle').textContent();
  assert.match(previewSubtitle || '', /draft preview/i);
  assert.doesNotMatch(previewSubtitle || '', /slides/i);

  const previewHeaderStyles = await page.evaluate(() => {
    const header = document.querySelector('.preview-header');
    const title = document.querySelector('.preview-header .pane-title');
    const subtitle = document.querySelector('.preview-header .pane-subtitle');
    const headerStyle = header ? getComputedStyle(header) : null;
    const titleStyle = title ? getComputedStyle(title) : null;
    const subtitleStyle = subtitle ? getComputedStyle(subtitle) : null;
    return {
      paddingTop: headerStyle ? parseFloat(headerStyle.paddingTop) : 0,
      paddingLeft: headerStyle ? parseFloat(headerStyle.paddingLeft) : 0,
      titleSize: titleStyle ? parseFloat(titleStyle.fontSize) : 0,
      subtitleSize: subtitleStyle ? parseFloat(subtitleStyle.fontSize) : 0,
    };
  });
  assert.equal(previewHeaderStyles.paddingTop, 8);
  assert.equal(previewHeaderStyles.paddingLeft, 10);
  assert.equal(previewHeaderStyles.titleSize, 11);
  assert.equal(previewHeaderStyles.subtitleSize, 10);

  const splitHandleCount = await page.locator('#pane-split-handle').count();
  assert.equal(splitHandleCount, 1);

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
  assert.match(visibleActions.primaryText, /check project/i);
  assert.equal(visibleActions.secondaryHidden, true);

  const actions = await page.evaluate(async () => {
    return window.electron.actions.list();
  });
  assert(actions.actions.some((action) => action.id === 'review_narrative_presentation' && action.enabled));
  assert(actions.actions.some((action) => action.id === 'review_visual_presentation' && action.enabled));

  const toolsButtonText = await page.locator('#more-actions').textContent();
  assert.match(toolsButtonText || '', /more/i);
  await page.locator('#more-actions').click();
  const menuSummary = await page.locator('#more-menu-summary').textContent();
  assert.match(menuSummary || '', /checks|reviews|capture|fixes/i);

  const filmstripCount = await page.locator('#filmstrip').count();
  assert.equal(filmstripCount, 0);

  const diagnosticsButtonCount = await page.locator('#toggle-diagnostics').count();
  assert.equal(diagnosticsButtonCount, 0);

  const welcomeCopy = await page.locator('#welcome-panel p').textContent();
  assert.match(welcomeCopy || '', /toolbar|terminal|preview/i);
  assert.doesNotMatch(welcomeCopy || '', /browser|deck policy/i);

  const terminalActionLabels = await page.evaluate(() => ({
    clear: document.getElementById('clear-terminal')?.style.display || '',
    close: document.getElementById('stop-terminal')?.textContent || '',
  }));
  assert.equal(terminalActionLabels.clear, 'none');
  assert.match(terminalActionLabels.close, /close shell/i);
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

  await page.waitForFunction(() => {
    const header = document.querySelector('.preview-header');
    return header && getComputedStyle(header).display === 'none';
  });

  const previewTransport = await page.evaluate(async () => {
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const frame = document.getElementById('preview-frame');
      if (frame?.srcdoc) {
        return {
          src: frame.getAttribute('src') || '',
          srcdocLength: frame.srcdoc.length,
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      src: document.getElementById('preview-frame')?.getAttribute('src') || '',
      srcdocLength: document.getElementById('preview-frame')?.srcdoc?.length || 0,
    };
  });
  assert.equal(previewTransport.src, '');
  assert.ok(previewTransport.srcdocLength > 0);

  const previewFrame = await waitForPreviewFrame(page);
  const stageFrame = await waitForStageFrame(previewFrame);
  assert.ok(stageFrame, 'expected inner preview stage frame');

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
      stageBorderRadius: stageStyle?.borderRadius || '',
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
  assert.equal(hostDetails.paddingLeft, 4);
  assert.equal(hostDetails.paddingRight, 4);
  assert.equal(hostDetails.paddingTop, 4);
  assert.equal(hostDetails.paddingBottom, 4);
  assert.match(hostDetails.stageBorderRadius, /10px/i);
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
  assert.ok(
    stageDetails.innerHeight >= 719 && stageDetails.innerHeight <= 720,
    `expected inner preview height to stay near 720, saw ${stageDetails.innerHeight}`
  );
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
  await page.waitForFunction(() => document.getElementById('primary-action')?.textContent?.match(/export/i));

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
