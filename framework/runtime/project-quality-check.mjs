import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkDeckQuality } from './deck-quality.js';
import { getProjectPaths } from './deck-paths.js';
import { listSlideSourceEntries } from './deck-source.js';

function readProjectMetadata(projectRoot) {
  const metadataPath = resolve(projectRoot, '.presentation', 'project.json');
  if (!existsSync(metadataPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(metadataPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function runProjectQualityCheck(projectRoot) {
  const metadata = readProjectMetadata(projectRoot);
  if (!metadata?.frameworkSource) {
    return {
      skipped: true,
      reason: 'Framework metadata is unavailable.',
      warnings: [],
    };
  }

  const slidesDir = resolve(projectRoot, 'slides');
  if (!existsSync(slidesDir)) {
    return {
      skipped: true,
      reason: 'Slides directory is missing.',
      warnings: [],
    };
  }

  const paths = getProjectPaths(projectRoot);
  const entries = listSlideSourceEntries(paths).filter((entry) => entry.isValidName);
  if (entries.length === 0) {
    return {
      skipped: true,
      reason: 'No valid slides exist yet.',
      warnings: [],
    };
  }

  const result = checkDeckQuality(entries);
  return {
    skipped: false,
    warnings: result.warnings,
  };
}
