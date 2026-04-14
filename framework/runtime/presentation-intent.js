import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getProjectPaths } from './deck-paths.js';

export const PRESENTATION_INTENT_OWNERSHIP = 'authored-content';

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

export function ensurePresentationIntentFile(projectRootInput, options = {}) {
  const paths = getProjectPaths(projectRootInput);
  if (existsSync(paths.intentAbs)) {
    return {
      intent: JSON.parse(readFileSync(paths.intentAbs, 'utf8')),
      exists: true,
      created: false,
      ownership: PRESENTATION_INTENT_OWNERSHIP,
    };
  }

  const intent = createInitialPresentationIntent(paths.projectRootAbs);
  if (options.allowCreate === false) {
    return {
      intent,
      exists: false,
      created: false,
      ownership: PRESENTATION_INTENT_OWNERSHIP,
    };
  }

  mkdirSync(dirname(paths.intentAbs), { recursive: true });
  writeFileSync(paths.intentAbs, `${JSON.stringify(intent, null, 2)}\n`);
  return {
    intent,
    exists: true,
    created: true,
    ownership: PRESENTATION_INTENT_OWNERSHIP,
  };
}

export function writeInitialPresentationIntent(projectRootInput) {
  return ensurePresentationIntentFile(projectRootInput, { allowCreate: true }).intent;
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

  const manifestSlides = Array.isArray(manifest?.slides) ? manifest.slides : [];
  const knownSlideIds = new Set(
    manifestSlides
      .map((slide) => slide?.id)
      .filter((slideId) => typeof slideId === 'string' && slideId.length > 0),
  );
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
