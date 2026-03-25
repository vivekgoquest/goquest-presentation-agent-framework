import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFileDialogChooseFolderAppleScript,
  buildFileDialogStateAppleScript,
  buildKeyPressAppleScript,
  buildMenuClickAppleScript,
  buildKeystrokeAppleScript,
  isOsAutomationSupported,
  parseMenuPath,
} from '../os-automation.mjs';

test('os automation helpers detect supported platform and parse menu paths', () => {
  assert.equal(isOsAutomationSupported('darwin'), true);
  assert.equal(isOsAutomationSupported('linux'), false);
  assert.deepEqual(parseMenuPath('File > Open Project…'), ['File', 'Open Project…']);
});

test('os automation builds AppleScript for menu clicks and key input', () => {
  const menuScript = buildMenuClickAppleScript('Presentation Desktop', 'File > New Project…');
  assert.match(menuScript, /tell application "Presentation Desktop" to activate/);
  assert.match(menuScript, /menu bar item "File"/);
  assert.match(menuScript, /menu item "New Project…"/);

  const typeScript = buildKeystrokeAppleScript('hello');
  assert.match(typeScript, /keystroke "hello"/);

  const enterScript = buildKeyPressAppleScript('Enter');
  assert.match(enterScript, /key code 36/);
});

test('os automation builds AppleScript for native choose-folder dialog interaction', () => {
  const chooseScript = buildFileDialogChooseFolderAppleScript('Electron', '/tmp/native-picker-demo');
  assert.match(chooseScript, /set requestedProcessName to "Electron"/);
  assert.match(chooseScript, /set targetPath to "\/tmp\/native-picker-demo"/);
  assert.match(chooseScript, /keystroke "g" using \{command down, shift down\}/);
  assert.match(chooseScript, /repeat with currentButton in buttons of containerRef/);
  assert.match(chooseScript, /if \(name of currentButton\) is buttonName then/);
  assert.match(chooseScript, /click currentButton/);

  const stateScript = buildFileDialogStateAppleScript('Electron');
  assert.match(stateScript, /set requestedProcessName to "Electron"/);
  assert.match(stateScript, /return processName & "__PF_DELIM__" & "true"/);
});
