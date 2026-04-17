import { readdirSync, statSync } from 'fs';
import { resolve, sep } from 'path';
import { getProjectPaths } from './deck-paths.js';

const ROOT_SOURCE_PATHS = new Set([
  'assets',
  'brief.md',
  'outline.md',
  'slides',
  'theme.css',
]);

function deriveSlideId(relativePath) {
  const match = relativePath.match(/^slides\/\d{3}-([a-z0-9-]+)(?:\/|$)/);
  return match ? match[1] : '';
}

function classifyProjectPath(relativePath, paths) {
  if (relativePath === '.') {
    return 'root';
  }

  if (relativePath === paths.rootPdfRel) {
    return 'deliverable';
  }

  if (relativePath === paths.systemDirRel || relativePath.startsWith(`${paths.systemDirRel}/`)) {
    return 'system';
  }

  if (relativePath === paths.claudeDirRel || relativePath.startsWith(`${paths.claudeDirRel}/`)) {
    return 'adapter';
  }

  if (
    ROOT_SOURCE_PATHS.has(relativePath)
    || relativePath.startsWith('assets/')
    || relativePath.startsWith('slides/')
  ) {
    return 'source';
  }

  return 'other';
}

function deriveNodeKind(relativePath, classification, slideId, isDirectory) {
  if (relativePath === '.') {
    return 'root';
  }

  if (classification === 'system') {
    return isDirectory ? 'system-directory' : 'system-file';
  }

  if (slideId && isDirectory && /^slides\/\d{3}-[a-z0-9-]+$/.test(relativePath)) {
    return 'slide-directory';
  }

  if (slideId && /\/slide\.html$/.test(relativePath)) {
    return 'slide-file';
  }

  return isDirectory ? 'directory' : 'file';
}

function buildLeafNode(childAbs, rootAbs, projectPaths) {
  const relativePath = childAbs.slice(rootAbs.length + 1).replace(/\\/g, '/');
  const slideId = deriveSlideId(relativePath);
  const classification = classifyProjectPath(relativePath, projectPaths);

  return {
    name: childAbs.split(sep).pop(),
    relativePath,
    kind: deriveNodeKind(relativePath, classification, slideId, false),
    classification,
    isDirectory: false,
    isSystem: classification === 'system',
    isPrimary: classification === 'source' || classification === 'deliverable',
    slideId: slideId || null,
  };
}

export function buildProjectTreeNode(absPath, rootAbs, projectPaths = getProjectPaths(rootAbs)) {
  const entries = readdirSync(absPath, { withFileTypes: true })
    .filter((entry) => !['.DS_Store', 'Thumbs.db'].includes(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const relativePath = absPath === rootAbs ? '.' : absPath.slice(rootAbs.length + 1).replace(/\\/g, '/');
  const slideId = deriveSlideId(relativePath);
  const isDirectory = absPath === rootAbs || statSync(absPath).isDirectory();
  const classification = classifyProjectPath(relativePath, projectPaths);

  return {
    name: absPath === rootAbs ? '.' : absPath.split(sep).pop(),
    relativePath,
    kind: deriveNodeKind(relativePath, classification, slideId, isDirectory),
    classification,
    isDirectory,
    isSystem: classification === 'system',
    isPrimary: classification === 'source' || classification === 'deliverable',
    slideId: slideId || null,
    children: entries.map((entry) => {
      const childAbs = resolve(absPath, entry.name);
      return entry.isDirectory()
        ? buildProjectTreeNode(childAbs, rootAbs, projectPaths)
        : buildLeafNode(childAbs, rootAbs, projectPaths);
    }),
  };
}
