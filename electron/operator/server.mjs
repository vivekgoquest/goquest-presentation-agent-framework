import { createServer } from 'node:http';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';

import { ElectronOperatorController } from './controller.mjs';
import { ensureOperatorDir, getOperatorSessionId, getOperatorStateFile } from './paths.mjs';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

export async function startOperatorServer(options = {}) {
  ensureOperatorDir();
  const sessionId = options.sessionId || getOperatorSessionId();
  const stateFile = getOperatorStateFile(sessionId);
  const controller = new ElectronOperatorController(options);
  const server = createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        sendJson(res, 200, { ok: true, pid: process.pid });
        return;
      }

      if (req.method !== 'POST' || req.url !== '/command') {
        sendJson(res, 404, { ok: false, error: 'Not found' });
        return;
      }

      const body = await readJsonBody(req);
      const command = String(body?.command || '').trim();
      const args = Array.isArray(body?.args) ? body.args : [];
      const result = await dispatchCommand(controller, command, args, async () => {
        sendJson(res, 200, { ok: true, result: { shutdown: true } });
        setTimeout(async () => {
          try {
            await controller.close();
          } finally {
            rmSync(stateFile, { force: true });
            server.close(() => process.exit(0));
          }
        }, 25);
      });

      if (command === 'shutdown') {
        return;
      }

      sendJson(res, 200, { ok: true, result });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error?.message || String(error || 'Unknown operator error'),
      });
    }
  });

  const port = options.port || randomInt(4100, 4899);
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  writeFileSync(stateFile, JSON.stringify({ pid: process.pid, port, sessionId }, null, 2));
  return { server, port, sessionId };
}

async function dispatchCommand(controller, command, args, shutdown) {
  switch (command) {
    case 'launch':
      await controller.ensureLaunched();
      return controller.getState();
    case 'close':
      return controller.close();
    case 'restart':
      return controller.restart();
    case 'shutdown':
      await shutdown();
      return { shutdown: true };
    case 'state':
      return controller.getState();
    case 'create-project':
      return controller.createProject(args[0], Number(args[1] || 3));
    case 'open-project':
      return controller.openProject(args[0]);
    case 'click':
      return controller.click(args[0]);
    case 'double-click':
      return controller.doubleClick(args[0]);
    case 'right-click':
      return controller.rightClick(args[0]);
    case 'hover':
      return controller.hover(args[0]);
    case 'type':
      return controller.type(args[0], args[1] || '');
    case 'press':
      return controller.press(args[0]);
    case 'key-down':
      return controller.keyDown(args[0]);
    case 'key-up':
      return controller.keyUp(args[0]);
    case 'wait-for-text':
      return controller.waitForText(args[0], Number(args[1] || 30000));
    case 'wait-for-selector':
      return controller.waitForSelector(args[0], Number(args[1] || 30000));
    case 'is-visible':
      return controller.isVisible(args[0]);
    case 'is-enabled':
      return controller.isEnabled(args[0]);
    case 'bounds':
      return controller.bounds(args[0]);
    case 'focused-element':
      return controller.focusedElement();
    case 'value':
      return controller.value(args[0]);
    case 'wait-for-value':
      return controller.waitForValue(args[0], args[1] || '', Number(args[2] || 30000));
    case 'visible-text':
      return controller.visibleText(args[0] || 'body');
    case 'screenshot':
      return controller.screenshot(args[0]);
    case 'screenshot-element':
      return controller.screenshotElement(args[0], args[1]);
    case 'screenshot-region':
      return controller.screenshotRegion(args[0], args[1], args[2], args[3], args[4]);
    case 'mouse-move':
      return controller.mouseMove(args[0]);
    case 'mouse-move-coords':
      return controller.mouseMoveCoords(args[0], args[1]);
    case 'mouse-down':
      return controller.mouseDown(args[0]);
    case 'mouse-up':
      return controller.mouseUp(args[0]);
    case 'drag':
      return controller.drag(args[0], args[1]);
    case 'drag-coords':
      return controller.dragCoords(args[0], args[1], args[2], args[3]);
    case 'scroll':
      return controller.scroll(args[0], args[1], args[2]);
    case 'scroll-page':
      return controller.scrollPage(args[0], args[1]);
    case 'terminal-focus':
      return controller.terminalFocus();
    case 'terminal-type':
      return controller.terminalType(args[0] || '');
    case 'terminal-send':
      return controller.terminalSend(args[0] || '');
    case 'terminal-press':
      return controller.terminalPress(args[0]);
    case 'terminal-meta':
      return controller.terminalMeta();
    case 'terminal-text':
      return controller.terminalText();
    case 'wait-for-terminal-text':
      return controller.waitForTerminalText(args[0], Number(args[1] || 30000));
    case 'preview-meta':
      return controller.previewMeta();
    case 'preview-click':
      return controller.previewClick(args[0] || 'body');
    case 'preview-type':
      return controller.previewType(args[0], args[1] || '');
    case 'preview-visible-text':
      return controller.previewVisibleText(args[0] || 'body');
    case 'preview-wait-for-selector':
      return controller.previewWaitForSelector(args[0] || 'body', Number(args[1] || 30000));
    case 'project-meta':
      return controller.projectMeta();
    case 'actions-list':
      return controller.actionList();
    case 'action-invoke':
      return controller.actionInvoke(args[0], args[1] ? JSON.parse(String(args[1])) : {});
    case 'windows-list':
      return controller.windowsList();
    case 'create-window':
      return controller.createWindow();
    case 'focus-window':
      return controller.focusWindow(args[0]);
    case 'resize-window':
      return controller.resizeWindow(args[0], args[1], args[2]);
    case 'close-window':
      return controller.closeWindow(args[0]);
    case 'wait-for-window-count':
      return controller.waitForWindowCount(args[0], Number(args[1] || 30000));
    case 'menu-list':
      return controller.menuList();
    case 'menu-click':
      return controller.menuClick(args[0]);
    case 'dialog-state':
      return controller.dialogState();
    case 'dialog-clear':
      return controller.clearDialogOverrides();
    case 'dialog-set-open-directory':
      return controller.queueOpenDirectoryDialog(args[0] || '');
    case 'dialog-set-save-path':
      return controller.queueSaveDialog(args[0] || '');
    case 'os-available':
      return controller.osAvailable();
    case 'os-file-dialog-available':
      return controller.osFileDialogAvailable();
    case 'os-file-dialog-state':
      return controller.osFileDialogState(args[0]);
    case 'os-file-dialog-wait-open':
      return controller.osFileDialogWaitOpen(args[0], Number(args[1] || 30000));
    case 'os-file-dialog-wait-closed':
      return controller.osFileDialogWaitClosed(args[0], Number(args[1] || 30000));
    case 'os-file-dialog-choose-folder':
      return controller.osFileDialogChooseFolder(args[0], args[1]);
    case 'os-file-dialog-cancel':
      return controller.osFileDialogCancel(args[0]);
    case 'os-activate-app':
      return controller.osActivateApplication(args[0]);
    case 'os-menu-click':
      return controller.osMenuClick(args[0], args[1]);
    case 'os-move':
      return controller.osMouseMove(args[0], args[1]);
    case 'os-click':
      return controller.osMouseClick(args[0], args[1], args[2]);
    case 'os-double-click':
      return controller.osMouseDoubleClick(args[0], args[1], args[2]);
    case 'os-type':
      return controller.osType(args[0] || '');
    case 'os-press':
      return controller.osPress(args[0] || '');
    case 'os-screenshot':
      return controller.osScreenshot(args[0]);
    default:
      throw new Error(`Unknown operator command: ${command}`);
  }
}

if (process.argv.includes('--serve')) {
  startOperatorServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
