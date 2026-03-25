function isMacPlatform(platform = '') {
  const normalized = String(platform || '').trim().toLowerCase();
  return normalized === 'darwin' || normalized.startsWith('mac');
}

export function getTerminalClipboardShortcutModifier(platform = '') {
  return isMacPlatform(platform) ? 'Meta' : 'Control';
}

export async function waitForClipboardTextChange({
  readClipboardText,
  previousValue,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  timeoutMs = 1200,
  pollIntervalMs = 20,
} = {}) {
  const deadline = Date.now() + Number(timeoutMs || 1200);

  while (Date.now() < deadline) {
    const currentValue = String(await readClipboardText() || '');
    if (currentValue !== String(previousValue || '')) {
      return currentValue;
    }
    await wait(pollIntervalMs);
  }

  throw new Error('Timed out waiting for terminal clipboard copy to complete.');
}

export async function copyTerminalTextViaClipboard({
  platform = '',
  readClipboardText,
  writeClipboardText,
  focusTerminal,
  pressShortcut,
  wait,
  timeoutMs = 1200,
} = {}) {
  const modifier = getTerminalClipboardShortcutModifier(platform);
  const previousClipboard = String(await readClipboardText() || '');
  const sentinel = `__PF_TERMINAL_CAPTURE__${Date.now()}_${Math.random().toString(36).slice(2)}`;

  await writeClipboardText(sentinel);

  try {
    await focusTerminal();
    await pressShortcut(`${modifier}+A`);
    await pressShortcut(`${modifier}+C`);
    return await waitForClipboardTextChange({
      readClipboardText,
      previousValue: sentinel,
      wait,
      timeoutMs,
    });
  } finally {
    await writeClipboardText(previousClipboard);
  }
}
