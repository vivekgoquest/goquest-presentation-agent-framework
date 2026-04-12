import { existsSync, readFileSync } from 'fs';
import { basename, isAbsolute, relative, resolve, sep } from 'path';

export const REPO_ROOT = resolve(import.meta.dirname, '../..');
export const FRAMEWORK_ROOT = REPO_ROOT;
export const LONG_DECK_OUTLINE_THRESHOLD = 10;
export const LONG_DECK_BATCH_SIZE = 5;
export const PROJECT_SYSTEM_DIRNAME = '.presentation';
export const PROJECT_METADATA_FILENAME = 'project.json';
export const PROJECT_INTENT_FILENAME = 'intent.json';
export const PROJECT_PACKAGE_MANIFEST_FILENAME = 'package.generated.json';
export const PROJECT_RUNTIME_DIRNAME = 'runtime';
export const PROJECT_RENDER_STATE_FILENAME = 'render-state.json';
export const PROJECT_ARTIFACTS_FILENAME = 'artifacts.json';
export const PROJECT_LAST_GOOD_FILENAME = 'last-good.json';
export const PROJECT_FRAMEWORK_DIRNAME = 'framework';
export const PROJECT_FRAMEWORK_BASE_DIRNAME = 'base';
export const PROJECT_FRAMEWORK_OVERRIDES_DIRNAME = 'overrides';
export const PROJECT_PREVIEW_PATH = '/preview/';

// -----------------------------------------------------------------------------
// Repository and Path Normalization
// -----------------------------------------------------------------------------

const VALID_FRAMEWORK_MODES = new Set(['linked', 'copied']);
const PACKAGE_JSON = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf-8'));
export const FRAMEWORK_VERSION = PACKAGE_JSON.version || '0.0.0';

function normalizeRepoRelativePath(input) {
  if (typeof input !== 'string') {
    throw new Error('Path must be provided as a string.');
  }

  const normalized = input.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) {
    throw new Error('Path cannot be empty.');
  }

  if (normalized.includes('\0')) {
    throw new Error('Path contains an invalid null byte.');
  }

  return normalized;
}

function normalizeFsPath(input, baseDir = process.cwd()) {
  if (typeof input !== 'string') {
    throw new Error('Path must be provided as a string.');
  }

  const value = input.trim();
  if (!value) {
    throw new Error('Path cannot be empty.');
  }

  if (value.includes('\0')) {
    throw new Error('Path contains an invalid null byte.');
  }

  return isAbsolute(value)
    ? resolve(value)
    : resolve(baseDir, value);
}

function normalizeSlashPath(value) {
  return value.split(sep).join('/');
}

export function slugifyProjectName(name) {
  const slug = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'presentation-project';
}

export function slugToTitle(slug) {
  return slugifyProjectName(slug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function toRepoRelative(absPath) {
  return relative(REPO_ROOT, absPath).split(sep).join('/');
}

export function toRelativeWithin(rootAbs, absPath) {
  const normalizedRoot = resolve(rootAbs);
  const normalizedPath = resolve(absPath);
  const relPath = relative(normalizedRoot, normalizedPath);

  if (relPath === '..' || relPath.startsWith(`..${sep}`) || relPath.startsWith('../')) {
    throw new Error('Path must stay inside its owning root.');
  }

  return normalizeSlashPath(relPath || '.');
}

export function resolveRepoPath(input) {
  const absPath = isAbsolute(input)
    ? resolve(input)
    : resolve(REPO_ROOT, normalizeRepoRelativePath(input));
  const relPath = toRepoRelative(absPath);

  if (relPath === '..' || relPath.startsWith('../')) {
    throw new Error('Path must stay inside the repository.');
  }

  return { absPath, relPath };
}

export function createProjectRef(projectRootInput, baseDir = process.cwd()) {
  return {
    kind: 'project',
    projectRootAbs: normalizeFsPath(projectRootInput, baseDir),
  };
}

export function createPresentationTarget(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Presentation target must be an object.');
  }

  if (input.kind === 'project' || input.projectRootAbs || input.projectRoot) {
    return createProjectRef(input.projectRootAbs || input.projectRoot);
  }

  throw new Error('Presentation target must be a project reference.');
}

export function getProjectSystemPaths(projectRootInput) {
  const ref = createProjectRef(projectRootInput);
  const systemDirAbs = resolve(ref.projectRootAbs, PROJECT_SYSTEM_DIRNAME);
  const metadataAbs = resolve(systemDirAbs, PROJECT_METADATA_FILENAME);
  const intentAbs = resolve(systemDirAbs, PROJECT_INTENT_FILENAME);
  const packageManifestAbs = resolve(systemDirAbs, PROJECT_PACKAGE_MANIFEST_FILENAME);
  const runtimeDirAbs = resolve(systemDirAbs, PROJECT_RUNTIME_DIRNAME);
  const renderStateAbs = resolve(runtimeDirAbs, PROJECT_RENDER_STATE_FILENAME);
  const artifactsAbs = resolve(runtimeDirAbs, PROJECT_ARTIFACTS_FILENAME);
  const lastGoodAbs = resolve(runtimeDirAbs, PROJECT_LAST_GOOD_FILENAME);
  const frameworkDirAbs = resolve(systemDirAbs, PROJECT_FRAMEWORK_DIRNAME);
  const frameworkBaseAbs = resolve(frameworkDirAbs, PROJECT_FRAMEWORK_BASE_DIRNAME);
  const frameworkOverridesAbs = resolve(frameworkDirAbs, PROJECT_FRAMEWORK_OVERRIDES_DIRNAME);

  return {
    projectRootAbs: ref.projectRootAbs,
    systemDirAbs,
    metadataAbs,
    intentAbs,
    packageManifestAbs,
    runtimeDirAbs,
    renderStateAbs,
    artifactsAbs,
    lastGoodAbs,
    frameworkDirAbs,
    frameworkBaseAbs,
    frameworkOverridesAbs,
  };
}

// -----------------------------------------------------------------------------
// Project Metadata and Project Paths
// -----------------------------------------------------------------------------

function buildDefaultProjectMetadata(projectRootAbs, frameworkMode = 'linked') {
  const projectSlug = slugifyProjectName(basename(projectRootAbs));
  const normalizedFrameworkMode = VALID_FRAMEWORK_MODES.has(frameworkMode) ? frameworkMode : 'linked';

  return {
    projectMode: 'project-folder',
    projectName: slugToTitle(projectSlug),
    projectSlug,
    frameworkMode: normalizedFrameworkMode,
    frameworkVersion: FRAMEWORK_VERSION,
    frameworkSource: FRAMEWORK_ROOT,
    frameworkSourceVersion: FRAMEWORK_VERSION,
    frameworkCopiedAt: normalizedFrameworkMode === 'copied' ? new Date().toISOString() : null,
    canvasPolicy: 'protected',
    historyPolicy: 'checkpointed',
  };
}

export function readProjectMetadata(projectRootInput) {
  const { metadataAbs } = getProjectSystemPaths(projectRootInput);
  if (!existsSync(metadataAbs)) {
    throw new Error(`Project metadata not found at ${metadataAbs}. Create the project with npm run new -- --project /abs/path first.`);
  }

  let data;
  try {
    data = JSON.parse(readFileSync(metadataAbs, 'utf-8'));
  } catch (err) {
    throw new Error(`Project metadata at ${metadataAbs} is not valid JSON: ${err.message}`);
  }

  const projectSlug = slugifyProjectName(data.projectSlug || basename(createProjectRef(projectRootInput).projectRootAbs));
  const frameworkMode = VALID_FRAMEWORK_MODES.has(data.frameworkMode) ? data.frameworkMode : 'linked';

  return {
    projectMode: data.projectMode || 'project-folder',
    projectName: typeof data.projectName === 'string' && data.projectName.trim()
      ? data.projectName.trim()
      : slugToTitle(projectSlug),
    projectSlug,
    frameworkMode,
    frameworkVersion: data.frameworkVersion || FRAMEWORK_VERSION,
    frameworkSource: data.frameworkSource || FRAMEWORK_ROOT,
    frameworkSourceVersion: data.frameworkSourceVersion || FRAMEWORK_VERSION,
    frameworkCopiedAt: data.frameworkCopiedAt || null,
    canvasPolicy: data.canvasPolicy || 'protected',
    historyPolicy: data.historyPolicy || 'checkpointed',
  };
}

export function createProjectMetadata(projectRootInput, options = {}) {
  const projectRootAbs = createProjectRef(projectRootInput, options.baseDir).projectRootAbs;
  const base = buildDefaultProjectMetadata(projectRootAbs, options.frameworkMode);

  return {
    ...base,
    ...options.overrides,
    projectSlug: slugifyProjectName((options.overrides && options.overrides.projectSlug) || base.projectSlug),
    frameworkMode: VALID_FRAMEWORK_MODES.has((options.overrides && options.overrides.frameworkMode) || base.frameworkMode)
      ? ((options.overrides && options.overrides.frameworkMode) || base.frameworkMode)
      : 'linked',
    canvasPolicy: 'protected',
    historyPolicy: (options.overrides && options.overrides.historyPolicy) || base.historyPolicy || 'checkpointed',
  };
}

export function getProjectPaths(projectRootInput) {
  const ref = createProjectRef(projectRootInput);
  const systemPaths = getProjectSystemPaths(ref.projectRootAbs);
  const metadata = readProjectMetadata(ref.projectRootAbs);

  return {
    kind: 'project',
    projectRootAbs: ref.projectRootAbs,
    projectRootDisplay: ref.projectRootAbs,
    slug: metadata.projectSlug,
    title: metadata.projectName,
    metadata,
    frameworkMode: metadata.frameworkMode,
    sourceDirAbs: ref.projectRootAbs,
    sourceDirRel: ref.projectRootAbs,
    sourceDirDisplay: ref.projectRootAbs,
    previewPath: PROJECT_PREVIEW_PATH,
    themeCssRel: 'theme.css',
    themeCssAbs: resolve(ref.projectRootAbs, 'theme.css'),
    briefRel: 'brief.md',
    briefAbs: resolve(ref.projectRootAbs, 'brief.md'),
    outlineRel: 'outline.md',
    outlineAbs: resolve(ref.projectRootAbs, 'outline.md'),
    assetsDirRel: 'assets',
    assetsDirAbs: resolve(ref.projectRootAbs, 'assets'),
    slidesDirRel: 'slides',
    slidesDirAbs: resolve(ref.projectRootAbs, 'slides'),
    outputsDirRel: 'outputs',
    outputsDirAbs: resolve(ref.projectRootAbs, 'outputs'),
    finalizedOutputDirRel: 'outputs/finalized',
    finalizedOutputDirAbs: resolve(ref.projectRootAbs, 'outputs', 'finalized'),
    exportsOutputDirRel: 'outputs/exports',
    exportsOutputDirAbs: resolve(ref.projectRootAbs, 'outputs', 'exports'),
    systemDirRel: PROJECT_SYSTEM_DIRNAME,
    systemDirAbs: systemPaths.systemDirAbs,
    metadataRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_METADATA_FILENAME}`,
    metadataAbs: systemPaths.metadataAbs,
    intentRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_INTENT_FILENAME}`,
    intentAbs: systemPaths.intentAbs,
    packageManifestRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_PACKAGE_MANIFEST_FILENAME}`,
    packageManifestAbs: systemPaths.packageManifestAbs,
    runtimeDirRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_RUNTIME_DIRNAME}`,
    runtimeDirAbs: systemPaths.runtimeDirAbs,
    renderStateRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_RUNTIME_DIRNAME}/${PROJECT_RENDER_STATE_FILENAME}`,
    renderStateAbs: systemPaths.renderStateAbs,
    artifactsRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_RUNTIME_DIRNAME}/${PROJECT_ARTIFACTS_FILENAME}`,
    artifactsAbs: systemPaths.artifactsAbs,
    lastGoodAbs: systemPaths.lastGoodAbs,
    frameworkDirRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_FRAMEWORK_DIRNAME}`,
    frameworkDirAbs: systemPaths.frameworkDirAbs,
    frameworkBaseRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_FRAMEWORK_DIRNAME}/${PROJECT_FRAMEWORK_BASE_DIRNAME}`,
    frameworkBaseAbs: systemPaths.frameworkBaseAbs,
    frameworkOverridesRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_FRAMEWORK_DIRNAME}/${PROJECT_FRAMEWORK_OVERRIDES_DIRNAME}`,
    frameworkOverridesAbs: systemPaths.frameworkOverridesAbs,
    buildDisplayPath(absPath) {
      const relPath = toRelativeWithin(ref.projectRootAbs, absPath);
      return relPath === '.' ? ref.projectRootAbs : relPath;
    },
    buildProjectFilePreviewPath(absPath) {
      const relPath = toRelativeWithin(ref.projectRootAbs, absPath);
      if (relPath === '.') {
        throw new Error('Project file preview paths require a file beneath the project root.');
      }
      return `/project-files/${relPath}`;
    },
    buildFrameworkPreviewPath(relativePath) {
      return `/project-framework/${normalizeRepoRelativePath(relativePath)}`;
    },
  };
}

// -----------------------------------------------------------------------------
// CLI Targets and Output Paths
// -----------------------------------------------------------------------------

export function parsePresentationTargetCliArgs(argv, options = {}) {
  const {
    allowProject = true,
    requireTarget = true,
  } = options;

  let project = '';
  const rest = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--deck' || arg === '--example') {
      throw new Error(`Legacy workspace target "${arg}" was removed. Use --project /abs/path.`);
    }
    if (arg === '--project') {
      const value = argv[i + 1] || '';
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --project /abs/path.');
      }
      project = value;
      i += 1;
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    }
    rest.push(arg);
  }

  if (project) {
    if (!allowProject) {
      throw new Error('This command does not support --project /abs/path.');
    }

    return {
      target: createProjectRef(project),
      rest,
    };
  }

  if (requireTarget) {
    throw new Error('Usage: pass --project /abs/path.');
  }

  return {
    target: null,
    rest,
  };
}

export function getProjectOutputPaths(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  const finalizedOutputDirRel = paths.finalizedOutputDirRel;
  const finalizedOutputDirAbs = paths.finalizedOutputDirAbs;
  const finalizedPdfRel = `${finalizedOutputDirRel}/deck.pdf`;
  const finalizedPdfAbs = resolve(finalizedOutputDirAbs, 'deck.pdf');
  const finalizedReportRel = `${finalizedOutputDirRel}/report.json`;
  const finalizedReportAbs = resolve(finalizedOutputDirAbs, 'report.json');
  const finalizedFullPageRel = `${finalizedOutputDirRel}/full-page.png`;
  const finalizedFullPageAbs = resolve(finalizedOutputDirAbs, 'full-page.png');
  const finalizedSlidesDirRel = `${finalizedOutputDirRel}/slides`;
  const finalizedSlidesDirAbs = resolve(finalizedOutputDirAbs, 'slides');
  const finalizedSummaryRel = `${finalizedOutputDirRel}/summary.md`;
  const finalizedSummaryAbs = resolve(finalizedOutputDirAbs, 'summary.md');

  return {
    slug: paths.slug,
    finalizedOutputDirRel,
    finalizedOutputDirAbs,
    finalizedPdfRel,
    finalizedPdfAbs,
    finalizedReportRel,
    finalizedReportAbs,
    finalizedFullPageRel,
    finalizedFullPageAbs,
    finalizedSlidesDirRel,
    finalizedSlidesDirAbs,
    finalizedSummaryRel,
    finalizedSummaryAbs,
    exportsOutputDirRel: paths.exportsOutputDirRel,
    exportsOutputDirAbs: paths.exportsOutputDirAbs,

    // Backward-compatible aliases for consumers still expecting the pre-finalized names.
    outputDirRel: finalizedOutputDirRel,
    outputDirAbs: finalizedOutputDirAbs,
    pdfRel: finalizedPdfRel,
    pdfAbs: finalizedPdfAbs,
    reportRel: finalizedReportRel,
    reportAbs: finalizedReportAbs,
    fullPageRel: finalizedFullPageRel,
    fullPageAbs: finalizedFullPageAbs,
    slidesDirRel: finalizedSlidesDirRel,
    slidesDirAbs: finalizedSlidesDirAbs,
    summaryRel: finalizedSummaryRel,
    summaryAbs: finalizedSummaryAbs,
  };
}

export function getSuggestedPdfName(target) {
  const normalized = createPresentationTarget(target);
  return `${getProjectPaths(normalized.projectRootAbs).slug}.pdf`;
}

export function getPresentationId(target) {
  const normalized = createPresentationTarget(target);
  return `project:${normalized.projectRootAbs}`;
}

export function getPresentationPreviewPath(target) {
  createPresentationTarget(target);
  return PROJECT_PREVIEW_PATH;
}

export function getPresentationPaths(target) {
  const normalized = createPresentationTarget(target);
  return getProjectPaths(normalized.projectRootAbs);
}

export function getPresentationOutputPaths(target) {
  const normalized = createPresentationTarget(target);
  return getProjectOutputPaths(normalized.projectRootAbs);
}

// -----------------------------------------------------------------------------
// Framework Asset Resolution
// -----------------------------------------------------------------------------

function resolveSharedFrameworkAssetAbs(relativePath) {
  const normalized = normalizeRepoRelativePath(relativePath);
  const [bucket, ...rest] = normalized.split('/');
  if (rest.length === 0) {
    throw new Error(`Unsupported shared framework path: ${relativePath}`);
  }

  if (bucket === 'canvas' || bucket === 'client' || bucket === 'runtime' || bucket === 'templates') {
    return resolve(REPO_ROOT, 'framework', bucket, ...rest);
  }

  throw new Error(`Unsupported shared framework bucket "${bucket}" in ${relativePath}.`);
}

export function resolveProjectFrameworkAssetAbs(projectPathsInput, relativePath) {
  const paths = projectPathsInput.kind === 'project'
    ? projectPathsInput
    : getProjectPaths(projectPathsInput.projectRootAbs || projectPathsInput);
  const normalized = normalizeRepoRelativePath(relativePath);

  const overrideCandidate = resolve(paths.frameworkOverridesAbs, normalized);
  if (existsSync(overrideCandidate)) {
    return overrideCandidate;
  }

  const baseCandidate = resolve(paths.frameworkBaseAbs, normalized);
  if (existsSync(baseCandidate)) {
    return baseCandidate;
  }

  return resolveSharedFrameworkAssetAbs(normalized);
}
