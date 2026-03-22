import { resolve } from 'node:path';
import { FRAMEWORK_ROOT, getProjectPaths, resolveProjectFrameworkAssetAbs } from '../runtime/deck-paths.js';

function isInsideRoot(targetAbs, rootAbs) {
  const normalizedTarget = resolve(targetAbs);
  const normalizedRoot = resolve(rootAbs);
  return normalizedTarget === normalizedRoot
    || normalizedTarget.startsWith(`${normalizedRoot}/`)
    || normalizedTarget.startsWith(`${normalizedRoot}\\`);
}

export function resolveProjectFrameworkAsset(projectRootAbs, relativePath) {
  if (!projectRootAbs) {
    throw new Error('Project root is required to resolve framework assets.');
  }

  const projectPaths = getProjectPaths(projectRootAbs);
  const resolved = resolveProjectFrameworkAssetAbs(projectPaths, relativePath);
  const allowedRoots = [FRAMEWORK_ROOT, projectPaths.frameworkBaseAbs, projectPaths.frameworkOverridesAbs];
  if (!allowedRoots.some((rootAbs) => isInsideRoot(resolved, rootAbs))) {
    throw new Error(`Resolved framework asset escaped allowed roots: ${relativePath}`);
  }
  return resolved;
}
