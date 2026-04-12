import { getProjectPaths } from './deck-paths.js';
import {
  collectBoundaryPolicyFindings,
  collectCanvasPolicyFindings,
  collectThemePolicyFindings,
} from './deck-policy.js';

function buildAuditScope(paths, options = {}) {
  return {
    projectRoot: paths.projectRootAbs,
    slideId: options.slideId || null,
  };
}

function uniqueInOrder(values) {
  const seen = new Set();
  const ordered = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }

  return ordered;
}

function codeForThemeMessage(message) {
  if (/override structural canvas token/i.test(message)) {
    return 'theme.structural-token-override';
  }
  if (/wrap all theme rules in @layer theme/i.test(message)) {
    return 'theme.missing-layer';
  }
  if (/remove !important/i.test(message)) {
    return 'theme.important';
  }
  if (/unknown canvas variable/i.test(message)) {
    return 'theme.unknown-canvas-variable';
  }
  if (/theme override/i.test(message)) {
    return 'theme.illegal-canvas-selector';
  }
  if (/asset path|unsupported asset url scheme|missing preview path builder/i.test(message)) {
    return 'theme.asset-reference';
  }
  if (/add theme\.css/i.test(message)) {
    return 'theme.missing-file';
  }
  return 'theme.policy-violation';
}

function codeForCanvasMessage(message) {
  if (/keep structural canvas token/i.test(message)) {
    return 'canvas.structural-token-drift';
  }
  if (/\.slide stage max-width/i.test(message)) {
    return 'canvas.stage-max-width-drift';
  }
  if (/\.slide stage aspect-ratio/i.test(message)) {
    return 'canvas.stage-aspect-ratio-drift';
  }
  if (/\.slide-wide stage max-width/i.test(message)) {
    return 'canvas.stage-wide-max-width-drift';
  }
  if (/runtime chrome selector/i.test(message)) {
    return 'canvas.runtime-selector';
  }
  return 'canvas.policy-violation';
}

function codeForBoundaryMessage(message) {
  if (/^Scope ".+" to "#.+"/i.test(message)) {
    return 'boundary.illegal-selector-scope';
  }
  if (/generated slide wrapper/i.test(message)) {
    return 'boundary.generated-wrapper-selector';
  }
  if (/runtime chrome selectors/i.test(message)) {
    return 'boundary.runtime-selector';
  }
  if (/canvas-owned selectors/i.test(message)) {
    return 'boundary.canvas-selector';
  }
  if (/custom root class/i.test(message)) {
    return 'boundary.root-class-selector';
  }
  if (/theme styling out of/i.test(message)) {
    return 'boundary.theme-primitive-override';
  }
  if (/wrap all slide\.css rules in @layer content/i.test(message)) {
    return 'boundary.missing-content-layer';
  }
  if (/remove !important from slide\.css/i.test(message)) {
    return 'boundary.important';
  }
  if (/override structural canvas token .*slide\.css/i.test(message)) {
    return 'boundary.structural-token-override';
  }
  if (/remove inline style attributes from slide\.html/i.test(message)) {
    return 'boundary.inline-style';
  }
  if (/remove <style> blocks from slide\.html/i.test(message)) {
    return 'boundary.inline-style-block';
  }
  if (/must not include <html>, <head>, <body>, <section>, or data-slide wrappers/i.test(message)) {
    return 'boundary.illegal-wrapper';
  }
  if (/exactly one slide root|exactly one top-level slide root|begin with the slide root element directly/i.test(message)) {
    return 'boundary.invalid-slide-root';
  }
  if (/replace every \[\[TODO_/i.test(message)) {
    return 'boundary.todo-marker';
  }
  if (/keep .* limited to slide\.html|use ".*assets\/" as a directory|keep ".*" as a file/i.test(message)) {
    return 'boundary.invalid-slide-folder';
  }
  if (/add slide\.html inside/i.test(message)) {
    return 'boundary.missing-slide-html';
  }
  if (/rename ".*" to use the pattern nnn-slide-id/i.test(message)) {
    return 'boundary.invalid-slide-id';
  }
  if (/asset path|unsupported asset url scheme|missing preview path builder/i.test(message)) {
    return 'boundary.asset-reference';
  }
  return 'boundary.policy-violation';
}

function codeForFinding(family, finding) {
  if (family === 'theme') {
    return codeForThemeMessage(finding.message);
  }
  if (family === 'canvas') {
    return codeForCanvasMessage(finding.message);
  }
  if (family === 'boundaries') {
    return codeForBoundaryMessage(finding.message);
  }
  return 'audit.policy-violation';
}

function normalizeIssue(family, finding) {
  return {
    code: codeForFinding(family, finding),
    family,
    layer: finding.layer,
    message: finding.message,
    severity: 'error',
    slideId: finding.slideId ?? null,
    source: finding.sourceName,
  };
}

function buildAuditResult({ family, command, paths, options = {}, findings = [] }) {
  const issues = findings.map((finding) => normalizeIssue(family, finding));

  return {
    kind: 'audit-result',
    family,
    command,
    scope: buildAuditScope(paths, options),
    status: issues.length > 0 ? 'fail' : 'pass',
    issueCount: issues.length,
    nextFocus: uniqueInOrder(issues.map((issue) => issue.source)),
    issues,
  };
}

function mergeAuditResults(command, paths, options, results) {
  const issues = results.flatMap((result) => result.issues);
  const families = Object.fromEntries(results.map((result) => [result.family, {
    issueCount: result.issueCount,
    status: result.status,
  }]));

  return {
    kind: 'audit-result',
    family: 'all',
    command,
    scope: buildAuditScope(paths, options),
    status: issues.length > 0 ? 'fail' : 'pass',
    issueCount: issues.length,
    nextFocus: uniqueInOrder(issues.map((issue) => issue.source)),
    issues,
    families,
  };
}

export async function runThemeAudit(projectRootInput, options = {}) {
  const paths = getProjectPaths(projectRootInput);
  return buildAuditResult({
    family: 'theme',
    command: 'presentation audit theme',
    paths,
    options,
    findings: collectThemePolicyFindings(paths, options),
  });
}

export async function runCanvasAudit(projectRootInput, options = {}) {
  const paths = getProjectPaths(projectRootInput);
  return buildAuditResult({
    family: 'canvas',
    command: 'presentation audit canvas',
    paths,
    options,
    findings: collectCanvasPolicyFindings(paths, options),
  });
}

export async function runBoundaryAudit(projectRootInput, options = {}) {
  const paths = getProjectPaths(projectRootInput);
  return buildAuditResult({
    family: 'boundaries',
    command: 'presentation audit boundaries',
    paths,
    options,
    findings: collectBoundaryPolicyFindings(paths, options),
  });
}

export async function runAuditAll(projectRootInput, options = {}) {
  const paths = getProjectPaths(projectRootInput);
  const theme = await runThemeAudit(paths.projectRootAbs, options);
  const canvas = await runCanvasAudit(paths.projectRootAbs, options);
  const boundaries = await runBoundaryAudit(paths.projectRootAbs, options);

  return mergeAuditResults('presentation audit all', paths, options, [theme, canvas, boundaries]);
}
