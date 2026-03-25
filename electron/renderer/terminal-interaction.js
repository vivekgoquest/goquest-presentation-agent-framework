export function isMacPlatform(platform = process.platform) {
  const normalizedPlatform = String(platform || '').toLowerCase();
  return normalizedPlatform === 'darwin' || normalizedPlatform.startsWith('mac');
}

export function isTerminalShortcutModifierActive({ platform = process.platform, metaKey = false, ctrlKey = false } = {}) {
  return isMacPlatform(platform) ? Boolean(metaKey) : Boolean(ctrlKey);
}

export function getTerminalClipboardAction(options = {}) {
  const {
    platform = process.platform,
    key = '',
    metaKey = false,
    ctrlKey = false,
    altKey = false,
    shiftKey = false,
    terminalFocused = false,
    hasSelection = false,
  } = options;

  if (!terminalFocused) {
    return null;
  }

  if (altKey || shiftKey) {
    return null;
  }

  if (!isTerminalShortcutModifierActive({ platform, metaKey, ctrlKey })) {
    return null;
  }

  const normalizedKey = String(key || '').toLowerCase();
  switch (normalizedKey) {
    case 'c':
      return hasSelection ? 'copy' : null;
    case 'v':
      return 'paste';
    case 'a':
      return 'selectAll';
    default:
      return null;
  }
}

export function getTerminalContextMenuItems(options = {}) {
  const {
    terminalFocused = false,
    hasSelection = false,
  } = options;

  if (!terminalFocused) {
    return [];
  }

  return [
    { id: 'copy', label: 'Copy', enabled: Boolean(hasSelection) },
    { id: 'paste', label: 'Paste', enabled: true },
    { id: 'selectAll', label: 'Select All', enabled: true },
  ];
}

export function getTerminalShortcutHint(options = {}) {
  const modifier = isMacPlatform(options.platform) ? '⌘' : 'Ctrl+';
  return `${modifier}C copy selection • ${modifier}V paste • ${modifier}A select all`;
}

export function getTerminalSurfaceState(options = {}) {
  return {
    focused: options.terminalFocused ? 'true' : 'false',
    selection: options.hasSelection ? 'true' : 'false',
  };
}

export async function runTerminalClipboardAction(action, options = {}) {
  const terminal = options.terminal;
  const clipboard = options.clipboard || {};
  const sendTerminalInput = options.sendTerminalInput || (() => {});

  switch (action) {
    case 'copy': {
      const selectedText = String(terminal?.getSelection?.() || '');
      if (selectedText) {
        await clipboard.writeText?.(selectedText);
      }
      return;
    }
    case 'paste': {
      const clipboardText = String(await clipboard.readText?.() || '');
      if (clipboardText) {
        sendTerminalInput(clipboardText);
      }
      return;
    }
    case 'selectAll':
      terminal?.selectAll?.();
      return;
    default:
      return;
  }
}
