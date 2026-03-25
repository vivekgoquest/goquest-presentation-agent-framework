import { resolve } from 'node:path';

import { copyTerminalTextViaClipboard } from './terminal-capture.mjs';
import {
  getFileDialogState,
  getOsAutomationStatus,
  isOsAutomationSupported,
  osActivateApp,
  osFileDialogCancel,
  osFileDialogChooseFolder,
  osMenuClick,
  osMouseClick,
  osMouseDoubleClick,
  osMouseMove,
  osPressKey,
  osScreenshot,
  osTypeText,
} from './os-automation.mjs';

function parseJsonText(value = '{}') {
  try {
    return JSON.parse(String(value || '{}'));
  } catch {
    return {};
  }
}

function summarizeState(state = {}) {
  return {
    launched: Boolean(state.launched),
    projectMeta: state.projectMeta || null,
    previewMeta: state.previewMeta || null,
    terminalMeta: state.terminalMeta || null,
    toolbar: state.toolbar || {},
    terminal: state.terminal || {},
    preview: state.preview || {},
    pageErrors: Array.isArray(state.pageErrors) ? state.pageErrors.slice(-10) : [],
    consoleMessages: Array.isArray(state.consoleMessages) ? state.consoleMessages.slice(-10) : [],
  };
}

function isClosedPageError(error) {
  const message = String(error?.message || error || '');
  return message.includes('Target page, context or browser has been closed');
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMouseButton(button = 'left') {
  const normalized = String(button || 'left').trim().toLowerCase();
  return ['left', 'middle', 'right'].includes(normalized) ? normalized : 'left';
}

export class ElectronOperatorController {
  constructor(options = {}) {
    this.repoRoot = options.repoRoot || resolve(import.meta.dirname, '../..');
    this.entry = options.entry || resolve(this.repoRoot, 'electron/main.mjs');
    this.cwd = options.cwd || this.repoRoot;
    this.app = null;
    this.page = null;
    this.pageErrors = [];
    this.consoleMessages = [];
  }

  async ensureLaunched() {
    if (this.app && this.page && !this.page.isClosed()) {
      return this.page;
    }

    this.app = null;
    this.page = null;

    const { _electron: electron } = await import('playwright');
    this.app = await electron.launch({
      args: [this.entry],
      cwd: this.cwd,
    });
    this.page = await this.app.firstWindow();
    this.page.on('pageerror', (error) => {
      this.pageErrors.push({
        message: error?.message || String(error || ''),
        stack: error?.stack || '',
        at: new Date().toISOString(),
      });
    });
    this.page.on('console', (message) => {
      this.consoleMessages.push({
        type: message.type(),
        text: message.text(),
        at: new Date().toISOString(),
      });
      if (this.consoleMessages.length > 100) {
        this.consoleMessages.splice(0, this.consoleMessages.length - 100);
      }
    });
    await this.page.waitForSelector('#app-shell');
    return this.page;
  }

  async withPage(work) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const page = await this.ensureLaunched();
        return await work(page);
      } catch (error) {
        if (attempt === 0 && isClosedPageError(error)) {
          this.app = null;
          this.page = null;
          continue;
        }
        throw error;
      }
    }

    throw new Error('Unable to access Electron page.');
  }

  async getPreviewSurfaceFrame(timeoutMs = 30000) {
    const deadline = Date.now() + Number(timeoutMs || 30000);

    return this.withPage(async (page) => {
      while (Date.now() < deadline) {
        const previewHandle = await page.$('#preview-frame');
        const previewHostFrame = previewHandle ? await previewHandle.contentFrame() : null;
        if (!previewHostFrame) {
          await page.waitForTimeout(100);
          continue;
        }

        const stageHandle = await previewHostFrame.$('#electron-preview-stage');
        if (!stageHandle) {
          return previewHostFrame;
        }

        const stageDeadline = Date.now() + 2000;
        while (Date.now() < stageDeadline) {
          const stageFrame = await stageHandle.contentFrame();
          if (stageFrame) {
            return stageFrame;
          }
          await page.waitForTimeout(50);
        }

        return previewHostFrame;
      }

      throw new Error('Timed out waiting for preview surface frame.');
    });
  }

  resolveOutputPath(outputPath, fallbackName) {
    return outputPath ? resolve(this.cwd, outputPath) : resolve(this.cwd, fallbackName);
  }

  async getState() {
    if (!this.page) {
      return {
        launched: false,
        pageErrors: [...this.pageErrors],
        consoleMessages: [...this.consoleMessages],
      };
    }

    return this.withPage(async (page) => {
      const snapshot = await page.evaluate(async () => {
        const readText = (selector) => document.querySelector(selector)?.textContent || '';
        const getVisible = (selector) => {
          const element = document.querySelector(selector);
          return element ? getComputedStyle(element).display !== 'none' : false;
        };

        return {
          projectMeta: await window.electron.project.getMeta().catch(() => null),
          previewMeta: await window.electron.preview.getMeta().catch(() => null),
          terminalMeta: await window.electron.terminal.getMeta().catch(() => null),
          actionList: await window.electron.actions.list().catch(() => ({ actions: [] })),
          toolbar: {
            projectName: readText('#project-name-label'),
            projectContext: readText('#project-context-label'),
            actionStatus: readText('#action-status-label'),
            primaryAction: readText('#primary-action'),
            moreAction: readText('#more-actions'),
          },
          terminal: {
            title: readText('.terminal-title'),
            subtitle: readText('#terminal-state-label'),
            emptyTitle: readText('#terminal-empty-title'),
            emptyDetail: readText('#terminal-empty-detail'),
            findVisible: getVisible('#terminal-find'),
            searchOpen: document.getElementById('terminal-search')?.dataset.open === 'true',
          },
          preview: {
            title: readText('.preview-title'),
            subtitle: readText('#preview-subtitle'),
            kind: document.getElementById('preview-pane')?.dataset.previewKind || '',
          },
          diagnostics: {
            meta: parseJsonText(document.getElementById('meta-json')?.textContent || '{}'),
            terminal: parseJsonText(document.getElementById('terminal-meta')?.textContent || '{}'),
            errors: document.getElementById('error-log')?.textContent || '',
          },
          activeElement: {
            tag: document.activeElement?.tagName || '',
            id: document.activeElement?.id || '',
            className: document.activeElement?.className || '',
          },
        };

        function parseJsonText(value) {
          try {
            return JSON.parse(String(value || '{}'));
          } catch {
            return {};
          }
        }
      });

      return {
        launched: true,
        ...snapshot,
        pageErrors: [...this.pageErrors],
        consoleMessages: [...this.consoleMessages],
      };
    });
  }

  async createProject(projectRoot, slideCount = 3) {
    return this.withPage(async (page) => {
      const result = await page.evaluate(async ({ projectRoot: nextProjectRoot, slideCount: nextSlideCount }) => {
        document.getElementById('project-path').value = nextProjectRoot;
        return window.electron.project.create({ projectRoot: nextProjectRoot, slideCount: nextSlideCount });
      }, { projectRoot, slideCount: Number(slideCount || 3) });

      await page.waitForFunction((expectedProjectRoot) => {
        try {
          const meta = JSON.parse(document.querySelector('#terminal-meta')?.textContent || '{}');
          return meta.alive === true && meta.projectRoot === expectedProjectRoot;
        } catch {
          return false;
        }
      }, projectRoot);

      return {
        result: {
          status: typeof result?.status === 'string' && result.status ? result.status : 'created',
          targetKind: result?.targetKind || 'project',
          slideCount: result?.slideCount ?? Number(slideCount || 3),
          projectRoot,
        },
        state: summarizeState(await this.getState()),
      };
    });
  }

  async openProject(projectRoot) {
    return this.withPage(async (page) => {
      const result = await page.evaluate((nextProjectRoot) => window.electron.project.open({ projectRoot: nextProjectRoot }), projectRoot);
      await page.waitForFunction((expectedProjectRoot) => {
        try {
          const meta = JSON.parse(document.querySelector('#terminal-meta')?.textContent || '{}');
          return meta.projectRoot === expectedProjectRoot;
        } catch {
          return false;
        }
      }, projectRoot);

      return {
        result: {
          opened: true,
          projectRoot,
          kind: result?.kind || 'project_opened',
        },
        state: summarizeState(await this.getState()),
      };
    });
  }

  async click(selector) {
    return this.withPage(async (page) => {
      await page.locator(selector).click();
      return { clicked: selector };
    });
  }

  async doubleClick(selector) {
    return this.withPage(async (page) => {
      await page.locator(selector).dblclick();
      return { doubleClicked: selector };
    });
  }

  async rightClick(selector) {
    return this.withPage(async (page) => {
      await page.locator(selector).click({ button: 'right' });
      return { rightClicked: selector };
    });
  }

  async hover(selector) {
    return this.withPage(async (page) => {
      await page.locator(selector).hover();
      return { hovered: selector };
    });
  }

  async type(selector, text) {
    return this.withPage(async (page) => {
      await page.locator(selector).fill(String(text || ''));
      return { typed: selector, text: String(text || '') };
    });
  }

  async press(key) {
    return this.withPage(async (page) => {
      await page.keyboard.press(String(key || ''));
      return { pressed: String(key || '') };
    });
  }

  async keyDown(key) {
    return this.withPage(async (page) => {
      await page.keyboard.down(String(key || ''));
      return { keyDown: String(key || '') };
    });
  }

  async keyUp(key) {
    return this.withPage(async (page) => {
      await page.keyboard.up(String(key || ''));
      return { keyUp: String(key || '') };
    });
  }

  async waitForText(text, timeoutMs = 30000) {
    return this.withPage(async (page) => {
      await page.waitForFunction((expectedText) => document.body?.innerText?.includes(expectedText), String(text || ''), {
        timeout: Number(timeoutMs || 30000),
      });
      return { matched: String(text || '') };
    });
  }

  async waitForSelector(selector, timeoutMs = 30000) {
    return this.withPage(async (page) => {
      await page.waitForSelector(String(selector || ''), { timeout: Number(timeoutMs || 30000) });
      return { matched: String(selector || '') };
    });
  }

  async isVisible(selector) {
    return this.withPage(async (page) => {
      return {
        selector,
        visible: await page.locator(selector).isVisible(),
      };
    });
  }

  async isEnabled(selector) {
    return this.withPage(async (page) => {
      return {
        selector,
        enabled: await page.locator(selector).isEnabled(),
      };
    });
  }

  async bounds(selector) {
    return this.withPage(async (page) => {
      const box = await page.locator(selector).boundingBox();
      if (!box) {
        throw new Error(`Unable to resolve bounds for selector: ${selector}`);
      }
      return { selector, ...box };
    });
  }

  async focusedElement() {
    return this.withPage(async (page) => {
      return page.evaluate(() => ({
        tag: document.activeElement?.tagName || '',
        id: document.activeElement?.id || '',
        className: document.activeElement?.className || '',
        name: document.activeElement?.getAttribute?.('name') || '',
        text: document.activeElement?.textContent || '',
      }));
    });
  }

  async visibleText(selector = 'body') {
    return this.withPage(async (page) => {
      const locator = page.locator(selector);
      return {
        selector,
        text: await locator.innerText(),
      };
    });
  }

  async screenshot(outputPath) {
    return this.withPage(async (page) => {
      const path = this.resolveOutputPath(outputPath, 'electron-operator-screenshot.png');
      await page.screenshot({ path });
      return { path };
    });
  }

  async screenshotElement(selector, outputPath) {
    return this.withPage(async (page) => {
      const path = this.resolveOutputPath(outputPath, 'electron-operator-element.png');
      await page.locator(selector).screenshot({ path });
      return { selector, path };
    });
  }

  async screenshotRegion(x, y, width, height, outputPath) {
    return this.withPage(async (page) => {
      const path = this.resolveOutputPath(outputPath, 'electron-operator-region.png');
      await page.screenshot({
        path,
        clip: {
          x: toNumber(x),
          y: toNumber(y),
          width: Math.max(1, toNumber(width, 1)),
          height: Math.max(1, toNumber(height, 1)),
        },
      });
      return { path };
    });
  }

  async mouseMove(selector) {
    const box = await this.bounds(selector);
    const x = Math.round(box.x + (box.width / 2));
    const y = Math.round(box.y + (box.height / 2));
    return this.mouseMoveCoords(x, y, selector);
  }

  async mouseMoveCoords(x, y, selector = '') {
    return this.withPage(async (page) => {
      await page.mouse.move(toNumber(x), toNumber(y));
      return {
        moved: selector || 'coords',
        x: toNumber(x),
        y: toNumber(y),
      };
    });
  }

  async mouseDown(button = 'left') {
    return this.withPage(async (page) => {
      const normalizedButton = normalizeMouseButton(button);
      await page.mouse.down({ button: normalizedButton });
      return { mouseDown: normalizedButton };
    });
  }

  async mouseUp(button = 'left') {
    return this.withPage(async (page) => {
      const normalizedButton = normalizeMouseButton(button);
      await page.mouse.up({ button: normalizedButton });
      return { mouseUp: normalizedButton };
    });
  }

  async drag(fromSelector, toSelector) {
    const from = await this.bounds(fromSelector);
    const to = await this.bounds(toSelector);
    return this.dragCoords(
      from.x + (from.width / 2),
      from.y + (from.height / 2),
      to.x + (to.width / 2),
      to.y + (to.height / 2)
    );
  }

  async dragCoords(startX, startY, endX, endY) {
    return this.withPage(async (page) => {
      await page.mouse.move(toNumber(startX), toNumber(startY));
      await page.mouse.down({ button: 'left' });
      await page.mouse.move(toNumber(endX), toNumber(endY), { steps: 12 });
      await page.mouse.up({ button: 'left' });
      return {
        dragged: true,
        start: { x: toNumber(startX), y: toNumber(startY) },
        end: { x: toNumber(endX), y: toNumber(endY) },
      };
    });
  }

  async scroll(selector, deltaX = 0, deltaY = 0) {
    return this.withPage(async (page) => {
      if (selector && selector !== 'page') {
        await page.locator(selector).hover();
      }
      await page.mouse.wheel(toNumber(deltaX), toNumber(deltaY));
      return {
        scrolled: selector || 'page',
        deltaX: toNumber(deltaX),
        deltaY: toNumber(deltaY),
      };
    });
  }

  async scrollPage(deltaX = 0, deltaY = 0) {
    return this.scroll('page', deltaX, deltaY);
  }

  async terminalFocus() {
    return this.withPage(async (page) => {
      await page.locator('#terminal-container').click();
      return { focused: true };
    });
  }

  async terminalType(text) {
    return this.withPage(async (page) => {
      await this.terminalFocus();
      await page.keyboard.type(String(text || ''));
      return { typed: String(text || '') };
    });
  }

  async terminalSend(text) {
    return this.withPage(async (page) => {
      await page.evaluate((value) => window.electron.terminal.send(value), String(text || ''));
      return { sent: String(text || '') };
    });
  }

  async terminalPress(key) {
    return this.press(key);
  }

  async terminalMeta() {
    return this.withPage(async (page) => page.evaluate(() => window.electron.terminal.getMeta()));
  }

  async previewMeta() {
    return this.withPage(async (page) => page.evaluate(() => window.electron.preview.getMeta()));
  }

  async projectMeta() {
    return this.withPage(async (page) => page.evaluate(() => window.electron.project.getMeta()));
  }

  async actionList() {
    return this.withPage(async (page) => page.evaluate(() => window.electron.actions.list()));
  }

  async actionInvoke(actionId, args = {}) {
    return this.withPage(async (page) => {
      const result = await page.evaluate(({ actionId: nextActionId, args: nextArgs }) => window.electron.actions.invoke(nextActionId, nextArgs), {
        actionId,
        args,
      });
      return {
        result,
        state: summarizeState(await this.getState()),
      };
    });
  }

  async copyVisibleTerminalText() {
    return this.withPage(async (page) => copyTerminalTextViaClipboard({
      platform: process.platform,
      readClipboardText: () => page.evaluate(() => window.electron.system.readClipboardText()),
      writeClipboardText: (value) => page.evaluate((nextValue) => window.electron.system.writeClipboardText(nextValue), String(value || '')),
      focusTerminal: () => this.terminalFocus(),
      pressShortcut: (shortcut) => page.keyboard.press(shortcut),
      wait: (ms) => page.waitForTimeout(ms),
    }));
  }

  async terminalText() {
    const text = await this.copyVisibleTerminalText();
    return { text };
  }

  async waitForTerminalText(text, timeoutMs = 30000) {
    const deadline = Date.now() + Number(timeoutMs || 30000);
    const expectedText = String(text || '');
    while (Date.now() < deadline) {
      const current = await this.copyVisibleTerminalText();
      if (current.includes(expectedText)) {
        return { matched: expectedText };
      }
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    throw new Error(`Timed out waiting for terminal text: ${expectedText}`);
  }

  async previewClick(selector) {
    const frame = await this.getPreviewSurfaceFrame();
    await frame.locator(selector).click();
    return { clicked: selector };
  }

  async previewType(selector, text) {
    const frame = await this.getPreviewSurfaceFrame();
    await frame.locator(selector).fill(String(text || ''));
    return { typed: selector, text: String(text || '') };
  }

  async previewVisibleText(selector = 'body') {
    const frame = await this.getPreviewSurfaceFrame();
    return {
      selector,
      text: await frame.locator(selector).innerText(),
    };
  }

  async previewWaitForSelector(selector, timeoutMs = 30000) {
    const frame = await this.getPreviewSurfaceFrame(timeoutMs);
    await frame.waitForSelector(String(selector || ''), { timeout: Number(timeoutMs || 30000) });
    return { matched: String(selector || '') };
  }

  async windowsList() {
    await this.ensureLaunched();
    return this.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().map((window) => ({
      id: window.id,
      title: window.getTitle(),
      focused: window.isFocused(),
      bounds: window.getBounds(),
    })));
  }

  async focusWindow(windowId) {
    await this.ensureLaunched();
    return this.app.evaluate(({ BrowserWindow }, id) => {
      const target = BrowserWindow.getAllWindows().find((window) => window.id === Number(id)) || BrowserWindow.getAllWindows()[0] || null;
      if (!target) {
        return { focused: false };
      }
      target.focus();
      return { focused: true, id: target.id };
    }, Number(windowId || 0));
  }

  async resizeWindow(width, height, windowId = 0) {
    await this.ensureLaunched();
    return this.app.evaluate(({ BrowserWindow }, payload) => {
      const windows = BrowserWindow.getAllWindows();
      const target = payload.windowId
        ? windows.find((window) => window.id === payload.windowId)
        : windows[0];
      if (!target) {
        return { resized: false };
      }
      const bounds = target.getBounds();
      target.setBounds({
        ...bounds,
        width: payload.width,
        height: payload.height,
      });
      return {
        resized: true,
        id: target.id,
        bounds: target.getBounds(),
      };
    }, {
      windowId: Number(windowId || 0),
      width: Math.max(320, Math.round(toNumber(width, 320))),
      height: Math.max(240, Math.round(toNumber(height, 240))),
    });
  }

  async closeWindow(windowId = 0) {
    await this.ensureLaunched();
    return this.app.evaluate(({ BrowserWindow }, id) => {
      const windows = BrowserWindow.getAllWindows();
      const target = id
        ? windows.find((window) => window.id === Number(id))
        : (BrowserWindow.getFocusedWindow() || windows[0] || null);
      if (!target) {
        return { closed: false };
      }
      const closedId = target.id;
      target.close();
      return { closed: true, id: closedId };
    }, Number(windowId || 0));
  }

  async waitForWindowCount(expectedCount, timeoutMs = 30000) {
    const expected = Math.max(0, Number(expectedCount || 0));
    const deadline = Date.now() + Number(timeoutMs || 30000);
    while (Date.now() < deadline) {
      const windows = await this.windowsList();
      if (windows.length === expected) {
        return { count: windows.length };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for window count: ${expected}`);
  }

  async createWindow() {
    await this.ensureLaunched();
    return this.app.evaluate(async () => globalThis.__presentationOperatorApi.createWindow());
  }

  async menuList() {
    await this.ensureLaunched();
    return this.app.evaluate(({ Menu }) => {
      const serializeItems = (items = []) => items.map((item) => ({
        id: item.id || '',
        label: item.label || '',
        role: item.role || '',
        accelerator: item.accelerator || '',
        enabled: item.enabled,
        visible: item.visible,
        submenu: item.submenu ? serializeItems(item.submenu.items || []) : [],
      }));
      const menu = Menu.getApplicationMenu();
      return serializeItems(menu?.items || []);
    });
  }

  async menuClick(pathOrId) {
    await this.ensureLaunched();
    const target = String(pathOrId || '').trim();
    if (!target) {
      throw new Error('Provide a menu path or menu item id.');
    }

    return this.app.evaluate(async ({ Menu, BrowserWindow }, selector) => {
      const menu = Menu.getApplicationMenu();
      const pathParts = selector.includes('>') ? selector.split('>').map((part) => part.trim()).filter(Boolean) : null;

      function findById(items) {
        for (const item of items) {
          if (item.id === selector) return item;
          if (item.submenu) {
            const nested = findById(item.submenu.items || []);
            if (nested) return nested;
          }
        }
        return null;
      }

      function findByPath(items, parts) {
        let currentItems = items;
        let item = null;
        for (const part of parts) {
          item = (currentItems || []).find((candidate) => candidate.label === part) || null;
          if (!item) return null;
          currentItems = item.submenu?.items || [];
        }
        return item;
      }

      const menuItem = pathParts ? findByPath(menu?.items || [], pathParts) : findById(menu?.items || []);
      if (!menuItem) {
        throw new Error(`Menu item not found: ${selector}`);
      }
      if (!menuItem.enabled) {
        throw new Error(`Menu item is disabled: ${selector}`);
      }

      const targetWindow = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null;
      if (typeof menuItem.click === 'function') {
        await menuItem.click(menuItem, targetWindow, targetWindow?.webContents, {});
      } else {
        switch (menuItem.role) {
          case 'close':
            targetWindow?.close();
            break;
          case 'minimize':
            targetWindow?.minimize();
            break;
          case 'zoom':
            targetWindow?.maximize();
            break;
          case 'togglefullscreen':
            targetWindow?.setFullScreen(!targetWindow.isFullScreen());
            break;
          default:
            throw new Error(`Menu item is not invokable through the operator: ${selector}`);
        }
      }

      return {
        clicked: selector,
        id: menuItem.id || '',
        label: menuItem.label || '',
      };
    }, target);
  }

  async dialogState() {
    await this.ensureLaunched();
    return this.app.evaluate(() => globalThis.__presentationOperatorApi.getDialogState());
  }

  async clearDialogOverrides() {
    await this.ensureLaunched();
    return this.app.evaluate(() => {
      globalThis.__presentationOperatorApi.clearDialogOverrides();
      return { cleared: true };
    });
  }

  async queueOpenDirectoryDialog(pathValue = '') {
    await this.ensureLaunched();
    const response = {
      canceled: !String(pathValue || '').trim(),
      path: String(pathValue || '').trim(),
    };
    return this.app.evaluate((_electron, nextResponse) => {
      globalThis.__presentationOperatorApi.queueDialogOverride('openDirectory', nextResponse);
      return { queued: true, kind: 'openDirectory', response: nextResponse };
    }, response);
  }

  async queueSaveDialog(pathValue = '') {
    await this.ensureLaunched();
    const response = {
      canceled: !String(pathValue || '').trim(),
      path: String(pathValue || '').trim(),
    };
    return this.app.evaluate((_electron, nextResponse) => {
      globalThis.__presentationOperatorApi.queueDialogOverride('save', nextResponse);
      return { queued: true, kind: 'save', response: nextResponse };
    }, response);
  }

  async value(selector) {
    return this.withPage(async (page) => ({
      selector,
      value: await page.locator(selector).inputValue(),
    }));
  }

  async waitForValue(selector, expectedValue, timeoutMs = 30000) {
    return this.withPage(async (page) => {
      await page.waitForFunction(({ targetSelector, targetValue }) => {
        const element = document.querySelector(targetSelector);
        return element && 'value' in element && element.value === targetValue;
      }, {
        targetSelector: String(selector || ''),
        targetValue: String(expectedValue || ''),
      }, { timeout: Number(timeoutMs || 30000) });
      return {
        selector: String(selector || ''),
        value: String(expectedValue || ''),
      };
    });
  }

  async resolveAppProcessName(preferredName = '') {
    const explicitName = String(preferredName || '').trim();
    if (explicitName) {
      return explicitName;
    }

    await this.ensureLaunched();
    return this.app.evaluate(({ app }) => app.getName());
  }

  async osAvailable() {
    const status = await getOsAutomationStatus();
    return {
      ...status,
      note: process.platform === 'darwin'
        ? 'Requires Accessibility permission for controlling the desktop.'
        : 'Desktop fallback is currently implemented for macOS only.',
    };
  }

  async osActivateApplication(appName) {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('OS automation fallback is only supported on macOS right now.');
    }
    const targetName = await this.resolveAppProcessName(appName);
    return osActivateApp(targetName);
  }

  async osMenuClick(appName, menuPath) {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('OS automation fallback is only supported on macOS right now.');
    }
    const targetName = await this.resolveAppProcessName(appName);
    return osMenuClick(targetName, String(menuPath || ''));
  }

  async osMouseMove(x, y) {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('OS automation fallback is only supported on macOS right now.');
    }
    return osMouseMove(x, y);
  }

  async osMouseClick(x, y, button = 'left') {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('OS automation fallback is only supported on macOS right now.');
    }
    return osMouseClick(x, y, button);
  }

  async osMouseDoubleClick(x, y, button = 'left') {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('OS automation fallback is only supported on macOS right now.');
    }
    return osMouseDoubleClick(x, y, button);
  }

  async osType(text) {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('OS automation fallback is only supported on macOS right now.');
    }
    return osTypeText(String(text || ''));
  }

  async osPress(key) {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('OS automation fallback is only supported on macOS right now.');
    }
    return osPressKey(String(key || ''));
  }

  async osScreenshot(outputPath) {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('OS automation fallback is only supported on macOS right now.');
    }
    const path = this.resolveOutputPath(outputPath, 'electron-operator-os.png');
    return osScreenshot(path);
  }

  async osFileDialogAvailable() {
    const status = await this.osAvailable();
    return {
      ...status,
      fileDialogAutomation: status.supported && status.accessibilityEnabled,
    };
  }

  async osFileDialogState(appName = '') {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('Native file-dialog automation is only supported on macOS right now.');
    }
    const targetName = await this.resolveAppProcessName(appName);
    return getFileDialogState(targetName);
  }

  async osFileDialogWaitOpen(appName = '', timeoutMs = 30000) {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('Native file-dialog automation is only supported on macOS right now.');
    }
    const deadline = Date.now() + Number(timeoutMs || 30000);
    while (Date.now() < deadline) {
      const state = await this.osFileDialogState(appName);
      if (state.open) {
        return state;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for native file dialog to open.');
  }

  async osFileDialogWaitClosed(appName = '', timeoutMs = 30000) {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('Native file-dialog automation is only supported on macOS right now.');
    }
    const deadline = Date.now() + Number(timeoutMs || 30000);
    while (Date.now() < deadline) {
      const state = await this.osFileDialogState(appName);
      if (!state.open) {
        return state;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Timed out waiting for native file dialog to close.');
  }

  async osFileDialogChooseFolder(folderPath = '', appName = '') {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('Native file-dialog automation is only supported on macOS right now.');
    }
    const targetName = await this.resolveAppProcessName(appName);
    return osFileDialogChooseFolder(targetName, String(folderPath || ''));
  }

  async osFileDialogCancel(appName = '') {
    if (!isOsAutomationSupported(process.platform)) {
      throw new Error('Native file-dialog automation is only supported on macOS right now.');
    }
    const targetName = await this.resolveAppProcessName(appName);
    return osFileDialogCancel(targetName);
  }
}
