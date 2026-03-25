import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

const KEY_CODE_MAP = {
  enter: 36,
  return: 36,
  tab: 48,
  space: 49,
  escape: 53,
  esc: 53,
  left: 123,
  right: 124,
  down: 125,
  up: 126,
  delete: 51,
  backspace: 51,
};

export function isOsAutomationSupported(platform = process.platform) {
  return platform === 'darwin';
}

export function escapeAppleScriptString(value = '') {
  return String(value || '').replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

export function parseMenuPath(value = '') {
  return String(value || '')
    .split('>')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildMenuClickAppleScript(appName, menuPath) {
  const parts = Array.isArray(menuPath) ? menuPath : parseMenuPath(menuPath);
  if (parts.length < 2) {
    throw new Error('Menu path must include at least a top-level menu and one menu item.');
  }

  let chain = `menu bar item \"${escapeAppleScriptString(parts[0])}\" of menu bar 1`;
  for (let index = 1; index < parts.length; index += 1) {
    chain = `menu item \"${escapeAppleScriptString(parts[index])}\" of menu 1 of ${chain}`;
  }

  return [
    `tell application \"${escapeAppleScriptString(appName)}\" to activate`,
    'tell application "System Events"',
    `  tell process \"${escapeAppleScriptString(appName)}\"`,
    `    click ${chain}`,
    '  end tell',
    'end tell',
  ].join('\n');
}

export function buildKeystrokeAppleScript(text = '') {
  return [
    'tell application "System Events"',
    `  keystroke \"${escapeAppleScriptString(text)}\"`,
    'end tell',
  ].join('\n');
}

export function buildKeyPressAppleScript(key = '') {
  const normalized = String(key || '').trim().toLowerCase();
  const keyCode = KEY_CODE_MAP[normalized];
  if (keyCode != null) {
    return [
      'tell application "System Events"',
      `  key code ${keyCode}`,
      'end tell',
    ].join('\n');
  }

  return [
    'tell application "System Events"',
    `  keystroke \"${escapeAppleScriptString(key)}\"`,
    'end tell',
  ].join('\n');
}

function buildSwiftMouseScript(action, x, y, button = 'left') {
  const pointX = Number(x);
  const pointY = Number(y);
  const normalizedButton = String(button || 'left').trim().toLowerCase();
  const cgButton = normalizedButton === 'right' ? '.right' : normalizedButton === 'middle' ? '.center' : '.left';
  const downType = normalizedButton === 'right' ? '.rightMouseDown' : normalizedButton === 'middle' ? '.otherMouseDown' : '.leftMouseDown';
  const upType = normalizedButton === 'right' ? '.rightMouseUp' : normalizedButton === 'middle' ? '.otherMouseUp' : '.leftMouseUp';
  const moveType = normalizedButton === 'right' ? '.rightMouseDragged' : normalizedButton === 'middle' ? '.otherMouseDragged' : '.mouseMoved';

  const lines = [
    'import CoreGraphics',
    'import Foundation',
    'func post(_ type: CGEventType, _ button: CGMouseButton, _ x: Double, _ y: Double, _ clickState: Int64 = 1) {',
    '  let source = CGEventSource(stateID: .combinedSessionState)',
    '  let event = CGEvent(mouseEventSource: source, mouseType: type, mouseCursorPosition: CGPoint(x: x, y: y), mouseButton: button)!',
    '  event.setIntegerValueField(.mouseEventClickState, value: clickState)',
    '  event.post(tap: .cghidEventTap)',
    '}',
  ];

  if (action === 'move') {
    lines.push(`post(${moveType}, ${cgButton}, ${pointX}, ${pointY})`);
  } else if (action === 'click') {
    lines.push(`post(${downType}, ${cgButton}, ${pointX}, ${pointY})`);
    lines.push(`post(${upType}, ${cgButton}, ${pointX}, ${pointY})`);
  } else if (action === 'doubleClick') {
    lines.push(`post(${downType}, ${cgButton}, ${pointX}, ${pointY}, 1)`);
    lines.push(`post(${upType}, ${cgButton}, ${pointX}, ${pointY}, 1)`);
    lines.push(`post(${downType}, ${cgButton}, ${pointX}, ${pointY}, 2)`);
    lines.push(`post(${upType}, ${cgButton}, ${pointX}, ${pointY}, 2)`);
  }

  return lines.join('\n');
}

function buildResolveProcessHandlers() {
  return [
    'on resolveProcessName(requestedName)',
    '  tell application "System Events"',
    '    if requestedName is not "" then return requestedName',
    '    return name of first application process whose frontmost is true',
    '  end tell',
    'end resolveProcessName',
    '',
    'on firstDialogContainer(procRef)',
    '  repeat with currentWindow in windows of procRef',
    '    try',
    '      if (count of sheets of currentWindow) > 0 then',
    '        return (item 1 of (sheets of currentWindow))',
    '      end if',
    '    end try',
    '    try',
    '      set windowName to (name of currentWindow)',
    '      if windowName is in {"Open", "Save"} then return currentWindow',
    '      repeat with currentButton in buttons of currentWindow',
    '        try',
    '          set buttonName to (name of currentButton)',
    '          if buttonName is in {"Choose", "Open", "Save", "Cancel"} then return currentWindow',
    '        end try',
    '      end repeat',
    '    end try',
    '  end repeat',
    '  return missing value',
    'end firstDialogContainer',
    '',
    'on firstDialogWindow(procRef)',
    '  repeat with currentWindow in windows of procRef',
    '    try',
    '      set windowName to (name of currentWindow)',
    '      if windowName is in {"Open", "Save"} then return currentWindow',
    '      repeat with currentButton in buttons of currentWindow',
    '        try',
    '          set buttonName to (name of currentButton)',
    '          if buttonName is in {"Choose", "Open", "Save", "Cancel"} then return currentWindow',
    '        end try',
    '      end repeat',
    '    end try',
    '  end repeat',
    '  return missing value',
    'end firstDialogWindow',
    '',
    'on waitForDialog(procRef, maxAttempts)',
    '  repeat maxAttempts times',
    '    set dialogRef to my firstDialogContainer(procRef)',
    '    if dialogRef is not missing value then return dialogRef',
    '    delay 0.1',
    '  end repeat',
    '  error "Timed out waiting for native file dialog."',
    'end waitForDialog',
    '',
    'on waitForDialogWindow(procRef, maxAttempts)',
    '  repeat maxAttempts times',
    '    set windowRef to my firstDialogWindow(procRef)',
    '    if windowRef is not missing value then return windowRef',
    '    delay 0.1',
    '  end repeat',
    '  error "Timed out waiting for native file dialog window."',
    'end waitForDialogWindow',
    '',
    'on waitForNestedSheet(containerRef, maxAttempts)',
    '  repeat maxAttempts times',
    '    try',
    '      repeat with currentWindow in windows of containerRef',
    '        try',
    '          if (count of sheets of currentWindow) > 0 then',
    '            return (item 1 of (sheets of currentWindow))',
    '          end if',
    '        end try',
    '      end repeat',
    '    end try',
    '    try',
    '      if (count of sheets of containerRef) > 0 then',
    '        return (item 1 of (sheets of containerRef))',
    '      end if',
    '    end try',
    '    delay 0.05',
    '  end repeat',
    '  error "Timed out waiting for nested native file dialog sheet."',
    'end waitForNestedSheet',
    '',
    'on clickFirstMatchingButton(containerRef, labels)',
    '  repeat with currentLabel in labels',
    '    try',
    '      set buttonName to (contents of currentLabel)',
    '      repeat with currentButton in buttons of containerRef',
    '        try',
    '          if (name of currentButton) is buttonName then',
    '            tell application "System Events" to click currentButton',
    '            return buttonName',
    '          end if',
    '        end try',
    '      end repeat',
    '    end try',
    '  end repeat',
    '  return ""',
    'end clickFirstMatchingButton',
    '',
    'on firstMatchingButtonLabel(containerRef, labels)',
    '  repeat with currentLabel in labels',
    '    try',
    '      set buttonName to (contents of currentLabel)',
    '      repeat with currentButton in buttons of containerRef',
    '        try',
    '          if (name of currentButton) is buttonName then',
    '            return buttonName',
    '          end if',
    '        end try',
    '      end repeat',
    '    end try',
    '  end repeat',
    '  return ""',
    'end firstMatchingButtonLabel',
  ].join('\n');
}

export function buildFileDialogStateAppleScript(appName = '') {
  return [
    `set requestedProcessName to \"${escapeAppleScriptString(appName)}\"`,
    buildResolveProcessHandlers(),
    'set processName to my resolveProcessName(requestedProcessName)',
    'tell application "System Events"',
    '  tell process processName',
    '    set processRef to it',
    '    set dialogRef to my firstDialogContainer(processRef)',
    '    if dialogRef is missing value then',
    `      return processName & "${APPLESCRIPT_DELIMITER}" & "false" & "${APPLESCRIPT_DELIMITER}" & ""`,
    '    end if',
    '    set confirmLabel to my firstMatchingButtonLabel(dialogRef, {"Choose", "Open", "Save", "Cancel"})',
    `    return processName & "${APPLESCRIPT_DELIMITER}" & "true" & "${APPLESCRIPT_DELIMITER}" & confirmLabel`,
    '  end tell',
    'end tell',
  ].join('\n');
}

export function buildFileDialogChooseFolderAppleScript(appName = '', folderPath = '') {
  return [
    `set requestedProcessName to \"${escapeAppleScriptString(appName)}\"`,
    `set targetPath to \"${escapeAppleScriptString(folderPath)}\"`,
    buildResolveProcessHandlers(),
    'set processName to my resolveProcessName(requestedProcessName)',
    'tell application "System Events"',
    '  tell process processName',
    '    set processRef to it',
    '    set frontmost to true',
    '    set dialogRef to my waitForDialog(processRef, 200)',
    '    delay 0.15',
    '    keystroke "g" using {command down, shift down}',
    '    set goToSheet to missing value',
    '    repeat 120 times',
    '      repeat with currentWindow in windows',
    '        try',
    '          if (count of sheets of currentWindow) > 0 then',
    '            set goToSheet to (item 1 of (sheets of currentWindow))',
    '            exit repeat',
    '          end if',
    '        end try',
    '      end repeat',
    '      if goToSheet is not missing value then exit repeat',
    '      delay 0.05',
    '    end repeat',
    '    if goToSheet is missing value then error "Timed out waiting for nested native file dialog sheet."',
    '    try',
    '      set value of text field 1 of goToSheet to targetPath',
    '    on error',
    '      try',
    '        click text field 1 of goToSheet',
    '      end try',
    '      keystroke "a" using {command down}',
    '      keystroke targetPath',
    '    end try',
    '    set goClicked to my clickFirstMatchingButton(goToSheet, {"Go", "Open"})',
    '    if goClicked is "" then key code 36',
    '    delay 0.45',
    '    key code 36',
    '    set confirmClicked to "Enter"',
    '    repeat 80 times',
    '      if my firstDialogWindow(processRef) is missing value then exit repeat',
    '      delay 0.1',
    '    end repeat',
    `    return processName & "${APPLESCRIPT_DELIMITER}" & confirmClicked & "${APPLESCRIPT_DELIMITER}" & targetPath`,
    '  end tell',
    'end tell',
  ].join('\n');
}

export function buildFileDialogCancelAppleScript(appName = '') {
  return [
    `set requestedProcessName to \"${escapeAppleScriptString(appName)}\"`,
    buildResolveProcessHandlers(),
    'set processName to my resolveProcessName(requestedProcessName)',
    'tell application "System Events"',
    '  tell process processName',
    '    set processRef to it',
    '    set dialogRef to my waitForDialog(processRef, 120)',
    '    set cancelledLabel to my clickFirstMatchingButton(dialogRef, {"Cancel"})',
    '    if cancelledLabel is "" then error "Unable to cancel native file dialog."',
    `    return processName & "${APPLESCRIPT_DELIMITER}" & cancelledLabel`,
    '  end tell',
    'end tell',
  ].join('\n');
}

const APPLESCRIPT_DELIMITER = '__PF_DELIM__';

export async function runAppleScript(script) {
  const { stdout } = await execFile('/usr/bin/osascript', ['-e', script]);
  return stdout.trim();
}

export async function runSwiftScript(script) {
  const { stdout } = await execFile('/usr/bin/swift', ['-e', script]);
  return stdout.trim();
}

export async function getOsAutomationStatus() {
  if (!isOsAutomationSupported(process.platform)) {
    return {
      platform: process.platform,
      supported: false,
      accessibilityEnabled: false,
    };
  }

  const raw = await runAppleScript('tell application "System Events" to UI elements enabled');
  return {
    platform: process.platform,
    supported: true,
    accessibilityEnabled: String(raw || '').trim().toLowerCase() === 'true',
  };
}

export async function getFileDialogState(appName = '') {
  const raw = await runAppleScript(buildFileDialogStateAppleScript(appName));
  const [processName = '', open = 'false', confirmLabel = ''] = String(raw || '').split(APPLESCRIPT_DELIMITER);
  return {
    processName,
    open: open === 'true',
    confirmLabel,
  };
}

export async function osFileDialogChooseFolder(appName = '', folderPath = '') {
  const raw = await runAppleScript(buildFileDialogChooseFolderAppleScript(appName, folderPath));
  const [processName = '', confirmed = '', path = ''] = String(raw || '').split(APPLESCRIPT_DELIMITER);
  return {
    processName,
    confirmed,
    path,
  };
}

export async function osFileDialogCancel(appName = '') {
  const raw = await runAppleScript(buildFileDialogCancelAppleScript(appName));
  const [processName = '', cancelled = ''] = String(raw || '').split(APPLESCRIPT_DELIMITER);
  return {
    processName,
    cancelled,
  };
}

export async function osMenuClick(appName, menuPath) {
  await runAppleScript(buildMenuClickAppleScript(appName, menuPath));
  return { clicked: Array.isArray(menuPath) ? menuPath.join(' > ') : String(menuPath || '') };
}

export async function osActivateApp(appName) {
  await runAppleScript(`tell application \"${escapeAppleScriptString(appName)}\" to activate`);
  return { activated: appName };
}

export async function osTypeText(text) {
  await runAppleScript(buildKeystrokeAppleScript(text));
  return { typed: String(text || '') };
}

export async function osPressKey(key) {
  await runAppleScript(buildKeyPressAppleScript(key));
  return { pressed: String(key || '') };
}

export async function osMouseMove(x, y) {
  await runSwiftScript(buildSwiftMouseScript('move', x, y));
  return { moved: true, x: Number(x), y: Number(y) };
}

export async function osMouseClick(x, y, button = 'left') {
  await runSwiftScript(buildSwiftMouseScript('click', x, y, button));
  return { clicked: true, x: Number(x), y: Number(y), button: String(button || 'left') };
}

export async function osMouseDoubleClick(x, y, button = 'left') {
  await runSwiftScript(buildSwiftMouseScript('doubleClick', x, y, button));
  return { doubleClicked: true, x: Number(x), y: Number(y), button: String(button || 'left') };
}

export async function osScreenshot(path) {
  await execFile('/usr/sbin/screencapture', ['-x', String(path)]);
  return { path: String(path) };
}
