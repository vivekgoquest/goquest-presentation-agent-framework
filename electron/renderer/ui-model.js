const READY_STATUSES = new Set(['ready_to_finalize', 'finalized']);

function formatShellName(shellPath = '') {
  const parts = String(shellPath || '').split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || '';
}

function formatShellContext(meta = {}) {
  const shellName = formatShellName(meta?.shell);
  if (!shellName) {
    return '';
  }

  return meta?.loginShell ? `${shellName} login shell` : `${shellName} shell`;
}

function splitPathSegments(pathValue = '') {
  return String(pathValue || '').split(/[\\/]/).filter(Boolean);
}

function formatCwdContext(meta = {}) {
  const cwd = String(meta?.cwd || '').trim();
  const projectRoot = String(meta?.projectRoot || '').trim();
  if (!cwd || !projectRoot || cwd === projectRoot) {
    return '';
  }

  const projectSegments = splitPathSegments(projectRoot);
  const cwdSegments = splitPathSegments(cwd);
  const sharesProjectRoot = projectSegments.every((segment, index) => cwdSegments[index] === segment);
  if (sharesProjectRoot && cwdSegments.length > projectSegments.length) {
    return cwdSegments.slice(projectSegments.length).join('/');
  }

  return cwdSegments.at(-1) || '';
}

function formatCommandContext(meta = {}) {
  const integration = meta?.shellIntegration || {};
  if (!integration.supported) {
    return '';
  }

  if (integration.commandState === 'running') {
    return 'command running';
  }

  if (integration.commandState === 'failed' && Number.isFinite(integration.lastCommandExitCode)) {
    return `exit ${integration.lastCommandExitCode}`;
  }

  return '';
}

function formatShellDetail(meta = {}) {
  const shellContext = formatShellContext(meta);
  if (!shellContext) {
    return meta?.projectRoot ? 'Type here to work in this project.' : 'The shell is ready.';
  }

  return meta?.projectRoot
    ? `${shellContext} ready in this project.`
    : `${shellContext} ready.`;
}

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
  actions = [],
} = {}) {
  const hasProject = Boolean(meta?.active);

  if (!hasProject) {
    return {
      primary: null,
      secondary: null,
      menu: [],
    };
  }

  const descriptors = Array.isArray(actions) ? actions : [];
  const explicitPrimary = descriptors.find((action) => action.surface === 'primary') || null;
  const explicitSecondary = descriptors.find((action) => action.surface === 'secondary') || null;
  const menuActions = descriptors.filter((action) => action.surface === 'menu');

  const primary = explicitPrimary?.enabled
    ? explicitPrimary
    : (explicitSecondary?.enabled ? explicitSecondary : explicitPrimary || explicitSecondary || null);

  const menu = [
    ...(explicitSecondary && primary?.id !== explicitSecondary.id ? [explicitSecondary] : []),
    ...menuActions,
  ];

  return {
    primary,
    secondary: null,
    menu,
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
      label: 'Shell could not open',
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
        label: 'Opening shell',
        detail: 'Connecting to this project…',
        showTerminal: false,
        showRetry: false,
        showStop: false,
        showClear: false,
      };
    case 'running':
      return {
        state,
        label: 'Shell open',
        detail: formatShellDetail(meta),
        context: formatShellContext(meta),
        cwdContext: formatCwdContext(meta),
        commandContext: formatCommandContext(meta),
        showTerminal: true,
        showRetry: false,
        showStop: true,
        showClear: true,
      };
    case 'stopped':
      return {
        state,
        label: 'Shell closed',
        detail: 'Open the shell to keep working in this project.',
        showTerminal: false,
        showRetry: true,
        showStop: false,
        showClear: false,
      };
    default:
      return {
        state: 'idle',
        label: 'Open a project',
        detail: 'Open or create a project to launch the shell automatically.',
        showTerminal: false,
        showRetry: false,
        showStop: false,
        showClear: false,
      };
  }
}

export function formatTerminalOutputEvent(event = {}) {
  const data = String(event?.data || '');
  if (!data) {
    return '';
  }

  if (event?.source === 'system') {
    return `\u001b[90m${data}\u001b[0m`;
  }

  return data;
}

export function normalizeRuntimeActionResult(actionLabel, result = {}) {
  const label = actionLabel || 'Action';
  const issues = Array.isArray(result?.issues) ? result.issues.filter(Boolean) : [];

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
      detail: result.detail || issues[0] || '',
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
