import { existsSync, readdirSync, readFileSync } from 'fs';
import { basename, isAbsolute, relative, resolve, sep } from 'path';

export const REPO_ROOT = resolve(import.meta.dirname, '../..');
export const FRAMEWORK_ROOT = REPO_ROOT;
export const LONG_DECK_OUTLINE_THRESHOLD = 10;
export const LONG_DECK_BATCH_SIZE = 5;
export const PROJECT_SYSTEM_DIRNAME = '.presentation';
export const PROJECT_METADATA_FILENAME = 'project.json';
export const PROJECT_FRAMEWORK_DIRNAME = 'framework';
export const PROJECT_FRAMEWORK_BASE_DIRNAME = 'base';
export const PROJECT_FRAMEWORK_OVERRIDES_DIRNAME = 'overrides';
export const PROJECT_PREVIEW_PATH = '/preview/';

const WORKSPACE_NAME_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const VALID_OWNER_TYPES = new Set(['deck', 'example']);
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

function assertWorkspaceName(name, label = 'Workspace name') {
  if (typeof name !== 'string' || !WORKSPACE_NAME_RE.test(name)) {
    throw new Error(
      `${label} must use lowercase letters, numbers, and hyphens only (example: q4-investor-update).`
    );
  }

  return name;
}

function normalizeSlashPath(value) {
  return value.split(sep).join('/');
}

export function assertDeckSlug(slug) {
  return assertWorkspaceName(slug, 'Deck slug');
}

export function assertExampleName(name) {
  return assertWorkspaceName(name, 'Example name');
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

export function createWorkspaceRef(ownerType, ownerName) {
  if (!VALID_OWNER_TYPES.has(ownerType)) {
    throw new Error('Workspace owner type must be "deck" or "example".');
  }

  return {
    kind: 'workspace',
    ownerType,
    ownerName: ownerType === 'deck'
      ? assertDeckSlug(ownerName)
      : assertExampleName(ownerName),
  };
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

  if (input.kind === 'workspace' || input.ownerType) {
    return createWorkspaceRef(input.ownerType, input.ownerName);
  }

  throw new Error('Presentation target must be a workspace or project reference.');
}

export function getWorkspaceId(ref) {
  const normalized = createWorkspaceRef(ref.ownerType, ref.ownerName);
  return normalized.ownerType === 'deck'
    ? `decks/${normalized.ownerName}`
    : `examples/${normalized.ownerName}`;
}

export function getWorkspacePreviewPath(ref) {
  const normalized = createWorkspaceRef(ref.ownerType, ref.ownerName);
  return normalized.ownerType === 'deck'
    ? `/decks/${normalized.ownerName}/`
    : `/examples/${normalized.ownerName}/`;
}

function getWorkspacePaths(rootDir, name, ownerType) {
  const ref = createWorkspaceRef(ownerType, name);
  const sourceDirRel = ref.ownerType === 'deck'
    ? `decks/${ref.ownerName}`
    : `examples/${ref.ownerName}`;
  const sourceDirAbs = resolve(REPO_ROOT, sourceDirRel);

  return {
    kind: 'workspace',
    ownerType: ref.ownerType,
    ownerName: ref.ownerName,
    slug: ref.ownerName,
    title: slugToTitle(ref.ownerName),
    sourceDirRel,
    sourceDirAbs,
    sourceDirDisplay: sourceDirRel,
    previewPath: getWorkspacePreviewPath(ref),
    themeCssRel: `${sourceDirRel}/theme.css`,
    themeCssAbs: resolve(sourceDirAbs, 'theme.css'),
    briefRel: `${sourceDirRel}/brief.md`,
    briefAbs: resolve(sourceDirAbs, 'brief.md'),
    outlineRel: `${sourceDirRel}/outline.md`,
    outlineAbs: resolve(sourceDirAbs, 'outline.md'),
    revisionsRel: `${sourceDirRel}/revisions.md`,
    revisionsAbs: resolve(sourceDirAbs, 'revisions.md'),
    assetsDirRel: `${sourceDirRel}/assets`,
    assetsDirAbs: resolve(sourceDirAbs, 'assets'),
    slidesDirRel: `${sourceDirRel}/slides`,
    slidesDirAbs: resolve(sourceDirAbs, 'slides'),
    outputsDirRel: ref.ownerType === 'deck' ? `outputs/${ref.ownerName}` : '',
    outputsDirAbs: ref.ownerType === 'deck' ? resolve(REPO_ROOT, 'outputs', ref.ownerName) : '',
    buildDisplayPath(absPath) {
      return toRepoRelative(absPath);
    },
    buildProjectFilePreviewPath(absPath) {
      return `/${toRepoRelative(absPath)}`;
    },
    buildFrameworkPreviewPath(relativePath) {
      return `/framework/${normalizeRepoRelativePath(relativePath)}`;
    },
  };
}

export function getDeckWorkspacePaths(slug) {
  return getWorkspacePaths('decks', slug, 'deck');
}

export function getExampleWorkspacePaths(name) {
  return getWorkspacePaths('examples', name, 'example');
}

export function getOwnedWorkspacePaths(ownerType, name) {
  return ownerType === 'deck'
    ? getDeckWorkspacePaths(name)
    : getExampleWorkspacePaths(name);
}

export function getWorkspacePathsFromRef(ref) {
  const normalized = createWorkspaceRef(ref.ownerType, ref.ownerName);
  return getOwnedWorkspacePaths(normalized.ownerType, normalized.ownerName);
}

export function getProjectSystemPaths(projectRootInput) {
  const ref = createProjectRef(projectRootInput);
  const systemDirAbs = resolve(ref.projectRootAbs, PROJECT_SYSTEM_DIRNAME);
  const metadataAbs = resolve(systemDirAbs, PROJECT_METADATA_FILENAME);
  const frameworkDirAbs = resolve(systemDirAbs, PROJECT_FRAMEWORK_DIRNAME);
  const frameworkBaseAbs = resolve(frameworkDirAbs, PROJECT_FRAMEWORK_BASE_DIRNAME);
  const frameworkOverridesAbs = resolve(frameworkDirAbs, PROJECT_FRAMEWORK_OVERRIDES_DIRNAME);

  return {
    projectRootAbs: ref.projectRootAbs,
    systemDirAbs,
    metadataAbs,
    frameworkDirAbs,
    frameworkBaseAbs,
    frameworkOverridesAbs,
  };
}

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
    revisionsRel: 'revisions.md',
    revisionsAbs: resolve(ref.projectRootAbs, 'revisions.md'),
    assetsDirRel: 'assets',
    assetsDirAbs: resolve(ref.projectRootAbs, 'assets'),
    slidesDirRel: 'slides',
    slidesDirAbs: resolve(ref.projectRootAbs, 'slides'),
    outputsDirRel: 'outputs',
    outputsDirAbs: resolve(ref.projectRootAbs, 'outputs'),
    systemDirRel: PROJECT_SYSTEM_DIRNAME,
    systemDirAbs: systemPaths.systemDirAbs,
    metadataRel: `${PROJECT_SYSTEM_DIRNAME}/${PROJECT_METADATA_FILENAME}`,
    metadataAbs: systemPaths.metadataAbs,
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

export function parseWorkspaceRefPath(input) {
  const normalized = normalizeRepoRelativePath(input);
  let match = normalized.match(/^decks\/([^/]+)$/);
  if (match) {
    return createWorkspaceRef('deck', match[1]);
  }

  match = normalized.match(/^examples\/([^/]+)$/);
  if (match) {
    return createWorkspaceRef('example', match[1]);
  }

  return null;
}

export function parsePresentationTargetCliArgs(argv, options = {}) {
  const {
    allowWorkspace = true,
    allowProject = true,
    requireTarget = true,
  } = options;

  let deck = '';
  let example = '';
  let project = '';
  const rest = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--deck') {
      const value = argv[i + 1] || '';
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --deck <slug>.');
      }
      deck = value;
      i += 1;
      continue;
    }
    if (arg === '--example') {
      const value = argv[i + 1] || '';
      if (!value || value.startsWith('--')) {
        throw new Error('Missing value for --example <name>.');
      }
      example = value;
      i += 1;
      continue;
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

  const targets = [deck, example, project].filter(Boolean);
  if (targets.length > 1) {
    throw new Error('Pass only one of --project /abs/path, --deck <slug>, or --example <name>.');
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

  if (deck) {
    if (!allowWorkspace) {
      throw new Error('This command does not support --deck <slug>.');
    }

    return {
      target: createWorkspaceRef('deck', deck),
      rest,
    };
  }

  if (example) {
    if (!allowWorkspace) {
      throw new Error('This command does not support --example <name>.');
    }

    return {
      target: createWorkspaceRef('example', example),
      rest,
    };
  }

  if (requireTarget) {
    throw new Error('Usage: pass --project /abs/path, --deck <slug>, or --example <name>.');
  }

  return {
    target: null,
    rest,
  };
}

export function parseWorkspaceCliArgs(argv) {
  const parsed = parsePresentationTargetCliArgs(argv, {
    allowWorkspace: true,
    allowProject: false,
    requireTarget: true,
  });

  return {
    workspaceRef: parsed.target,
    rest: parsed.rest,
  };
}

export function getDeckOutputPaths(slug) {
  const safeSlug = assertDeckSlug(slug);
  const outputDirRel = `outputs/${safeSlug}`;
  const outputDirAbs = resolve(REPO_ROOT, outputDirRel);

  return {
    slug: safeSlug,
    outputDirRel,
    outputDirAbs,
    pdfRel: `${outputDirRel}/deck.pdf`,
    pdfAbs: resolve(outputDirAbs, 'deck.pdf'),
    reportRel: `${outputDirRel}/report.json`,
    reportAbs: resolve(outputDirAbs, 'report.json'),
    fullPageRel: `${outputDirRel}/full-page.png`,
    fullPageAbs: resolve(outputDirAbs, 'full-page.png'),
    slidesDirRel: `${outputDirRel}/slides`,
    slidesDirAbs: resolve(outputDirAbs, 'slides'),
    summaryRel: `${outputDirRel}/summary.md`,
    summaryAbs: resolve(outputDirAbs, 'summary.md'),
  };
}

export function getProjectOutputPaths(projectRootInput) {
  const paths = getProjectPaths(projectRootInput);
  return {
    slug: paths.slug,
    outputDirRel: paths.outputsDirRel,
    outputDirAbs: paths.outputsDirAbs,
    pdfRel: `${paths.outputsDirRel}/deck.pdf`,
    pdfAbs: resolve(paths.outputsDirAbs, 'deck.pdf'),
    reportRel: `${paths.outputsDirRel}/report.json`,
    reportAbs: resolve(paths.outputsDirAbs, 'report.json'),
    fullPageRel: `${paths.outputsDirRel}/full-page.png`,
    fullPageAbs: resolve(paths.outputsDirAbs, 'full-page.png'),
    slidesDirRel: `${paths.outputsDirRel}/slides`,
    slidesDirAbs: resolve(paths.outputsDirAbs, 'slides'),
    summaryRel: `${paths.outputsDirRel}/summary.md`,
    summaryAbs: resolve(paths.outputsDirAbs, 'summary.md'),
  };
}

export function slugToTitle(slug) {
  return slugifyProjectName(slug)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getSuggestedPdfName(target) {
  const normalized = createPresentationTarget(target);
  if (normalized.kind === 'project') {
    return `${getProjectPaths(normalized.projectRootAbs).slug}.pdf`;
  }

  return `${normalized.ownerName}.pdf`;
}

export function getPresentationId(target) {
  const normalized = createPresentationTarget(target);
  if (normalized.kind === 'project') {
    return `project:${normalized.projectRootAbs}`;
  }

  return getWorkspaceId(normalized);
}

export function getPresentationPreviewPath(target) {
  const normalized = createPresentationTarget(target);
  if (normalized.kind === 'project') {
    return PROJECT_PREVIEW_PATH;
  }

  return getWorkspacePreviewPath(normalized);
}

export function getPresentationPaths(target) {
  const normalized = createPresentationTarget(target);
  if (normalized.kind === 'project') {
    return getProjectPaths(normalized.projectRootAbs);
  }

  return getWorkspacePathsFromRef(normalized);
}

export function getPresentationOutputPaths(target) {
  const normalized = createPresentationTarget(target);
  if (normalized.kind === 'project') {
    return getProjectOutputPaths(normalized.projectRootAbs);
  }

  if (normalized.ownerType !== 'deck') {
    throw new Error('Only deck workspaces and project folders have canonical output paths.');
  }

  return getDeckOutputPaths(normalized.ownerName);
}

function resolveSharedFrameworkAssetAbs(relativePath) {
  const normalized = normalizeRepoRelativePath(relativePath);
  const [bucket, ...rest] = normalized.split('/');
  if (rest.length === 0) {
    throw new Error(`Unsupported shared framework path: ${relativePath}`);
  }

  if (bucket === 'canvas' || bucket === 'client' || bucket === 'runtime') {
    return resolve(REPO_ROOT, 'framework', bucket, ...rest);
  }

  if (bucket === 'templates' || bucket === 'prompts' || bucket === 'specs') {
    return resolve(REPO_ROOT, bucket, ...rest);
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

function listWorkspaceIndex(rootDir, ownerType) {
  const absRoot = resolve(REPO_ROOT, rootDir);
  if (!existsSync(absRoot)) {
    return [];
  }

  return readdirSync(absRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      let ref;
      try {
        ref = createWorkspaceRef(ownerType, entry.name);
      } catch (err) {
        console.warn(`[index] Skipping invalid ${ownerType} workspace "${rootDir}/${entry.name}": ${err.message}`);
        return null;
      }

      const paths = getWorkspacePathsFromRef(ref);
      if (!existsSync(paths.slidesDirAbs)) {
        return null;
      }

      return {
        ownerType: ref.ownerType,
        slug: ref.ownerName,
        label: slugToTitle(ref.ownerName),
        workspaceId: getWorkspaceId(ref),
        previewHref: getWorkspacePreviewPath(ref),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function listExampleDecks() {
  return listWorkspaceIndex('examples', 'example');
}

export function listWorkspaceDecks() {
  return listWorkspaceIndex('decks', 'deck');
}
