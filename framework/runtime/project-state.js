import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  LONG_DECK_OUTLINE_THRESHOLD,
  createPresentationTarget,
  getProjectPaths,
} from './deck-paths.js';
import { ensurePresentationPackageFiles } from './presentation-package.js';
import { readArtifacts, readDesignState, readRenderState } from './presentation-runtime-state.js';
import { derivePackageStatus, toLegacyProjectStatus } from './status-service.js';
import { validateSlideDeckWorkspace } from './deck-policy.js';
import { listSlideSourceEntries } from './deck-source.js';
import { computeSourceFingerprint } from './source-fingerprint.js';

const TODO_MARKER_RE = /\[\[TODO_[A-Z0-9_]+\]\]/;

function readIfExists(absPath) {
  if (!existsSync(absPath)) {
    return '';
  }

  return readFileSync(absPath, 'utf-8');
}

function hasTodoMarkers(content) {
  return TODO_MARKER_RE.test(content || '');
}

function getValidationError(paths) {
  try {
    validateSlideDeckWorkspace(paths);
    return '';
  } catch (err) {
    return err?.message || 'Deck policy violation.';
  }
}

function resolveEvidenceFacet(renderState, currentSourceFingerprint) {
  if (!renderState) {
    return 'missing';
  }

  const renderStatus = String(renderState?.status || '').trim().toLowerCase();
  if (!renderStatus || renderStatus === 'pending') {
    return 'missing';
  }

  if (renderStatus !== 'pass') {
    return 'stale';
  }

  const renderFingerprint = String(renderState?.sourceFingerprint || '').trim();
  if (!renderFingerprint || !currentSourceFingerprint) {
    return 'stale';
  }

  return renderFingerprint === currentSourceFingerprint ? 'current' : 'stale';
}

function resolveDesignStateFacet(designState, currentSourceFingerprint) {
  if (!designState) {
    return 'missing';
  }

  const designStateFingerprint = String(designState?.sourceFingerprint || '').trim();
  if (!designStateFingerprint || !currentSourceFingerprint) {
    return 'stale';
  }

  return designStateFingerprint === currentSourceFingerprint ? 'current' : 'stale';
}

function resolveDeliveryFacet({
  finalizedOutputsReady,
  blockerCount,
  currentSourceFingerprint,
  artifacts,
}) {
  if (blockerCount > 0) {
    return 'finalize_blocked';
  }

  if (!finalizedOutputsReady) {
    return 'not_finalized';
  }

  const finalizedFingerprint = artifacts?.finalized?.exists ? String(artifacts?.sourceFingerprint || '').trim() : '';
  if (!finalizedFingerprint || !currentSourceFingerprint || finalizedFingerprint !== currentSourceFingerprint) {
    return 'finalized_stale';
  }

  return 'finalized_current';
}

function hasRecordedFinalizedPdf(projectRootAbs, artifacts) {
  const finalizedPdfRel = String(artifacts?.finalized?.pdf?.path || '').trim();
  return Boolean(
    artifacts?.finalized?.exists
    && finalizedPdfRel
    && existsSync(resolve(projectRootAbs, finalizedPdfRel))
  );
}

function buildAuthoringNextStep({ briefComplete, outlineRequired, outlineComplete, remainingSlides }) {
  const pendingSteps = [];

  if (!briefComplete) {
    pendingSteps.push('complete brief.md with the normalized user request');
  }

  if (outlineRequired && !outlineComplete) {
    pendingSteps.push('complete outline.md with the long-deck story arc');
  }

  if (remainingSlides.length > 0) {
    pendingSteps.push(`finish the remaining slide sources: ${remainingSlides.map((slide) => slide.slideDir).join(', ')}`);
  }

  if (pendingSteps.length === 0) {
    return '';
  }

  if (pendingSteps.length === 1) {
    const [singleStep] = pendingSteps;
    return `${singleStep[0].toUpperCase()}${singleStep.slice(1)}.`;
  }

  return `Complete the remaining authoring inputs before exporting: ${pendingSteps.join('; ')}.`;
}

export function classifyPolicyErrorMessage(message = '') {
  const text = String(message || '');
  if (!text.includes('Deck policy violation')) {
    return 'authoring_violation';
  }

  if (/brief\.md/i.test(text) && /(TODO markers|Fill in brief\.md|normalized user request)/i.test(text)) {
    return 'incomplete_brief';
  }

  if (/outline\.md/i.test(text) && /(TODO markers|Fill in outline\.md|long-deck story arc)/i.test(text)) {
    return 'incomplete_outline';
  }

  if (/slide\.html/i.test(text) && /(TODO markers|\[\[TODO_)/i.test(text)) {
    return 'incomplete_slide';
  }

  return 'authoring_violation';
}

export function getProjectState(projectRootInput) {
  const target = createPresentationTarget({
    projectRoot: projectRootInput?.projectRootAbs || projectRootInput?.projectRoot || projectRootInput,
  });
  const paths = getProjectPaths(target.projectRootAbs);
  const { manifest } = ensurePresentationPackageFiles(paths.projectRootAbs);
  const renderState = readRenderState(paths.projectRootAbs);
  const designState = readDesignState(paths.projectRootAbs);
  const artifacts = readArtifacts(paths.projectRootAbs);
  const slideEntries = listSlideSourceEntries(paths).filter((entry) => entry.isValidName);

  const briefContent = readIfExists(paths.briefAbs);
  const briefComplete = Boolean(briefContent.trim()) && !hasTodoMarkers(briefContent);

  const outlineRequired = slideEntries.length > LONG_DECK_OUTLINE_THRESHOLD;
  const outlineContent = readIfExists(paths.outlineAbs);
  const outlineComplete = !outlineRequired
    || (Boolean(outlineContent.trim()) && !hasTodoMarkers(outlineContent));

  const remainingSlides = [];
  const completedSlides = [];
  for (const entry of slideEntries) {
    const html = readIfExists(entry.slideHtmlAbs);
    if (!html.trim() || hasTodoMarkers(html)) {
      remainingSlides.push({
        slideId: entry.slideId,
        relativePath: entry.slideHtmlRel,
        slideDir: entry.slideDirRel,
      });
    } else {
      completedSlides.push({
        slideId: entry.slideId,
        relativePath: entry.slideHtmlRel,
        slideDir: entry.slideDirRel,
      });
    }
  }

  const currentSourceFingerprint = computeSourceFingerprint(paths.projectRootAbs);
  const recordedFinalizedPdfReady = hasRecordedFinalizedPdf(paths.projectRootAbs, artifacts);
  const reportPath = String(artifacts?.report?.path || '').trim();
  const summaryPath = String(artifacts?.summary?.path || '').trim();
  const pdfReady = recordedFinalizedPdfReady || existsSync(paths.rootPdfAbs);
  const reportReady = Boolean(reportPath && existsSync(resolve(paths.projectRootAbs, reportPath)));
  const summaryReady = Boolean(summaryPath && existsSync(resolve(paths.projectRootAbs, summaryPath)));
  const finalizedOutputsReady = recordedFinalizedPdfReady;
  const validationError = getValidationError(paths);
  const policyCategory = validationError ? classifyPolicyErrorMessage(validationError) : null;
  const sourceComplete = briefComplete
    && outlineComplete
    && remainingSlides.length === 0
    && policyCategory !== 'incomplete_slide';
  const blockerCount = policyCategory === 'authoring_violation' ? 1 : 0;
  const delivery = resolveDeliveryFacet({
    finalizedOutputsReady,
    blockerCount,
    currentSourceFingerprint,
    artifacts,
  });
  const evidence = resolveEvidenceFacet(renderState, currentSourceFingerprint);
  const designStateEvidence = resolveDesignStateFacet(designState, currentSourceFingerprint);
  const packageStatus = derivePackageStatus({
    sourceComplete,
    blockerCount,
    delivery,
    evidence,
    designStateEvidence,
    blockers: validationError ? [validationError] : [],
    canonicalPdfPath: paths.rootPdfRel,
    briefComplete,
    outlineRequired,
    outlineComplete,
    remainingSlideCount: remainingSlides.length,
  });
  const workflow = packageStatus.workflow;
  const status = toLegacyProjectStatus(packageStatus);

  let nextStep = 'Run presentation export to generate the canonical root PDF.';
  const authoringNextStep = buildAuthoringNextStep({
    briefComplete,
    outlineRequired,
    outlineComplete,
    remainingSlides,
  });
  if (authoringNextStep) {
    nextStep = authoringNextStep;
  } else if (workflow === 'blocked') {
    nextStep = 'Run presentation audit all and fix the current policy violation before preview or export.';
  } else if (packageStatus.facets.delivery === 'finalized_stale') {
    nextStep = 'Run presentation export again to refresh the canonical root PDF for the latest source.';
  } else if (packageStatus.facets.evidence !== 'current') {
    nextStep = renderState?.status === 'fail'
      ? 'Fix the current render or validation issues, then rerun presentation audit all.'
      : 'Run presentation audit all before export so the runtime evidence is current.';
  }

  return {
    kind: 'project',
    projectRoot: paths.projectRootAbs,
    title: paths.title,
    slug: paths.slug,
    workflow,
    status,
    facets: packageStatus.facets,
    statusSummary: packageStatus.summary,
    nextBoundary: packageStatus.nextBoundary,
    nextFocus: packageStatus.nextFocus,
    briefComplete,
    outlineRequired,
    outlineComplete,
    slidesTotal: manifest?.counts?.slidesTotal ?? slideEntries.length,
    slidesComplete: completedSlides.length,
    remainingSlides,
    pdfReady,
    reportReady,
    summaryReady,
    packageStateAvailable: Boolean(manifest),
    runtimeEvidenceAvailable: Boolean(renderState),
    designStateAvailable: Boolean(designState),
    lastRenderStatus: renderState?.status || 'unknown',
    lastCheckedAt: renderState?.lastCheckedAt || renderState?.generatedAt || '',
    lastDesignStateGeneratedAt: designState?.generatedAt || '',
    lastPolicyError: validationError || '',
    policyCategory,
    nextStep,
  };
}
