const READY_STATUSES = new Set(['ready_to_finalize', 'finalized']);

function formatStatusLabel(status = '') {
  if (!status) return 'Unknown';
  return status.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function getStatusTone(status = '') {
  switch (status) {
    case 'finalized':
    case 'ready_to_finalize':
      return 'success';
    case 'policy_error':
      return 'error';
    case 'onboarding':
      return 'warning';
    case 'in_progress':
      return 'info';
    default:
      return 'neutral';
  }
}

function buildProjectMetrics(projectState = {}) {
  const slidesTotal = Number(projectState.slidesTotal || 0);
  const slidesComplete = Number(projectState.slidesComplete || 0);

  return [
    {
      label: 'Slides',
      value: slidesTotal > 0 ? `${slidesComplete}/${slidesTotal}` : '0/0',
    },
    {
      label: 'Brief',
      value: projectState.briefComplete ? 'Ready' : 'Needs work',
    },
    projectState.outlineRequired
      ? {
          label: 'Outline',
          value: projectState.outlineComplete ? 'Ready' : 'Needs work',
        }
      : null,
    {
      label: 'PDF',
      value: projectState.pdfReady ? 'Ready' : 'Not generated',
    },
  ].filter(Boolean);
}

export function deriveActionUiModel({
  meta = null,
  projectState = null,
  agentActionAvailability = null,
} = {}) {
  const hasProject = Boolean(meta?.active);
  const status = projectState?.status || '';
  const isReady = READY_STATUSES.has(status);
  const agentActionReason = agentActionAvailability?.reasonUnavailable || 'This action is unavailable right now.';

  if (!hasProject) {
    return {
      primary: null,
      secondary: null,
      menu: [],
    };
  }

  return {
    primary: {
      id: 'export_presentation',
      label: 'Export presentation',
      enabled: isReady,
      reasonDisabled: isReady
        ? ''
        : 'Presentation is still in progress. Complete the brief, slides, and policy fixes before exporting.',
    },
    secondary: {
      id: 'validate_presentation',
      label: 'Validate presentation',
      enabled: true,
      reasonDisabled: '',
    },
    menu: [
      {
        id: 'capture_screenshots',
        label: 'Capture screenshots',
        enabled: true,
        reasonDisabled: '',
      },
      {
        id: 'fix_validation_issues',
        label: 'Fix validation issues',
        enabled: Boolean(agentActionAvailability?.fixValidationIssues),
        reasonDisabled: agentActionAvailability?.fixValidationIssues ? '' : agentActionReason,
      },
      {
        id: 'review_narrative_presentation',
        label: 'Review narrative',
        enabled: Boolean(agentActionAvailability?.reviewNarrative),
        reasonDisabled: agentActionAvailability?.reviewNarrative ? '' : agentActionReason,
      },
      {
        id: 'apply_narrative_review_changes',
        label: 'Apply narrative fixes',
        enabled: Boolean(agentActionAvailability?.applyNarrativeChanges),
        reasonDisabled: agentActionAvailability?.applyNarrativeChanges ? '' : agentActionReason,
      },
      {
        id: 'review_visual_presentation',
        label: 'Review visuals',
        enabled: Boolean(agentActionAvailability?.reviewVisual),
        reasonDisabled: agentActionAvailability?.reviewVisual ? '' : agentActionReason,
      },
      {
        id: 'apply_visual_review_changes',
        label: 'Apply visual fixes',
        enabled: Boolean(agentActionAvailability?.applyVisualChanges),
        reasonDisabled: agentActionAvailability?.applyVisualChanges ? '' : agentActionReason,
      },
    ],
  };
}

export function deriveProjectUiModel({ meta = null, projectState = null } = {}) {
  const hasProject = Boolean(meta?.active);
  const status = projectState?.status || (hasProject ? 'unknown' : 'no_project');
  const isReady = READY_STATUSES.has(status);
  const blocker = String(projectState?.lastPolicyError || '').trim();

  return {
    hasProject,
    status: {
      visible: false,
      tone: getStatusTone(status),
      label: formatStatusLabel(status),
      nextStep: String(projectState?.nextStep || '').trim(),
      blocker,
      metrics: hasProject ? buildProjectMetrics(projectState || {}) : [],
    },
    preview: {
      showChrome: false,
      showSlideCounter: false,
    },
    actions: {
      validate: {
        enabled: hasProject,
        primary: false,
      },
      export: {
        enabled: hasProject && isReady,
        primary: true,
      },
      capture: {
        enabled: hasProject,
      },
      more: {
        enabled: hasProject,
      },
    },
  };
}

export function deriveTerminalUiModel({ meta = null, startError = '' } = {}) {
  const errorText = String(startError || '').trim();
  if (errorText) {
    return {
      state: 'failed',
      label: 'Assistant could not start',
      detail: errorText,
      showTerminal: false,
      showRetry: true,
      showStop: false,
      showClear: false,
    };
  }

  const state = meta?.alive
    ? (meta?.state === 'starting' ? 'starting' : 'running')
    : (meta?.state || 'idle');

  switch (state) {
    case 'starting':
      return {
        state,
        label: 'Starting assistant',
        detail: 'Preparing the workspace…',
        showTerminal: false,
        showRetry: false,
        showStop: false,
        showClear: false,
      };
    case 'running':
      return {
        state,
        label: 'Ready',
        detail: meta?.projectRoot ? 'Connected to this presentation.' : 'The workspace is ready.',
        showTerminal: true,
        showRetry: false,
        showStop: true,
        showClear: true,
      };
    case 'stopped':
      return {
        state,
        label: 'Assistant stopped',
        detail: 'Start it again to keep working on this presentation.',
        showTerminal: false,
        showRetry: true,
        showStop: false,
        showClear: true,
      };
    default:
      return {
        state: 'idle',
        label: 'Open a presentation',
        detail: 'Create a new presentation or open an existing one to get started.',
        showTerminal: false,
        showRetry: true,
        showStop: false,
        showClear: false,
      };
  }
}

export function normalizeRuntimeActionResult(actionLabel, result = {}) {
  const label = actionLabel || 'Action';
  const issues = Array.isArray(result?.issues) ? result.issues.filter(Boolean) : [];
  const warnings = Array.isArray(result?.qualityWarnings) ? result.qualityWarnings.filter(Boolean) : [];

  if (!result || typeof result !== 'object' || !result.status) {
    return {
      tone: 'success',
      message: `${label} completed.`,
      detail: '',
    };
  }

  if (result.status === 'pass') {
    return {
      tone: 'success',
      message: `${label} completed.`,
      detail: result.detail || issues[0] || warnings[0] || '',
    };
  }

  if (result.status === 'needs-review') {
    return {
      tone: 'warning',
      message: `${label} completed but needs review.`,
      detail: result.detail || issues[0] || warnings[0] || 'Review the generated outputs before treating them as final.',
    };
  }

  if (result.status === 'fail') {
    return {
      tone: 'error',
      message: `${label} failed.`,
      detail: result.detail || issues[0] || 'Review diagnostics for details.',
    };
  }

  if (result.status === 'started') {
    return {
      tone: 'success',
      message: result.message || `${label} started.`,
      detail: result.detail || '',
    };
  }

  if (result.status === 'blocked') {
    return {
      tone: 'error',
      message: result.message || `${label} is blocked.`,
      detail: result.detail || issues[0] || 'Resolve the blocking issue before retrying.',
    };
  }

  return {
    tone: 'success',
    message: `${label} completed.`,
    detail: '',
  };
}

export function formatWatchMessage(file) {
  const raw = String(file || '').trim().replace(/\\/g, '/');
  if (!raw) {
    return '';
  }

  const normalized = raw.replace(/^framework-host\//, '');
  if (normalized === 'brief.md') return 'Updated brief.md';
  if (normalized === 'outline.md') return 'Updated outline.md';
  if (normalized === 'theme.css') return 'Updated theme.css';
  if (normalized.startsWith('slides/')) return `Updated ${normalized}`;
  if (normalized.startsWith('outputs/')) return 'Generated outputs changed';
  if (normalized.startsWith('.presentation/')) return 'Project metadata changed';
  return `Updated ${normalized}`;
}
