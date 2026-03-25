function isMacPlatform(platform = process.platform) {
  const normalizedPlatform = String(platform || '').toLowerCase();
  return normalizedPlatform === 'darwin' || normalizedPlatform.startsWith('mac');
}

export function isTerminalSearchShortcut(options = {}) {
  const {
    platform = process.platform,
    key = '',
    metaKey = false,
    ctrlKey = false,
    altKey = false,
    shiftKey = false,
    terminalFocused = false,
  } = options;

  if (!terminalFocused || altKey || shiftKey) {
    return false;
  }

  const modifierActive = isMacPlatform(platform) ? Boolean(metaKey) : Boolean(ctrlKey);
  return modifierActive && String(key || '').toLowerCase() === 'f';
}

export function getTerminalSearchAction(options = {}) {
  const {
    searchOpen = false,
    key = '',
    shiftKey = false,
  } = options;

  if (!searchOpen) {
    return null;
  }

  if (key === 'Escape') {
    return 'close';
  }

  if (key === 'Enter') {
    return shiftKey ? 'previous' : 'next';
  }

  return null;
}

export function getTerminalSearchUiModel(options = {}) {
  const query = String(options.query || '');
  return {
    open: Boolean(options.open),
    query,
    canNavigate: query.trim().length > 0,
    placeholder: 'Find in terminal',
  };
}
