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

function deriveOutputDir(pathRecord) {
  const artifactPath = String(pathRecord?.path || '').trim();
  if (!artifactPath || !artifactPath.includes('/')) {
    return '';
  }

  return artifactPath.split('/').slice(0, -1).join('/');
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

export function createInitialDesignState() {
  return {
    schemaVersion: 1,
    kind: 'presentation-design-state',
    sourceFingerprint: '',
    generatedAt: null,
    project: null,
    authority: {
      canvas: 'framework/canvas/canvas-contract.mjs',
      theme: 'theme.css',
      intent: '.presentation/intent.json',
      structure: '.presentation/package.generated.json',
      runtime: '.presentation/runtime/',
    },
    canvas: {
      status: 'fixed',
      stage: null,
      structuralTokens: [],
      protectedSelectors: [],
      allowedThemeVariables: [],
    },
    theme: {
      status: 'working',
      source: 'theme.css',
      fingerprint: '',
      observedTokens: [],
      observedPrimitives: [],
      canvasVariablesUsed: [],
      assetReferences: [],
    },
    narrative: {
      status: 'working',
      sources: ['.presentation/intent.json', 'outline.md', 'slides/'],
      slideCount: 0,
      slidePurposes: [],
    },
    content: {
      status: 'working',
      slideRoots: [],
      slideCssFiles: [],
      assetReferences: [],
    },
    audit: {
      lastKnownStatus: 'unknown',
      families: {},
    },
    driftRules: {
      changeIsAllowed: true,
      untrackedLayerBypassIsNotAllowed: true,
    },
    fingerprints: {},
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
      pdf: null,
    },
    latestExport: {
      exists: false,
      format: 'pdf',
      pdf: null,
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
  const hasTopLevelPdf = Boolean(payload.pdf);
  const hasLegacyFinalizedFields = Boolean(
    payload.report
    || payload.summary
    || payload.fullPage
    || (hasTopLevelPdf && !payload.format)
  );
  const hasLegacyExportFields = Boolean(
    typeof payload.format === 'string'
    || (hasTopLevelPdf && !hasLegacyFinalizedFields)
  );

  const finalizedInput = payload.finalized || (hasLegacyFinalizedFields
    ? {
      exists: payload.exists ?? Boolean(payload.pdf || payload.report || payload.summary || payload.fullPage),
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
      exists: payload.exists ?? Boolean(payload.pdf),
      format: payload.format || 'pdf',
      outputDir: payload.outputDir || '',
      pdf: payload.pdf || null,
      slides: payload.slides || [],
      artifacts: payload.artifacts || [],
    }
    : {});

  const finalizedPdf = normalizePathRecord(finalizedInput.pdf);
  const latestExportPdf = normalizePathRecord(latestExportInput.pdf);
  const latestExportArtifacts = normalizeArtifactList(
    latestExportInput.artifacts || (latestExportPdf ? [latestExportPdf] : [])
  );

  const finalized = {
    ...base.finalized,
    exists: Boolean(finalizedInput.exists && finalizedPdf),
    pdf: finalizedPdf,
  };

  const latestExport = {
    ...base.latestExport,
    exists: Boolean(latestExportInput.exists && latestExportPdf),
    format: 'pdf',
    pdf: latestExportPdf,
    artifacts: latestExportArtifacts,
  };

  const aliasPdf = finalized.pdf || latestExport.pdf;
  const aliasOutputDir = String(
    payload.outputDir
    || finalizedInput.outputDir
    || latestExportInput.outputDir
    || deriveOutputDir(aliasPdf)
  ).trim();

  return {
    ...base,
    ...payload,
    kind: 'artifacts',
    sourceFingerprint: payload.sourceFingerprint || base.sourceFingerprint,
    generatedAt: payload.generatedAt || base.generatedAt,
    finalized,
    latestExport,
    outputDir: aliasOutputDir === '.' ? '' : aliasOutputDir,
    pdf: aliasPdf,
    fullPage: normalizePathRecord(payload.fullPage || finalizedInput.fullPage),
    report: normalizePathRecord(payload.report || finalizedInput.report),
    summary: normalizePathRecord(payload.summary || finalizedInput.summary),
    slides: normalizeArtifactList(payload.slides || finalizedInput.slides || latestExportInput.slides || []),
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

export function writeDesignState(projectRootInput, payload = {}) {
  const paths = getProjectPaths(projectRootInput);
  const base = createInitialDesignState();
  const designState = {
    ...base,
    ...payload,
    kind: 'presentation-design-state',
    schemaVersion: 1,
    sourceFingerprint: payload.sourceFingerprint || base.sourceFingerprint,
    generatedAt: payload.generatedAt || new Date().toISOString(),
  };
  writeJson(paths.designStateAbs, designState);
  return designState;
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
  if (!existsSync(paths.designStateAbs)) {
    writeJson(paths.designStateAbs, createInitialDesignState());
  }
  if (!existsSync(paths.artifactsAbs)) {
    writeJson(paths.artifactsAbs, createInitialArtifacts());
  }

  return {
    renderState: readJson(paths.renderStateAbs),
    artifacts: normalizeArtifacts(readJson(paths.artifactsAbs) || {}),
    designState: readJson(paths.designStateAbs),
  };
}

export function readRenderState(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return readJson(paths.renderStateAbs);
}

export function readDesignState(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return readJson(paths.designStateAbs);
}

export function readArtifacts(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  const artifacts = readJson(paths.artifactsAbs);
  return artifacts ? normalizeArtifacts(artifacts) : null;
}
