import { pathToFileURL } from 'node:url';

import {
  getProjectPaths,
  toRelativeWithin,
} from './deck-paths.js';
import { runAuditAll, runBoundaryAudit, runCanvasAudit, runThemeAudit } from './audit-service.js';
import { computeStructuralManifest } from './structural-compiler.js';
import { readArtifacts, readRenderState } from './presentation-runtime-state.js';
import { getProjectState } from './project-state.js';
import { exportPresentation, finalizePresentation } from './services/presentation-ops-service.mjs';

const EXIT_CODE_OK = 0;
const EXIT_CODE_VIOLATIONS = 1;
const EXIT_CODE_ERROR = 2;
const EXIT_CODE_UNSUPPORTED = 3;

class CliError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CliError';
    this.exitCode = options.exitCode ?? EXIT_CODE_UNSUPPORTED;
    this.status = options.status ?? 'unsupported';
    this.extra = options.extra ?? {};
  }
}

function quoteCommandToken(value) {
  const token = String(value ?? '');
  return /\s/.test(token) ? JSON.stringify(token) : token;
}

function formatCommand(argv) {
  const suffix = argv.map((value) => quoteCommandToken(value)).join(' ').trim();
  return suffix ? `presentation ${suffix}` : 'presentation';
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function timestampSegment() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseFlagValue(argv, index, flagName) {
  const value = argv[index + 1] || '';
  if (!value || value.startsWith('--')) {
    throw new CliError(`Missing value for ${flagName}.`);
  }
  return value;
}

export function parsePresentationCliArgs(argv = []) {
  const family = String(argv[0] || '').trim();
  if (!family) {
    throw new CliError('Missing command family. Expected one of: inspect, status, audit, finalize, export.');
  }

  const positionals = [];
  const slideIds = [];
  let projectRoot = '';
  let format = 'text';
  let outputDir = '';
  let outputFile = '';
  let pathValue = '';
  let deck = false;
  let strict = false;
  let render = false;
  let severity = '';

  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }

    switch (arg) {
      case '--project':
        projectRoot = parseFlagValue(argv, index, '--project');
        index += 1;
        break;
      case '--format':
        format = parseFlagValue(argv, index, '--format').toLowerCase();
        index += 1;
        break;
      case '--slide':
        slideIds.push(parseFlagValue(argv, index, '--slide'));
        index += 1;
        break;
      case '--output-dir':
        outputDir = parseFlagValue(argv, index, '--output-dir');
        index += 1;
        break;
      case '--output-file':
        outputFile = parseFlagValue(argv, index, '--output-file');
        index += 1;
        break;
      case '--path':
        pathValue = parseFlagValue(argv, index, '--path');
        index += 1;
        break;
      case '--severity':
        severity = parseFlagValue(argv, index, '--severity').toLowerCase();
        index += 1;
        break;
      case '--deck':
        deck = true;
        break;
      case '--strict':
        strict = true;
        break;
      case '--render':
        render = true;
        break;
      default:
        throw new CliError(`Unknown flag: ${arg}`);
    }
  }

  if (!['text', 'json'].includes(format)) {
    throw new CliError(`Unsupported format "${format}". Use --format text or --format json.`);
  }

  if (!projectRoot) {
    throw new CliError('Usage: pass --project /abs/path.');
  }

  return {
    family,
    positionals,
    projectRoot,
    format,
    slideIds,
    outputDir,
    outputFile,
    pathValue,
    deck,
    strict,
    render,
    severity,
  };
}

function renderTextEnvelope(payload) {
  const lines = [];
  if (payload.command) {
    lines.push(payload.command);
  }
  if (payload.summary) {
    lines.push(payload.summary);
  }
  if (payload.workflow) {
    lines.push(`workflow: ${payload.workflow}`);
  }
  if (payload.facets) {
    lines.push(`facets: ${JSON.stringify(payload.facets)}`);
  }
  if (payload.outputs) {
    lines.push(`outputs: ${JSON.stringify(payload.outputs)}`);
  }
  if (Array.isArray(payload.issues) && payload.issues.length > 0) {
    lines.push('issues:');
    for (const issue of payload.issues) {
      lines.push(`- ${issue.code || issue}`);
    }
  }
  if (Array.isArray(payload.nextFocus) && payload.nextFocus.length > 0) {
    lines.push(`nextFocus: ${payload.nextFocus.join(', ')}`);
  }
  return lines.join('\n');
}

function finalizeResult(payload, format, exitCode) {
  return {
    exitCode,
    payload,
    stdout: format === 'json'
      ? `${JSON.stringify(payload, null, 2)}\n`
      : `${renderTextEnvelope(payload)}\n`,
  };
}

function unsupported(command, summary, extra = {}) {
  return finalizeResult({ command, status: 'unsupported', summary, ...extra }, 'json', EXIT_CODE_UNSUPPORTED);
}

function buildInspectPackageEnvelope(command, projectRoot) {
  const paths = getProjectPaths(projectRoot);
  const manifest = computeStructuralManifest(projectRoot);
  const renderState = readRenderState(projectRoot);
  const artifacts = readArtifacts(projectRoot);
  const state = getProjectState(projectRoot);

  return {
    command,
    status: 'ok',
    scope: {
      kind: 'package',
      projectRoot: paths.projectRootAbs,
    },
    summary: {
      title: paths.title,
      slug: paths.slug,
      workflow: state.workflow,
      slidesTotal: manifest.counts.slidesTotal,
    },
    data: {
      manifest,
      renderState,
      artifacts,
    },
    evidence: [
      paths.packageManifestRel,
      paths.renderStateRel,
      paths.artifactsRel,
    ],
    freshness: {
      relativeToSource: state.facets?.evidence || (renderState ? 'current' : 'missing'),
    },
    nextFocus: state.nextFocus || [],
  };
}

function buildStatusEnvelope(command, projectRoot, scopeKind = 'package') {
  const state = getProjectState(projectRoot);
  const blockers = state.lastPolicyError ? [state.lastPolicyError] : [];

  return {
    command,
    status: 'ok',
    scope: {
      kind: scopeKind,
      projectRoot: state.projectRoot,
    },
    workflow: state.workflow,
    summary: state.statusSummary,
    blockers,
    facets: state.facets,
    nextBoundary: state.nextBoundary,
    nextFocus: state.nextFocus,
    evidence: [
      '.presentation/runtime/render-state.json',
      '.presentation/runtime/artifacts.json',
    ],
    freshness: {
      relativeToSource: state.facets?.evidence || 'unknown',
    },
  };
}

async function runInspectCommand(parsed, command) {
  const target = parsed.positionals[0] || 'package';
  if (target !== 'package') {
    throw new CliError(`Unsupported inspect target "${target}". Only "package" is available in Task 9.`, {
      extra: {
        scope: { kind: 'inspect-target', target },
      },
    });
  }

  return finalizeResult(buildInspectPackageEnvelope(command, parsed.projectRoot), parsed.format, EXIT_CODE_OK);
}

async function runStatusCommand(parsed, command, scopeKind = 'package') {
  const target = parsed.positionals[0] || 'package';
  if (!['package', 'readiness', 'finalize'].includes(target)) {
    throw new CliError(`Unsupported status target "${target}".`, {
      extra: {
        scope: { kind: 'status-target', target },
      },
    });
  }

  return finalizeResult(
    buildStatusEnvelope(command, parsed.projectRoot, scopeKind === 'package' ? target : scopeKind),
    parsed.format,
    EXIT_CODE_OK
  );
}

function summarizeAuditResult(result) {
  if (result.status === 'pass') {
    return `No hard violations found in the ${result.family} audit.`;
  }

  return `${pluralize(result.issueCount, 'hard violation')} found in the ${result.family} audit.`;
}

async function runAuditCommand(parsed, command) {
  const family = parsed.positionals[0] || 'all';
  const auditOptions = {
    slideId: parsed.slideIds[0] || null,
    path: parsed.pathValue || null,
    deck: parsed.deck,
    severity: parsed.severity || 'error',
    strict: parsed.strict,
    render: parsed.render,
  };

  const familyToRunner = {
    theme: runThemeAudit,
    canvas: runCanvasAudit,
    boundaries: runBoundaryAudit,
    all: runAuditAll,
  };

  const runner = familyToRunner[family];
  if (!runner) {
    throw new CliError(`Unsupported audit family "${family}".`, {
      extra: {
        scope: { kind: 'audit-family', family },
      },
    });
  }

  const result = await runner(parsed.projectRoot, auditOptions);
  const payload = {
    command,
    status: result.status,
    family: result.family,
    scope: result.scope,
    summary: summarizeAuditResult(result),
    issueCount: result.issueCount,
    issues: result.issues,
    nextFocus: result.nextFocus,
    evidence: result.nextFocus,
    freshness: {
      relativeToSource: 'current',
    },
  };

  if (result.families) {
    payload.families = result.families;
  }

  return finalizeResult(payload, parsed.format, result.status === 'fail' ? EXIT_CODE_VIOLATIONS : EXIT_CODE_OK);
}

async function runFinalizeCommand(parsed, command) {
  const target = parsed.positionals[0] || '';
  if (target === 'status') {
    return runStatusCommand({ ...parsed, positionals: ['finalize'] }, command, 'finalize');
  }
  if (target && target !== 'run') {
    throw new CliError(`Unsupported finalize target "${target}".`, {
      extra: {
        scope: { kind: 'finalize-target', target },
      },
    });
  }

  const paths = getProjectPaths(parsed.projectRoot);
  const result = await finalizePresentation({ projectRoot: parsed.projectRoot });
  const payload = {
    command,
    status: result.status,
    summary: result.status === 'pass'
      ? 'Canonical delivery outputs were produced.'
      : 'Finalize completed with blocking issues.',
    outputs: result.outputs,
    evidenceUpdated: [
      paths.renderStateRel,
      paths.artifactsRel,
    ],
    issues: result.issues || [],
  };

  return finalizeResult(payload, parsed.format, result.status === 'pass' ? EXIT_CODE_OK : EXIT_CODE_VIOLATIONS);
}

function buildDefaultExportRequest(parsed) {
  const target = parsed.positionals[0] || '';
  if (!['pdf', 'screenshots'].includes(target)) {
    throw new CliError(`Unsupported export target "${target || '(missing)'}". Use "pdf" or "screenshots".`, {
      extra: {
        scope: { kind: 'export-target', target: target || null },
      },
    });
  }

  const paths = getProjectPaths(parsed.projectRoot);
  const manifest = computeStructuralManifest(parsed.projectRoot);
  const slideIds = parsed.slideIds.length > 0
    ? parsed.slideIds
    : manifest.slides.map((slide) => slide.id);

  if (slideIds.length === 0) {
    throw new CliError('No slides are available to export.', {
      status: 'unavailable',
      extra: {
        scope: { kind: 'export', target },
      },
    });
  }

  const format = target === 'pdf' ? 'pdf' : 'png';
  const outputDir = parsed.outputDir || `${paths.exportsOutputDirRel}/${timestampSegment()}/${target}`;

  return {
    target,
    paths,
    request: {
      format,
      slideIds,
      outputDir,
      outputFile: parsed.outputFile || '',
    },
  };
}

async function runExportCommand(parsed, command) {
  const { target, paths, request } = buildDefaultExportRequest(parsed);
  const result = await exportPresentation(
    { projectRoot: parsed.projectRoot },
    request,
    { cwd: paths.projectRootAbs }
  );

  const outputDir = toRelativeWithin(paths.projectRootAbs, result.outputDir);
  const artifacts = (result.outputPaths || [])
    .map((outputPath) => toRelativeWithin(paths.projectRootAbs, outputPath));

  const payload = {
    command,
    status: 'pass',
    summary: 'Requested export artifacts were produced.',
    outputs: {
      outputDir,
      artifacts,
    },
    evidenceUpdated: [paths.artifactsRel],
    issues: [],
    scope: {
      kind: 'export',
      format: target,
      projectRoot: paths.projectRootAbs,
    },
  };

  return finalizeResult(payload, parsed.format, EXIT_CODE_OK);
}

async function dispatchPresentationCli(argv = process.argv.slice(2)) {
  const command = formatCommand(argv);
  try {
    const parsed = parsePresentationCliArgs(argv);

    switch (parsed.family) {
      case 'inspect':
        return await runInspectCommand(parsed, command);
      case 'status':
        return await runStatusCommand(parsed, command);
      case 'audit':
        return await runAuditCommand(parsed, command);
      case 'finalize':
        return await runFinalizeCommand(parsed, command);
      case 'export':
        return await runExportCommand(parsed, command);
      case 'explain':
        return unsupported(command, 'Explain is not implemented in Task 9.', {
          scope: { kind: 'explain' },
        });
      default:
        throw new CliError(`Unknown command family "${parsed.family}".`);
    }
  } catch (error) {
    if (error instanceof CliError) {
      return finalizeResult(
        {
          command,
          status: error.status,
          summary: error.message,
          ...error.extra,
        },
        'json',
        error.exitCode
      );
    }

    return finalizeResult(
      {
        command,
        status: 'error',
        summary: error?.message || 'Internal presentation CLI failure.',
      },
      'json',
      EXIT_CODE_ERROR
    );
  }
}

export async function runPresentationCli(argv = process.argv.slice(2)) {
  return dispatchPresentationCli(argv);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await dispatchPresentationCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.exit(result.exitCode);
}
