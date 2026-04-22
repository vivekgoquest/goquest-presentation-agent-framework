import { AsyncLocalStorage } from 'node:async_hooks';
import { existsSync, readFileSync } from 'node:fs';
import { getProjectPaths } from './deck-paths.js';
import { ensurePresentationIntentFile } from './presentation-intent.js';
import { ensurePresentationRuntimeStateFiles } from './presentation-runtime-state.js';
import { computeStructuralManifest, recordStructuralManifest } from './structural-compiler.js';

const packageMutationBoundaryStorage = new AsyncLocalStorage();

export const PRESENTATION_PACKAGE_WRITE_ZONES = Object.freeze({
  AUTHORED_CONTENT: 'authored-content',
  GENERATED_STRUCTURE: 'generated-structure',
  RUNTIME_EVIDENCE: 'runtime-evidence',
});

function resolveAllowAuthoredContentWrites(options = {}) {
  if (typeof options.allowAuthoredContentWrites === 'boolean') {
    return options.allowAuthoredContentWrites;
  }

  return packageMutationBoundaryStorage.getStore()?.allowAuthoredContentWrites ?? true;
}

export function withPresentationPackageMutationBoundary(boundary, operation) {
  return packageMutationBoundaryStorage.run({
    allowAuthoredContentWrites: boundary?.allowAuthoredContentWrites !== false,
    protectedZone: boundary?.protectedZone || PRESENTATION_PACKAGE_WRITE_ZONES.AUTHORED_CONTENT,
    reason: String(boundary?.reason || ''),
  }, operation);
}

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

export function ensurePresentationPackageFiles(projectRootInput, options = {}) {
  const paths = getProjectPaths(projectRootInput);
  ensurePresentationIntentFile(paths.projectRootAbs, {
    allowCreate: resolveAllowAuthoredContentWrites(options),
  });

  const manifest = recordStructuralManifest(paths.projectRootAbs);
  const runtimeState = ensurePresentationRuntimeStateFiles(paths.projectRootAbs);
  return {
    paths,
    manifest,
    designState: runtimeState.designState,
  };
}
