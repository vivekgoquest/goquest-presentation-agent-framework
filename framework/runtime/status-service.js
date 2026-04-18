const WORKFLOW_STATES = new Set([
  'onboarding',
  'authoring',
  'blocked',
  'ready_for_finalize',
  'finalized',
]);

const DELIVERY_FACETS = new Set([
  'not_finalized',
  'finalized_current',
  'finalized_stale',
  'finalize_blocked',
]);

const EVIDENCE_FACETS = new Set([
  'current',
  'stale',
  'missing',
  'unsupported',
  'unknown',
]);

function normalizeBlockers(blockers) {
  return Array.isArray(blockers)
    ? blockers.map((blocker) => String(blocker || '').trim()).filter(Boolean)
    : [];
}

function normalizeDeliveryFacet(delivery, blockerCount) {
  if (DELIVERY_FACETS.has(delivery)) {
    return delivery;
  }

  return blockerCount > 0 ? 'finalize_blocked' : 'not_finalized';
}

function normalizeEvidenceFacet(evidence) {
  if (EVIDENCE_FACETS.has(evidence)) {
    return evidence;
  }

  return 'unknown';
}

function buildSummary(workflow, facets) {
  switch (workflow) {
    case 'onboarding':
      return 'Author the required source files before the package can enter the normal workflow.';
    case 'blocked':
      return 'A hard blocker is preventing reliable forward progress toward finalize.';
    case 'finalized':
      return 'Canonical finalized outputs are present and aligned with the latest known source evidence.';
    case 'ready_for_finalize':
      return 'Source is complete, no hard blockers are active, and current evidence says the package is ready to finalize.';
    case 'authoring':
    default:
      if (facets.delivery === 'finalized_stale') {
        return 'Authoring is still active because the latest source has moved beyond the finalized outputs.';
      }
      if (facets.evidence !== 'current') {
        return 'Authoring is still active because runtime evidence is not current enough to trust the finalize boundary.';
      }
      return 'Authoring is still in progress.';
  }
}

function buildNextBoundary(workflow) {
  if (workflow === 'finalized') {
    return 'maintain';
  }

  return 'finalize';
}

function getCanonicalPdfFocus(facts = {}) {
  const canonicalPdfPath = String(facts.canonicalPdfPath || '').trim();
  return canonicalPdfPath ? [canonicalPdfPath] : [];
}

function buildNextFocus(workflow, facets, facts = {}) {
  const canonicalPdfFocus = getCanonicalPdfFocus(facts);

  switch (workflow) {
    case 'onboarding':
      return ['brief.md', 'outline.md', 'slides/'];
    case 'blocked':
      return ['presentation audit all'];
    case 'ready_for_finalize':
      return ['presentation finalize'];
    case 'finalized':
      return canonicalPdfFocus.length > 0 ? canonicalPdfFocus : ['presentation finalize'];
    case 'authoring':
    default:
      if (facets.delivery === 'finalized_stale') {
        return canonicalPdfFocus.length > 0
          ? ['presentation finalize', ...canonicalPdfFocus]
          : ['presentation finalize'];
      }
      if (facets.evidence !== 'current') {
        return ['presentation audit all'];
      }
      return ['slides/'];
  }
}

export function derivePackageStatus(facts = {}) {
  const sourceComplete = Boolean(facts.sourceComplete);
  const blockerCount = Math.max(0, Number(facts.blockerCount || 0));
  const blockers = normalizeBlockers(facts.blockers);
  const facets = {
    delivery: normalizeDeliveryFacet(facts.delivery, blockerCount),
    evidence: normalizeEvidenceFacet(facts.evidence),
  };

  let workflow = 'authoring';
  if (!sourceComplete) {
    workflow = 'onboarding';
  } else if (blockerCount > 0 || facets.delivery === 'finalize_blocked') {
    workflow = 'blocked';
  } else if (facets.delivery === 'finalized_current') {
    workflow = 'finalized';
  } else if (facets.evidence === 'current' && facets.delivery !== 'finalized_stale') {
    workflow = 'ready_for_finalize';
  }

  return {
    workflow,
    summary: buildSummary(workflow, facets),
    blockers,
    facets,
    nextBoundary: buildNextBoundary(workflow),
    nextFocus: buildNextFocus(workflow, facets, facts),
  };
}

export function toLegacyProjectStatus(statusInput) {
  const workflow = typeof statusInput === 'string' ? statusInput : statusInput?.workflow;
  const normalized = WORKFLOW_STATES.has(workflow) ? workflow : 'authoring';

  switch (normalized) {
    case 'onboarding':
      return 'onboarding';
    case 'blocked':
      return 'policy_error';
    case 'ready_for_finalize':
      return 'ready_to_finalize';
    case 'finalized':
      return 'finalized';
    case 'authoring':
    default:
      return 'in_progress';
  }
}
