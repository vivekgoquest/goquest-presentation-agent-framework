const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const PROJECT_PATH_LINE_SUFFIX = /:(\d+)(:\d+)?$/;
const PROJECT_PATH_REGEX = /(?:\.{1,2}\/)?(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+(?::\d+(?::\d+)?)?|\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+\.[A-Za-z0-9_-]+(?::\d+(?::\d+)?)?/g;

function normalizeSlashPath(value = '') {
  return String(value || '').replaceAll('\\', '/');
}

function isAbsolutePath(value = '') {
  return /^\//.test(value) || /^[A-Za-z]:\//.test(value);
}

function normalizePathSegments(value = '') {
  const normalized = normalizeSlashPath(value);
  const hasLeadingSlash = normalized.startsWith('/');
  const drivePrefix = normalized.match(/^[A-Za-z]:\//)?.[0] || '';
  const segments = normalized
    .replace(/^[A-Za-z]:\//, '')
    .split('/')
    .filter(Boolean);
  const output = [];

  for (const segment of segments) {
    if (segment === '.') {
      continue;
    }
    if (segment === '..') {
      output.pop();
      continue;
    }
    output.push(segment);
  }

  const joined = output.join('/');
  if (drivePrefix) {
    return `${drivePrefix}${joined}`;
  }
  return hasLeadingSlash ? `/${joined}` : joined;
}

function resolveProjectPath(projectRoot = '', candidatePath = '') {
  const normalizedRoot = normalizePathSegments(projectRoot);
  const normalizedCandidate = normalizePathSegments(candidatePath);
  if (isAbsolutePath(normalizedCandidate)) {
    return normalizedCandidate;
  }
  return normalizePathSegments(`${normalizedRoot}/${normalizedCandidate}`);
}

function relativeProjectPath(projectRoot = '', absolutePath = '') {
  const normalizedRoot = normalizePathSegments(projectRoot).replace(/\/+$/, '');
  const normalizedAbsolute = normalizePathSegments(absolutePath);
  if (normalizedAbsolute === normalizedRoot) {
    return '';
  }
  if (!normalizedAbsolute.startsWith(`${normalizedRoot}/`)) {
    return '';
  }
  return normalizedAbsolute.slice(normalizedRoot.length + 1);
}

export function normalizeTerminalExternalUrl(value = '') {
  const trimmed = String(value || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

export function normalizeTerminalProjectPathLink(value = '', options = {}) {
  const projectRoot = String(options.projectRoot || '').trim();
  const rawText = String(value || '').trim();
  if (!projectRoot || !rawText || normalizeTerminalExternalUrl(rawText)) {
    return null;
  }

  const strippedPath = rawText.replace(PROJECT_PATH_LINE_SUFFIX, '');
  const candidatePath = strippedPath.startsWith('./') ? strippedPath.slice(2) : strippedPath;
  const absolutePath = resolveProjectPath(projectRoot, candidatePath);
  const relativePath = relativeProjectPath(projectRoot, absolutePath);

  if (!relativePath) {
    return null;
  }

  return {
    text: rawText,
    targetPath: relativePath,
  };
}

export async function openTerminalExternalLink(value, options = {}) {
  const normalizedUrl = normalizeTerminalExternalUrl(value);
  if (!normalizedUrl) {
    return false;
  }

  await options.openExternal?.(normalizedUrl);
  return true;
}

function getWindowedLineStrings(lineIndex, terminal) {
  let line;
  let topIdx = lineIndex;
  let bottomIdx = lineIndex;
  let length = 0;
  let content = '';
  const lines = [];

  if ((line = terminal.buffer.active.getLine(lineIndex))) {
    const currentContent = line.translateToString(true);

    if (line.isWrapped && currentContent[0] !== ' ') {
      length = 0;
      while ((line = terminal.buffer.active.getLine(--topIdx)) && length < 2048) {
        content = line.translateToString(true);
        length += content.length;
        lines.push(content);
        if (!line.isWrapped || content.indexOf(' ') !== -1) {
          break;
        }
      }
      lines.reverse();
    }

    lines.push(currentContent);

    length = 0;
    while ((line = terminal.buffer.active.getLine(++bottomIdx)) && line.isWrapped && length < 2048) {
      content = line.translateToString(true);
      length += content.length;
      lines.push(content);
      if (content.indexOf(' ') !== -1) {
        break;
      }
    }
  }

  return [lines, topIdx];
}

function mapStringIndexToBuffer(terminal, lineIndex, rowIndex, stringIndex) {
  const buffer = terminal.buffer.active;
  const cell = buffer.getNullCell();
  let start = rowIndex;
  while (stringIndex) {
    const line = buffer.getLine(lineIndex);
    if (!line) {
      return [-1, -1];
    }

    for (let i = start; i < line.length; ++i) {
      line.getCell(i, cell);
      const chars = cell.getChars();
      if (cell.getWidth()) {
        stringIndex -= chars.length || 1;
      }
      if (stringIndex < 0) {
        return [lineIndex, i];
      }
    }

    lineIndex += 1;
    start = 0;
  }

  return [lineIndex, start];
}

export function createTerminalProjectPathLinkProvider(terminal, options = {}) {
  return {
    provideLinks(bufferLineNumber, callback) {
      const projectRoot = String(options.getProjectRoot?.() || '').trim();
      if (!projectRoot) {
        callback(undefined);
        return;
      }

      const [lines, startLineIndex] = getWindowedLineStrings(bufferLineNumber - 1, terminal);
      const line = lines.join('');
      const matches = [];
      const regex = new RegExp(PROJECT_PATH_REGEX.source, PROJECT_PATH_REGEX.flags);
      let match;

      while ((match = regex.exec(line))) {
        const rawText = match[0];
        if (line.slice(Math.max(0, match.index - 3), match.index) === '://') {
          continue;
        }

        const normalized = normalizeTerminalProjectPathLink(rawText, { projectRoot });
        if (!normalized) {
          continue;
        }

        const [startY, startX] = mapStringIndexToBuffer(terminal, startLineIndex, 0, match.index);
        const [endY, endX] = mapStringIndexToBuffer(terminal, startY, startX, rawText.length);
        if (startY === -1 || startX === -1 || endY === -1 || endX === -1) {
          continue;
        }

        matches.push({
          range: {
            start: { x: startX + 1, y: startY + 1 },
            end: { x: endX, y: endY + 1 },
          },
          text: normalized.text,
          activate: () => {
            options.onActivate?.(normalized.targetPath, normalized.text);
          },
        });
      }

      callback(matches.length > 0 ? matches : undefined);
    },
  };
}
