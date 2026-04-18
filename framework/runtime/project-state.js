import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  LONG_DECK_OUTLINE_THRESHOLD,
  createPresentationTarget,
  getPresentationOutputPaths,
  getProjectPaths,
} from './deck-paths.js';
import { ensurePresentationPackageFiles } from './presentation-package.js';
import { readArtifacts, readRenderState } from './presentation-runtime-state.js';
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
  const artifacts = readArtifacts(paths.projectRootAbs);
  const outputs = getPresentationOutputPaths(target);
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
  const pdfReady = recordedFinalizedPdfReady || existsSync(outputs.pdfAbs);
  const reportReady = existsSync(outputs.reportAbs);
  const summaryReady = existsSync(outputs.summaryAbs);
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
  const packageStatus = derivePackageStatus({
    sourceComplete,
    blockerCount,
    delivery,
    evidence,
    blockers: validationError ? [validationError] : [],
  });
  const workflow = packageStatus.workflow;
  const status = toLegacyProjectStatus(packageStatus);

  let nextStep = 'Run finalize to generate the deck outputs.';
  if (!briefComplete) {
    nextStep = 'Complete brief.md with the normalized user request.';
  } else if (!outlineComplete) {
    nextStep = 'Complete outline.md before continuing the long-deck build.';
  } else if (remainingSlides.length > 0) {
    nextStep = `Finish the remaining slide sources: ${remainingSlides.map((slide) => slide.slideDir).join(', ')}.`;
  } else if (workflow === 'blocked') {
    nextStep = 'Fix the current policy violation before preview, export, or finalize.';
  } else if (packageStatus.facets.delivery === 'finalized_stale') {
    nextStep = 'Run finalize again to refresh the canonical outputs for the latest source.';
  } else if (packageStatus.facets.evidence !== 'current') {
    nextStep = renderState?.status === 'fail'
      ? 'Fix the current render or validation issues before finalize.'
      : 'Run presentation audit all before finalize so the runtime evidence is current.';
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
    lastRenderStatus: renderState?.status || 'unknown',
    lastCheckedAt: renderState?.lastCheckedAt || renderState?.generatedAt || '',
    lastPolicyError: validationError || '',
    policyCategory,
    nextStep,
  };
}
