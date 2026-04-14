import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  getProjectPaths,
  toRelativeWithin,
} from './deck-paths.js';
import { createPresentationCore } from './presentation-core.mjs';

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

function formatTextValue(value, pretty = false) {
  if (value === undefined || value === null) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, pretty ? 2 : 0);
}

function renderTextEnvelope(payload) {
  const lines = [];
  if (payload.command) {
    lines.push(payload.command);
  }
  if (payload.summary) {
    lines.push(formatTextValue(payload.summary, true));
  }
  if (payload.workflow) {
    lines.push(`workflow: ${formatTextValue(payload.workflow)}`);
  }
  if (payload.facets) {
    lines.push(`facets: ${formatTextValue(payload.facets)}`);
  }
  if (payload.outputs) {
    lines.push(`outputs: ${formatTextValue(payload.outputs)}`);
  }
  if (Array.isArray(payload.issues) && payload.issues.length > 0) {
    lines.push('issues:');
    for (const issue of payload.issues) {
      const renderedIssue = issue && typeof issue === 'object' && issue.code
        ? issue.code
        : formatTextValue(issue);
      lines.push(`- ${renderedIssue}`);
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

function buildInspectPackageEnvelope(command, inspection) {
  return {
    command,
    status: 'ok',
    scope: {
      kind: 'package',
      projectRoot: inspection.projectRoot,
    },
    summary: {
      title: inspection.title,
      slug: inspection.slug,
      workflow: inspection.status.workflow,
      slidesTotal: inspection.manifest.counts.slidesTotal,
    },
    data: {
      manifest: inspection.manifest,
      renderState: inspection.renderState,
      artifacts: inspection.artifacts,
    },
    evidence: inspection.evidence,
    freshness: inspection.freshness,
    nextFocus: inspection.status.nextFocus || [],
  };
}

function buildStatusEnvelope(command, status, scopeKind = 'package') {
  return {
    command,
    status: 'ok',
    scope: {
      kind: scopeKind,
      projectRoot: status.projectRoot,
    },
    workflow: status.workflow,
    summary: status.summary,
    blockers: status.blockers,
    facets: status.facets,
    nextBoundary: status.nextBoundary,
    nextFocus: status.nextFocus,
    evidence: status.evidence,
    freshness: status.freshness,
  };
}

async function runInspectCommand(parsed, command, core) {
  const target = parsed.positionals[0] || 'package';
  if (target !== 'package') {
    throw new CliError(`Unsupported inspect target "${target}". Only "package" is available in Task 9.`, {
      extra: {
        scope: { kind: 'inspect-target', target },
      },
    });
  }

  const inspection = await core.inspectPackage(parsed.projectRoot);
  return finalizeResult(buildInspectPackageEnvelope(command, inspection), parsed.format, EXIT_CODE_OK);
}

async function runStatusCommand(parsed, command, core, scopeKind = 'package') {
  const target = parsed.positionals[0] || 'package';
  if (!['package', 'readiness', 'finalize'].includes(target)) {
    throw new CliError(`Unsupported status target "${target}".`, {
      extra: {
        scope: { kind: 'status-target', target },
      },
    });
  }

  const status = await core.getStatus(parsed.projectRoot);
  return finalizeResult(
    buildStatusEnvelope(command, status, scopeKind === 'package' ? target : scopeKind),
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

async function runAuditCommand(parsed, command, core) {
  const family = parsed.positionals[0] || 'all';
  if (!['theme', 'canvas', 'boundaries', 'all'].includes(family)) {
    throw new CliError(`Unsupported audit family "${family}".`, {
      extra: {
        scope: { kind: 'audit-family', family },
      },
    });
  }

  const result = await core.runAudit(parsed.projectRoot, {
    family,
    slideId: parsed.slideIds[0] || null,
    path: parsed.pathValue || null,
    deck: parsed.deck,
    severity: parsed.severity || 'error',
    strict: parsed.strict,
    render: parsed.render,
  });
  const payload = {
    command,
    status: result.status,
    family: result.family,
    scope: {
      projectRoot: result.projectRoot,
      slideId: result.slideId,
    },
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

async function runFinalizeCommand(parsed, command, core) {
  const target = parsed.positionals[0] || '';
  if (target === 'status') {
    return runStatusCommand({ ...parsed, positionals: ['finalize'] }, command, core, 'finalize');
  }
  if (target && target !== 'run') {
    throw new CliError(`Unsupported finalize target "${target}".`, {
      extra: {
        scope: { kind: 'finalize-target', target },
      },
    });
  }

  const paths = getProjectPaths(parsed.projectRoot);
  const result = await core.finalize(parsed.projectRoot);
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

function buildExportScope(target, projectRoot) {
  return {
    kind: 'export',
    format: target,
    projectRoot,
  };
}

function validateExportOutputDir(paths, outputDir) {
  const outputDirAbs = resolve(paths.projectRootAbs, outputDir);

  try {
    toRelativeWithin(paths.projectRootAbs, outputDirAbs);
  } catch {
    throw new CliError(`Export output directories must stay within the project root: ${paths.projectRootAbs}.`, {
      extra: {
        scope: { kind: 'export-output-dir', outputDir },
      },
    });
  }

  return outputDir;
}

function getMissingSlideSelections(manifest, slideIds) {
  const availableSlideIds = new Set(manifest.slides.map((slide) => slide.id));
  return slideIds.filter((slideId) => !availableSlideIds.has(slideId));
}

function toExportRequestCliError(error, scope) {
  if (error instanceof CliError) {
    return error;
  }

  const message = error?.message || '';
  if (
    message === 'Export format must be either "pdf" or "png".'
    || message === 'Select at least one slide to export.'
    || message === 'Choose a destination folder before exporting.'
    || message.startsWith('Unknown slide selections: ')
  ) {
    return new CliError(message, {
      status: 'invalid-request',
      extra: { scope },
    });
  }

  return null;
}

async function buildDefaultExportRequest(parsed, core) {
  const target = parsed.positionals[0] || '';
  if (!['pdf', 'screenshots'].includes(target)) {
    throw new CliError(`Unsupported export target "${target || '(missing)'}". Use "pdf" or "screenshots".`, {
      extra: {
        scope: { kind: 'export-target', target: target || null },
      },
    });
  }

  const paths = getProjectPaths(parsed.projectRoot);
  const inspection = await core.inspectPackage(parsed.projectRoot);
  const manifest = inspection.manifest;
  const slideIds = parsed.slideIds.length > 0
    ? parsed.slideIds
    : manifest.slides.map((slide) => slide.id);

  if (slideIds.length === 0) {
    throw new CliError('No slides are available to export.', {
      status: 'unavailable',
      extra: {
        scope: buildExportScope(target, paths.projectRootAbs),
      },
    });
  }

  const missingSlideIds = getMissingSlideSelections(manifest, slideIds);
  if (missingSlideIds.length > 0) {
    throw new CliError(`Unknown slide selections: ${missingSlideIds.join(', ')}`, {
      status: 'invalid-request',
      extra: {
        scope: buildExportScope(target, paths.projectRootAbs),
      },
    });
  }

  const format = target === 'pdf' ? 'pdf' : 'png';
  const outputDir = parsed.outputDir
    ? validateExportOutputDir(paths, parsed.outputDir)
    : `${paths.exportsOutputDirRel}/${timestampSegment()}/${target}`;

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

async function runExportCommand(parsed, command, core) {
  const { target, paths, request } = await buildDefaultExportRequest(parsed, core);
  const scope = buildExportScope(target, paths.projectRootAbs);

  let result;
  try {
    result = await core.exportPresentation(parsed.projectRoot, {
      ...request,
      cwd: paths.projectRootAbs,
    });
  } catch (error) {
    const cliError = toExportRequestCliError(error, scope);
    if (cliError) {
      throw cliError;
    }
    throw error;
  }

  let outputDir;
  let artifacts;
  try {
    outputDir = toRelativeWithin(paths.projectRootAbs, result.outputDir);
    artifacts = (result.outputPaths || [])
      .map((outputPath) => toRelativeWithin(paths.projectRootAbs, outputPath));
  } catch {
    throw new CliError(`Export outputs must stay within the project root: ${paths.projectRootAbs}.`, {
      extra: { scope },
    });
  }

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
    scope,
  };

  return finalizeResult(payload, parsed.format, EXIT_CODE_OK);
}

async function dispatchPresentationCli(argv = process.argv.slice(2), options = {}) {
  const command = formatCommand(argv);
  try {
    const parsed = parsePresentationCliArgs(argv);
    const core = options.core || createPresentationCore();

    switch (parsed.family) {
      case 'inspect':
        return await runInspectCommand(parsed, command, core);
      case 'status':
        return await runStatusCommand(parsed, command, core);
      case 'audit':
        return await runAuditCommand(parsed, command, core);
      case 'finalize':
        return await runFinalizeCommand(parsed, command, core);
      case 'export':
        return await runExportCommand(parsed, command, core);
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

export async function runPresentationCli(argv = process.argv.slice(2), options = {}) {
  return dispatchPresentationCli(argv, options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await dispatchPresentationCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.exit(result.exitCode);
}
