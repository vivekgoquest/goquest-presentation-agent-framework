import { existsSync, readFileSync } from 'node:fs';
import { getProjectPaths } from './deck-paths.js';
import { writeInitialPresentationIntent } from './presentation-intent.js';
import { ensurePresentationRuntimeStateFiles } from './presentation-runtime-state.js';
import { computeStructuralManifest, recordStructuralManifest } from './structural-compiler.js';

export function generatePresentationPackageManifest(projectRootInput) {
  return computeStructuralManifest(projectRootInput);
}

export function writePresentationPackageManifest(projectRootInput) {
  return recordStructuralManifest(projectRootInput);
}

export function readPresentationPackageManifest(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  if (!existsSync(paths.packageManifestAbs)) {
    return null;
  }

  return JSON.parse(readFileSync(paths.packageManifestAbs, 'utf8'));
}

export function ensurePresentationPackageFiles(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  if (!existsSync(paths.intentAbs)) {
    writeInitialPresentationIntent(paths.projectRootAbs);
  }

  const manifest = recordStructuralManifest(paths.projectRootAbs);
  ensurePresentationRuntimeStateFiles(paths.projectRootAbs);
  return {
    paths,
    manifest,
  };
}
