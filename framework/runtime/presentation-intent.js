import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getProjectPaths } from './deck-paths.js';

export function createInitialPresentationIntent(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return {
    schemaVersion: 1,
    presentationTitle: paths.title,
    audience: '',
    objective: '',
    tone: '',
    targetSlideCount: 0,
    narrativeNotes: '',
    slideIntent: {},
  };
}

export function readPresentationIntent(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  if (!existsSync(paths.intentAbs)) {
    return createInitialPresentationIntent(projectRootInput);
  }

  return JSON.parse(readFileSync(paths.intentAbs, 'utf8'));
}

export function writeInitialPresentationIntent(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  const intent = createInitialPresentationIntent(projectRootInput);
  mkdirSync(dirname(paths.intentAbs), { recursive: true });
  writeFileSync(paths.intentAbs, `${JSON.stringify(intent, null, 2)}\n`);
  return intent;
}

export function validatePresentationIntent(intent, manifest) {
  const issues = [];
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
    return ['Presentation intent must be a JSON object.'];
  }

  const slideIntent = intent.slideIntent ?? {};
  if (!slideIntent || typeof slideIntent !== 'object' || Array.isArray(slideIntent)) {
    return ['Presentation intent "slideIntent" must be an object keyed by slide id.'];
  }

  const knownSlideIds = new Set((manifest?.slides || []).map((slide) => slide.id));
  for (const slideId of Object.keys(slideIntent)) {
    if (!knownSlideIds.has(slideId)) {
      issues.push(`Presentation intent references unknown slide id "${slideId}".`);
    }
  }

  return issues;
}

export function validatePresentationIntentFile(projectRootInput, manifest) {
  const intent = readPresentationIntent(projectRootInput);
  return {
    intent,
    issues: validatePresentationIntent(intent, manifest),
  };
}
