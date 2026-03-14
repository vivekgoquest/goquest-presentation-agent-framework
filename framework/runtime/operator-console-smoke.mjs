import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';
import net from 'net';
import { chromium } from 'playwright';
import {
  createPresentationTarget,
  getPresentationOutputPaths,
  getPresentationPaths,
  parsePresentationTargetCliArgs,
} from './deck-paths.js';

function createTempProbeDir() {
  return resolve('/tmp', `presentation-ui-smoke-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
}

function parseArgs(argv) {
  let port = null;
  let artifactDir = '';
  const cleaned = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--port') {
      const rawValue = argv[index + 1] || '';
      if (!rawValue || rawValue.startsWith('--')) {
        throw new Error('Missing value for --port <number>.');
      }
      if (!/^\d+$/.test(rawValue)) {
        throw new Error('--port <number> must be a whole number.');
      }
      port = Number.parseInt(rawValue, 10);
      index += 1;
      continue;
    }

    if (arg === '--artifact-dir') {
      const rawValue = argv[index + 1] || '';
      if (!rawValue || rawValue.startsWith('--')) {
        throw new Error('Missing value for --artifact-dir <path>.');
      }
      artifactDir = rawValue;
      index += 1;
      continue;
    }

    cleaned.push(arg);
  }

  const parsed = parsePresentationTargetCliArgs(cleaned);
  return {
    target: parsed.target,
    port,
    artifactDir,
  };
}

function getFreePort() {
  return new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolvePromise(address.port);
      });
    });
    server.once('error', reject);
  });
}

function waitForServerReady(child, expectedPort) {
  return new Promise((resolvePromise, reject) => {
    let stdout = '';
    let stderr = '';

    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for the operator console on port ${expectedPort}.\n${stdout}\n${stderr}`));
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.off('exit', onExit);
    }

    function onStdout(chunk) {
      const text = String(chunk);
      stdout += text;
      if (stdout.includes(`http://127.0.0.1:${expectedPort}/`)) {
        cleanup();
        resolvePromise({ stdout, stderr });
      }
    }

    function onStderr(chunk) {
      stderr += String(chunk);
    }

    function onExit(code) {
      cleanup();
      reject(new Error(`Operator console exited early with code ${code}.\n${stdout}\n${stderr}`));
    }

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.on('exit', onExit);
  });
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function stopServerChild(child) {
  return new Promise((resolvePromise) => {
    if (child.killed || child.exitCode !== null) {
      resolvePromise();
      return;
    }

    const sigtermTimer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
      }
    }, 2500);

    const sigkillTimer = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill('SIGKILL');
      }
    }, 5000);

    child.once('exit', () => {
      clearTimeout(sigtermTimer);
      clearTimeout(sigkillTimer);
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolvePromise();
    });

    child.kill('SIGINT');
  });
}

async function waitForStatusText(locator, text, attempts = 40, delayMs = 250) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = ((await locator.textContent()) || '').trim();
    if (current.includes(text)) {
      return current;
    }
    await sleep(delayMs);
  }

  return ((await locator.textContent()) || '').trim();
}

async function runTerminalProbe(page, expectedCwd, artifactDir) {
  const cwdProbePath = resolve(artifactDir, 'terminal-cwd.txt');
  const tokenProbePath = resolve(artifactDir, 'terminal-token.txt');

  rmSync(cwdProbePath, { force: true });
  rmSync(tokenProbePath, { force: true });

  const helper = page.locator('#terminal-pane .xterm-helper-textarea');
  await helper.waitFor({ timeout: 10000 });
  await helper.click();
  await page.keyboard.type(`pwd > '${cwdProbePath}'; printf 'console-ui-smoke\\n' > '${tokenProbePath}'`, { delay: 3 });
  await page.keyboard.press('Enter');

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const cwdValue = existsSync(cwdProbePath)
      ? readFileSync(cwdProbePath, 'utf8').trim()
      : '';
    const tokenValue = existsSync(tokenProbePath)
      ? readFileSync(tokenProbePath, 'utf8').trim()
      : '';

    if (cwdValue || tokenValue) {
      return {
        typedCommandOk: tokenValue === 'console-ui-smoke',
        cwdEchoOk: cwdValue === expectedCwd,
        terminalText: [cwdValue, tokenValue].filter(Boolean).join('\n'),
      };
    }

    await sleep(200);
  }

  throw new Error('Timed out waiting for terminal probe output.');
}

async function waitForExportStatus(frameLocator) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const text = ((await frameLocator.locator('#export-status').textContent()) || '').trim();
    if (text) {
      return text;
    }
    await sleep(250);
  }

  return ((await frameLocator.locator('#export-status').textContent()) || '').trim();
}

async function waitForProjectExportStatus(page) {
  return waitForStatusText(page.locator('#preview-status'), 'Saved to', 180, 500);
}

async function waitForFinalizeStatus(page) {
  return waitForStatusText(page.locator('#preview-status'), 'Finalize complete', 120, 500);
}

function findFirstSlideNode(node) {
  if (!node) {
    return null;
  }

  if (node.slideId && typeof node.relativePath === 'string' && node.relativePath.endsWith('/slide.html')) {
    return node;
  }

  for (const child of node.children || []) {
    const match = findFirstSlideNode(child);
    if (match) {
      return match;
    }
  }

  return null;
}

function buildServerArgs(port, target) {
  const args = ['framework/runtime/server.mjs', String(port)];
  if (target.kind === 'project') {
    args.push('--project', target.projectRootAbs);
  } else if (target.ownerType === 'deck') {
    args.push('--deck', target.ownerName);
  } else {
    args.push('--example', target.ownerName);
  }
  return args;
}

export async function runOperatorConsoleSmoke(targetInput, options = {}) {
  const target = createPresentationTarget(targetInput);
  if (target.kind !== 'project') {
    throw new Error('Operator console smoke currently supports only --project /abs/path targets.');
  }
  const paths = getPresentationPaths(target);
  const expectedSourceDir = realpathSync(paths.sourceDirAbs);
  const port = options.port || await getFreePort();
  const artifactDir = options.artifactDir
    || (() => {
      try {
        const outputPaths = getPresentationOutputPaths(target);
        return resolve(outputPaths.outputDirAbs, `ui-smoke-${Date.now()}`);
      } catch {
        return resolve('/tmp', `presentation-ui-smoke-${Date.now()}`);
      }
    })();
  const tempProbeDir = createTempProbeDir();

  mkdirSync(tempProbeDir, { recursive: true });

  const child = spawn(process.execPath, buildServerArgs(port, target), {
    cwd: resolve(import.meta.dirname, '../..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  let readyOutput;
  try {
    readyOutput = await waitForServerReady(child, port);

    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
      const baseUrl = `http://127.0.0.1:${port}`;

      await page.goto(`${baseUrl}/`, { waitUntil: 'load' });
      await page.locator('#project-title').waitFor();
      await page.locator('#preview-frame').waitFor();
      await page.locator('#agent-launcher').waitFor();

      const previewPath = '/preview/';
      const workspaceSelectorVisible = await page.locator('#workspace-select').count();

      const treePayload = await page.evaluate(async () => {
        const response = await fetch('/api/project/files');
        return response.json();
      });
      const firstSlideNode = findFirstSlideNode(treePayload.tree);
      let selectedSlidePath = '';
      let selectedSlideId = '';
      let previewSelectionStatus = '';

      if (firstSlideNode) {
        selectedSlidePath = firstSlideNode.relativePath;
        selectedSlideId = firstSlideNode.slideId || '';
        await page.locator(`.tree-row[data-path="${selectedSlidePath}"]`).click();
        previewSelectionStatus = await waitForStatusText(page.locator('#preview-status'), `#${selectedSlideId}`);
      }

      await page.locator('[data-launch-mode="shell"]').click();
      await page.waitForFunction(() => document.querySelector('#terminal-mode')?.textContent?.includes('Shell'));
      const terminalStatus = ((await page.locator('#terminal-state-chip').textContent()) || '').trim();
      const terminalProbe = await runTerminalProbe(page, expectedSourceDir, tempProbeDir);

      const frame = page.frameLocator('#preview-frame');
      await frame.locator('body').waitFor();
      const previewKind = await frame.locator('html').getAttribute('data-target-kind') || '';
      const policyPageDetected = await frame.locator('text=Deck Policy Violation').count() > 0;

      await page.locator('#finalize-project').click();
      const finalizeStatus = await waitForFinalizeStatus(page);

      mkdirSync(artifactDir, { recursive: true });
      writeFileSync(resolve(artifactDir, 'server-start.log'), `${readyOutput.stdout}${readyOutput.stderr}`);

      await page.locator('#export-pdf').click();
      const exportStatus = await waitForProjectExportStatus(page);

      await page.screenshot({ path: resolve(artifactDir, 'operator-console.png'), fullPage: true });

      const savedPdfPath = (() => {
        try {
          return getPresentationOutputPaths(target).pdfAbs;
        } catch {
          return '';
        }
      })();
      const artifactPdfPath = resolve(artifactDir, `${paths.slug || 'project'}.pdf`);
      if (savedPdfPath && existsSync(savedPdfPath)) {
        copyFileSync(savedPdfPath, artifactPdfPath);
      }

      const report = {
        status: terminalStatus.includes('Terminal')
          && terminalProbe.typedCommandOk
          && terminalProbe.cwdEchoOk
          && workspaceSelectorVisible === 0
          && !policyPageDetected
          && exportStatus.includes('Saved to')
          && finalizeStatus.includes('Finalize complete')
          && savedPdfPath
          && existsSync(savedPdfPath)
          && existsSync(artifactPdfPath)
          ? 'pass'
          : 'needs-review',
        target,
        sourceDir: expectedSourceDir,
        baseUrl,
        previewPath,
        artifactDir,
        workspaceSelectorVisible,
        selectedSlidePath,
        selectedSlideId,
        previewSelectionStatus,
        terminalStatus,
        terminalProbe,
        previewKind,
        policyPageDetected,
        exportStatus,
        finalizeStatus,
        artifactPdfPath,
        savedPdfPath,
      };

      writeFileSync(resolve(artifactDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
      return report;
    } finally {
      await browser.close();
    }
  } finally {
    rmSync(tempProbeDir, { recursive: true, force: true });
    await stopServerChild(child);
  }
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Usage: node framework/runtime/operator-console-smoke.mjs --project /abs/path [--artifact-dir /tmp/dir] [--port <number>]\n\n${err.message}`);
    process.exit(1);
  }

  try {
    const report = await runOperatorConsoleSmoke(parsed.target, {
      port: parsed.port,
      artifactDir: parsed.artifactDir,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.status !== 'pass') {
      process.exit(1);
    }
  } catch (err) {
    console.error('Operator console smoke failed:', err.message);
    process.exit(1);
  }
}
