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

function normalizePathRecord(value) {
  if (!value) {
    return null;
  }

  return typeof value === 'string' ? { path: value } : value;
}

function normalizeArtifactList(entries = []) {
  return entries.map((entry) => (typeof entry === 'string' ? { path: entry } : entry));
}

export function createInitialRenderState() {
  return {
    schemaVersion: 1,
    kind: 'render-state',
    sourceFingerprint: '',
    generatedAt: null,
    producer: '',
    status: 'pending',
    slideIds: [],
    previewKind: 'slides',
    canvasContract: null,
    consoleErrorCount: 0,
    overflowSlides: [],
    failures: [],
    issues: [],
    lastCheckedAt: null,
  };
}

export function createInitialArtifacts() {
  return {
    schemaVersion: 1,
    kind: 'artifacts',
    sourceFingerprint: '',
    generatedAt: null,
    finalized: {
      exists: false,
      outputDir: '',
      pdf: null,
      fullPage: null,
      report: null,
      summary: null,
      slides: [],
    },
    latestExport: {
      exists: false,
      format: '',
      outputDir: '',
      pdf: null,
      slides: [],
      artifacts: [],
    },

    // Backward-compatible aliases for consumers still reading the pre-split shape.
    outputDir: '',
    pdf: null,
    fullPage: null,
    report: null,
    summary: null,
    slides: [],
  };
}

function normalizeArtifacts(payload = {}) {
  const base = createInitialArtifacts();
  const hasLegacyFinalizedFields = Boolean(payload.report || payload.summary || payload.fullPage);
  const hasLegacyExportFields = typeof payload.format === 'string'
    || (Boolean(payload.outputDir) && !hasLegacyFinalizedFields);

  const finalizedInput = payload.finalized || (hasLegacyFinalizedFields
    ? {
      exists: true,
      outputDir: payload.outputDir || '',
      pdf: payload.pdf || null,
      fullPage: payload.fullPage || null,
      report: payload.report || null,
      summary: payload.summary || null,
      slides: payload.slides || [],
    }
    : {});

  const latestExportInput = payload.latestExport || (hasLegacyExportFields
    ? {
      exists: true,
      format: payload.format || '',
      outputDir: payload.outputDir || '',
      pdf: payload.pdf || null,
      slides: payload.slides || [],
      artifacts: payload.artifacts || [],
    }
    : {});

  const finalized = {
    ...base.finalized,
    ...finalizedInput,
    exists: Boolean(finalizedInput.exists),
    outputDir: finalizedInput.outputDir || '',
    pdf: normalizePathRecord(finalizedInput.pdf),
    fullPage: normalizePathRecord(finalizedInput.fullPage),
    report: normalizePathRecord(finalizedInput.report),
    summary: normalizePathRecord(finalizedInput.summary),
    slides: normalizeArtifactList(finalizedInput.slides || []),
  };

  const latestExport = {
    ...base.latestExport,
    ...latestExportInput,
    exists: Boolean(latestExportInput.exists),
    format: latestExportInput.format || '',
    outputDir: latestExportInput.outputDir || '',
    pdf: normalizePathRecord(latestExportInput.pdf),
    slides: normalizeArtifactList(latestExportInput.slides || []),
    artifacts: normalizeArtifactList(latestExportInput.artifacts || []),
  };

  const preferredAliasSource = finalized.exists ? finalized : latestExport;

  return {
    ...base,
    ...payload,
    kind: 'artifacts',
    sourceFingerprint: payload.sourceFingerprint || base.sourceFingerprint,
    generatedAt: payload.generatedAt || base.generatedAt,
    finalized,
    latestExport,
    outputDir: preferredAliasSource.outputDir || '',
    pdf: finalized.pdf || latestExport.pdf,
    fullPage: finalized.fullPage,
    report: finalized.report,
    summary: finalized.summary,
    slides: finalized.slides.length > 0 ? finalized.slides : latestExport.slides,
  };
}

export function writeRenderState(projectRootInput, payload = {}) {
  const paths = getProjectPaths(projectRootInput);
  const base = createInitialRenderState();
  const renderState = {
    ...base,
    ...payload,
    kind: 'render-state',
    sourceFingerprint: payload.sourceFingerprint || base.sourceFingerprint,
    generatedAt: payload.generatedAt || payload.lastCheckedAt || base.generatedAt,
    producer: payload.producer || base.producer,
  };
  writeJson(paths.renderStateAbs, renderState);
  return renderState;
}

export function writeArtifacts(projectRootInput, payload = {}) {
  const paths = getProjectPaths(projectRootInput);
  const artifacts = normalizeArtifacts(payload);
  writeJson(paths.artifactsAbs, artifacts);
  return artifacts;
}

export function ensurePresentationRuntimeStateFiles(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  if (!existsSync(paths.renderStateAbs)) {
    writeJson(paths.renderStateAbs, createInitialRenderState());
  }
  if (!existsSync(paths.artifactsAbs)) {
    writeJson(paths.artifactsAbs, createInitialArtifacts());
  }

  return {
    renderState: readJson(paths.renderStateAbs),
    artifacts: readJson(paths.artifactsAbs),
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
