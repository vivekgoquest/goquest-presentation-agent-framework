#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createPresentationCore, PresentationCoreError } from './presentation-core.mjs';

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
    throw new CliError('Missing command family. Expected one of: init, inspect, status, audit, preview, finalize, export.');
  }

  const positionals = [];
  const slideIds = [];
  let projectRoot = '';
  let format = 'text';
  let outputDir = '';
  let outputFile = '';
  let pathValue = '';
  let slideCount = 3;
  let copyFramework = false;
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
      case '--slides': {
        const rawValue = parseFlagValue(argv, index, '--slides');
        if (!/^\d+$/.test(rawValue)) {
          throw new CliError('--slides <count> must be a whole number.');
        }
        slideCount = Number.parseInt(rawValue, 10);
        index += 1;
        break;
      }
      case '--severity':
        severity = parseFlagValue(argv, index, '--severity').toLowerCase();
        index += 1;
        break;
      case '--copy-framework':
        copyFramework = true;
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
    slideCount,
    copyFramework,
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
  if (payload.projectRoot) {
    lines.push(`projectRoot: ${formatTextValue(payload.projectRoot)}`);
  }
  if (payload.previewUrl) {
    lines.push(`previewUrl: ${formatTextValue(payload.previewUrl)}`);
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
  const inspection = await core.inspectPackage(parsed.projectRoot, {
    target: parsed.positionals[0] || 'package',
  });
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
  const result = await core.runAudit(parsed.projectRoot, {
    family: parsed.positionals[0] || 'all',
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

async function runInitCommand(parsed, command, core) {
  const result = await core.initProject(parsed.projectRoot, {
    slideCount: parsed.slideCount,
    copyFramework: parsed.copyFramework,
  });

  return finalizeResult({
    command,
    status: result.status || 'created',
    summary: 'Presentation project scaffold created.',
    projectRoot: parsed.projectRoot,
    deck: result.deck,
    slideCount: result.slideCount,
    files: result.files || [],
    nextSteps: result.nextSteps || [],
    git: result.git || null,
  }, parsed.format, EXIT_CODE_OK);
}

async function runPreviewCommand(parsed, command, core) {
  const mode = String(parsed.positionals[0] || 'serve').trim().toLowerCase() || 'serve';
  if (!['serve', 'open'].includes(mode)) {
    throw new CliError(`Unsupported preview mode "${mode}". Use "serve" or "open".`);
  }

  const result = await core.previewPresentation(parsed.projectRoot, { mode });
  const response = finalizeResult({
    command,
    status: result.status || 'pass',
    summary: result.summary || (mode === 'open' ? 'Preview opened in the default browser.' : 'Preview server started.'),
    projectRoot: result.projectRoot || parsed.projectRoot,
    previewUrl: result.previewUrl,
    scope: {
      kind: 'preview',
      mode,
      projectRoot: result.projectRoot || parsed.projectRoot,
    },
  }, parsed.format, EXIT_CODE_OK);
  response.holdOpen = result.waitUntilClose || null;
  return response;
}

function buildFinalizeExportRequest(parsed) {
  if (parsed.positionals.length > 0) {
    throw new CliError(
      'Finalize does not accept extra positionals. Use plain "presentation finalize" or "presentation export pdf".',
      {
        extra: {
          scope: {
            kind: 'finalize-target',
            target: parsed.positionals[0],
          },
        },
      }
    );
  }

  return {
    ...parsed,
    positionals: ['pdf'],
  };
}

async function runExportCommand(parsed, command, core) {
  const result = await core.exportPresentation(parsed.projectRoot, {
    target: parsed.positionals[0] || 'pdf',
    slideIds: parsed.slideIds,
    outputDir: parsed.outputDir,
    outputFile: parsed.outputFile,
  });

  const failed = result.status === 'fail';
  const payload = {
    command,
    status: result.status || 'pass',
    summary: failed
      ? 'Requested export completed with issues.'
      : 'Requested export artifacts were produced.',
    outputs: {
      outputDir: result.outputDir,
      artifacts: result.artifacts || [],
    },
    evidenceUpdated: result.evidenceUpdated || [],
    issues: result.issues || [],
    scope: result.scope,
  };

  return finalizeResult(payload, parsed.format, failed ? EXIT_CODE_VIOLATIONS : EXIT_CODE_OK);
}

async function dispatchPresentationCli(argv = process.argv.slice(2), options = {}) {
  const command = formatCommand(argv);
  try {
    const parsed = parsePresentationCliArgs(argv);
    const core = options.core || createPresentationCore();

    switch (parsed.family) {
      case 'init':
        return await runInitCommand(parsed, command, core);
      case 'inspect':
        return await runInspectCommand(parsed, command, core);
      case 'status':
        return await runStatusCommand(parsed, command, core);
      case 'audit':
        return await runAuditCommand(parsed, command, core);
      case 'preview':
        return await runPreviewCommand(parsed, command, core);
      case 'finalize':
        return await runExportCommand(buildFinalizeExportRequest(parsed), command, core);
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
    if (error instanceof CliError || error instanceof PresentationCoreError) {
      return finalizeResult(
        {
          command,
          status: error.status,
          summary: error.message,
          ...error.extra,
        },
        'json',
        error instanceof CliError ? error.exitCode : EXIT_CODE_UNSUPPORTED
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

function isDirectCliInvocation() {
  if (!process.argv[1]) {
    return false;
  }

  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return fileURLToPath(import.meta.url) === resolve(process.argv[1]);
  }
}

if (isDirectCliInvocation()) {
  const result = await dispatchPresentationCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  if (result.holdOpen) {
    await result.holdOpen;
  }
  process.exit(result.exitCode);
}
