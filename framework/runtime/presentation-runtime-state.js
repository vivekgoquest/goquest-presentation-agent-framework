import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getProjectPaths } from './deck-paths.js';

function writeJson(absPath, payload) {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, `${JSON.stringify(payload, null, 2)}\n`);
}

export function writeRenderState(projectRootInput, payload = {}) {
  const paths = getProjectPaths(projectRootInput);
  const renderState = {
    schemaVersion: 1,
    ...payload,
  };
  writeJson(paths.renderStateAbs, renderState);
  return renderState;
}

export function writeArtifacts(projectRootInput, payload = {}) {
  const paths = getProjectPaths(projectRootInput);
  const artifacts = {
    schemaVersion: 1,
    ...payload,
  };

  if (typeof artifacts.pdf === 'string') {
    artifacts.pdf = { path: artifacts.pdf };
  }
  if (Array.isArray(artifacts.slides)) {
    artifacts.slides = artifacts.slides.map((slide) => (
      typeof slide === 'string' ? { path: slide } : slide
    ));
  }

  writeJson(paths.artifactsAbs, artifacts);
  return artifacts;
}

export function writeLastGood(projectRootInput, payload = {}) {
  const paths = getProjectPaths(projectRootInput);
  const lastGood = {
    schemaVersion: 1,
    ...payload,
  };
  writeJson(paths.lastGoodAbs, lastGood);
  return lastGood;
}
