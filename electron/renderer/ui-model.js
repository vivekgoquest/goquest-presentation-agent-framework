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

export function deriveActionUiModel(actions = []) {
  const descriptors = Array.isArray(actions) ? actions : [];

  return {
    primary: descriptors.find((action) => action.surface === 'primary') || null,
    secondary: descriptors.find((action) => action.surface === 'secondary') || null,
    menu: descriptors.filter((action) => action.surface === 'menu'),
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
      check: {
        enabled: hasProject,
        primary: false,
      },
      build: {
        enabled: hasProject && isReady,
        primary: false,
      },
      export: {
        enabled: hasProject && isReady,
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
      detail: issues[0] || warnings[0] || '',
    };
  }

  if (result.status === 'needs-review') {
    return {
      tone: 'warning',
      message: `${label} completed but needs review.`,
      detail: issues[0] || warnings[0] || 'Review the generated outputs before treating them as final.',
    };
  }

  if (result.status === 'fail') {
    return {
      tone: 'error',
      message: `${label} failed.`,
      detail: issues[0] || 'Review diagnostics for details.',
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
