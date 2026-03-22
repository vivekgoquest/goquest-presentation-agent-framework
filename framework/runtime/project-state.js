import { existsSync, readFileSync } from 'fs';
import {
  LONG_DECK_OUTLINE_THRESHOLD,
  createPresentationTarget,
  getPresentationOutputPaths,
  getProjectPaths,
} from './deck-paths.js';
import { ensurePresentationPackageFiles } from './presentation-package.js';
import { readRenderState } from './presentation-runtime-state.js';
import { validateSlideDeckWorkspace } from './deck-policy.js';
import { listSlideSourceEntries } from './deck-source.js';
import { checkDeckQuality } from './deck-quality.js';

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

  const pdfReady = existsSync(outputs.pdfAbs);
  const reportReady = existsSync(outputs.reportAbs);
  const summaryReady = existsSync(outputs.summaryAbs);
  const validationError = getValidationError(paths);
  const quality = checkDeckQuality(slideEntries);
  const policyCategory = validationError ? classifyPolicyErrorMessage(validationError) : null;

  let status = 'ready_to_finalize';
  if (!briefComplete || !outlineComplete) {
    status = 'onboarding';
  } else if (remainingSlides.length > 0 || policyCategory === 'incomplete_slide') {
    status = 'in_progress';
  } else if (policyCategory === 'authoring_violation') {
    status = 'policy_error';
  } else if (pdfReady && reportReady && summaryReady) {
    status = 'finalized';
  }

  let nextStep = 'Run finalize to generate the deck outputs.';
  if (!briefComplete) {
    nextStep = 'Complete brief.md with the normalized user request.';
  } else if (!outlineComplete) {
    nextStep = 'Complete outline.md before continuing the long-deck build.';
  } else if (remainingSlides.length > 0) {
    nextStep = `Finish the remaining slide sources: ${remainingSlides.map((slide) => slide.slideDir).join(', ')}.`;
  } else if (policyCategory === 'authoring_violation') {
    nextStep = 'Fix the current policy violation before preview, export, or finalize.';
  }

  return {
    kind: 'project',
    projectRoot: paths.projectRootAbs,
    title: paths.title,
    slug: paths.slug,
    status,
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
    lastCheckedAt: renderState?.lastCheckedAt || '',
    lastPolicyError: validationError || '',
    policyCategory,
    qualityWarningCount: quality.warnings.length,
    nextStep,
  };
}
