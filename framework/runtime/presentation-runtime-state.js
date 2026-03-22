import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { getProjectPaths } from './deck-paths.js';

function writeJson(absPath, payload) {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function readJson(absPath) {
  if (!existsSync(absPath)) {
    return null;
  }
  return JSON.parse(readFileSync(absPath, 'utf8'));
}

export function createInitialRenderState() {
  return {
    schemaVersion: 1,
    status: 'pending',
    slideIds: [],
    previewKind: 'slides',
    canvasContract: null,
    consoleErrorCount: 0,
    overflowSlides: [],
    qualityWarnings: [],
    failures: [],
    issues: [],
    lastCheckedAt: null,
  };
}

export function createInitialArtifacts() {
  return {
    schemaVersion: 1,
    outputDir: 'outputs',
    pdf: null,
    fullPage: null,
    report: null,
    summary: null,
    slides: [],
  };
}

export function createInitialLastGood() {
  return {
    schemaVersion: 1,
    status: 'pending',
    approvedAt: null,
    slideIds: [],
    artifacts: {
      pdf: null,
      slides: [],
    },
    gitCommit: '',
  };
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

export function ensurePresentationRuntimeStateFiles(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  if (!existsSync(paths.renderStateAbs)) {
    writeJson(paths.renderStateAbs, createInitialRenderState());
  }
  if (!existsSync(paths.artifactsAbs)) {
    writeJson(paths.artifactsAbs, createInitialArtifacts());
  }
  if (!existsSync(paths.lastGoodAbs)) {
    writeJson(paths.lastGoodAbs, createInitialLastGood());
  }

  return {
    renderState: readJson(paths.renderStateAbs),
    artifacts: readJson(paths.artifactsAbs),
    lastGood: readJson(paths.lastGoodAbs),
  };
}

export function readRenderState(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return readJson(paths.renderStateAbs);
}

export function readArtifacts(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return readJson(paths.artifactsAbs);
}

export function readLastGood(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return readJson(paths.lastGoodAbs);
}
