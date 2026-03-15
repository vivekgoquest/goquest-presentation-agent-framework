import { readdirSync, statSync } from 'fs';
import { resolve, sep } from 'path';
import { PROJECT_SYSTEM_DIRNAME } from './deck-paths.js';

const PRIMARY_PROJECT_PATHS = new Set([
  'brief.md',
  'outline.md',
  'revisions.md',
  'theme.css',
  'assets',
  'slides',
  'outputs',
]);

function deriveSlideId(relativePath) {
  const match = relativePath.match(/^slides\/\d{3}-([a-z0-9-]+)(?:\/|$)/);
  return match ? match[1] : '';
}

export function buildProjectTreeNode(absPath, rootAbs) {
  const entries = readdirSync(absPath, { withFileTypes: true })
    .filter((entry) => !['.DS_Store', 'Thumbs.db'].includes(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const relativePath = absPath === rootAbs ? '.' : absPath.slice(rootAbs.length + 1).replace(/\\/g, '/');
  const systemManaged = relativePath === PROJECT_SYSTEM_DIRNAME || relativePath.startsWith(`${PROJECT_SYSTEM_DIRNAME}/`);
  const slideId = deriveSlideId(relativePath);
  const isDirectory = absPath === rootAbs || statSync(absPath).isDirectory();

  let kind = 'directory';
  if (relativePath === '.') {
    kind = 'root';
  } else if (systemManaged) {
    kind = isDirectory ? 'system-directory' : 'system-file';
  } else if (slideId && isDirectory && /^slides\/\d{3}-[a-z0-9-]+$/.test(relativePath)) {
    kind = 'slide-directory';
  } else if (slideId && /\/slide\.html$/.test(relativePath)) {
    kind = 'slide-file';
  } else if (relativePath.startsWith('outputs/')) {
    kind = isDirectory ? 'output-directory' : 'output-file';
  } else if (!isDirectory) {
    kind = 'file';
  }

  return {
    name: absPath === rootAbs ? '.' : absPath.split(sep).pop(),
    relativePath,
    kind,
    isDirectory,
    isSystem: systemManaged,
    isPrimary: PRIMARY_PROJECT_PATHS.has(relativePath),
    slideId: slideId || null,
    children: entries.map((entry) => {
      const childAbs = resolve(absPath, entry.name);
      if (entry.isDirectory()) {
        return buildProjectTreeNode(childAbs, rootAbs);
      }
      const childRelativePath = childAbs.slice(rootAbs.length + 1).replace(/\\/g, '/');
      const childSystemManaged = childRelativePath === PROJECT_SYSTEM_DIRNAME || childRelativePath.startsWith(`${PROJECT_SYSTEM_DIRNAME}/`);
      const childSlideId = deriveSlideId(childRelativePath);
      return {
        name: entry.name,
        relativePath: childRelativePath,
        kind: childSystemManaged
          ? 'system-file'
          : childSlideId && /\/slide\.html$/.test(childRelativePath)
            ? 'slide-file'
            : childRelativePath.startsWith('outputs/')
              ? 'output-file'
              : 'file',
        isDirectory: false,
        isSystem: childSystemManaged,
        isPrimary: PRIMARY_PROJECT_PATHS.has(childRelativePath),
        slideId: childSlideId || null,
      };
    }),
  };
}
