import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { writeProjectClaudeScaffoldPackage } from '../../shared/project-claude-scaffold-package.mjs';
import {
  PROJECT_LOCAL_FRAMEWORK_CLI_REL,
  formatProjectFrameworkCliCommand,
  renderProjectFrameworkCliSource,
} from '../project-cli-shim.mjs';
import {
  FRAMEWORK_ROOT,
  LONG_DECK_BATCH_SIZE,
  LONG_DECK_OUTLINE_THRESHOLD,
  PROJECT_FRAMEWORK_BASE_DIRNAME,
  PROJECT_FRAMEWORK_OVERRIDES_DIRNAME,
  PROJECT_SYSTEM_DIRNAME,
  createProjectMetadata,
  createProjectRef,
  getProjectSystemPaths,
  parsePresentationTargetCliArgs,
  slugifyProjectName,
  slugToTitle,
} from '../deck-paths.js';
import {
  writePresentationPackageManifest,
} from '../presentation-package.js';
import { writeInitialPresentationIntent } from '../presentation-intent.js';
import { ensurePresentationRuntimeStateFiles } from '../presentation-runtime-state.js';

function assertSupportedV1SlideCount(slideCount) {
  if (!Number.isSafeInteger(slideCount) || slideCount < 1 || slideCount > LONG_DECK_OUTLINE_THRESHOLD) {
    throw new Error(
      `Shell-less v1 init currently supports 1-${LONG_DECK_OUTLINE_THRESHOLD} slides. Long-deck scaffolds are not supported yet.`
    );
  }

  return slideCount;
}

export function parseNewDeckCliArgs(argv) {
  let slideCount = 3;
  let copyFramework = false;
  const cleaned = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--copy-framework') {
      copyFramework = true;
      continue;
    }

    if (arg !== '--slides') {
      cleaned.push(arg);
      continue;
    }

    const rawValue = argv[i + 1] || '';
    if (!rawValue || rawValue.startsWith('--')) {
      throw new Error('Missing value for --slides <count>.');
    }

    if (!/^\d+$/.test(rawValue)) {
      throw new Error('--slides <count> must be a whole number.');
    }

    slideCount = assertSupportedV1SlideCount(Number.parseInt(rawValue, 10));

    i += 1;
  }

  const parsed = parsePresentationTargetCliArgs(cleaned);
  return {
    target: parsed.target,
    rest: parsed.rest,
    slideCount,
    copyFramework,
  };
}

function formatSlidePrefix(index) {
  return String((index + 1) * 10).padStart(3, '0');
}

function createSlidePlan(slideCount) {
  if (slideCount === 1) {
    return [{
      dirName: '010-intro',
      templatePath: 'slides/010-hero/slide.html',
      slideLabel: '01',
    }];
  }

  if (slideCount === 2) {
    return [
      {
        dirName: '010-intro',
        templatePath: 'slides/010-hero/slide.html',
        slideLabel: '01',
      },
      {
        dirName: '020-close',
        templatePath: 'slides/030-close/slide.html',
        slideLabel: '02',
      },
    ];
  }

  if (slideCount === 3) {
    return [
      {
        dirName: '010-intro',
        templatePath: 'slides/010-hero/slide.html',
        slideLabel: '01',
      },
      {
        dirName: '020-slide-02',
        templatePath: 'slides/generic/slide.html',
        slideLabel: '02',
      },
      {
        dirName: '030-close',
        templatePath: 'slides/030-close/slide.html',
        slideLabel: '03',
      },
    ];
  }

  const slides = [];
  for (let index = 0; index < slideCount; index += 1) {
    const prefix = formatSlidePrefix(index);
    const slideNumber = String(index + 1).padStart(2, '0');

    if (index === 0) {
      slides.push({
        dirName: `${prefix}-intro`,
        templatePath: 'slides/010-hero/slide.html',
        slideLabel: slideNumber,
      });
      continue;
    }

    if (index === slideCount - 1) {
      slides.push({
        dirName: `${prefix}-close`,
        templatePath: 'slides/030-close/slide.html',
        slideLabel: slideNumber,
      });
      continue;
    }

    slides.push({
      dirName: `${prefix}-slide-${slideNumber}`,
      templatePath: 'slides/generic/slide.html',
      slideLabel: slideNumber,
    });
  }

  return slides;
}

function getSlidePlanMarkdown(slidePlan) {
  return slidePlan
    .map((slide, index) => `- ${String(index + 1).padStart(2, '0')}. \`${slide.dirName}\` -> [[TODO_SLIDE_${slide.slideLabel}_PURPOSE]]`)
    .join('\n');
}

function copyFrameworkSnapshot(projectPaths) {
  const copyTargets = [
    ['framework/canvas', `${PROJECT_FRAMEWORK_BASE_DIRNAME}/canvas`],
    ['framework/client', `${PROJECT_FRAMEWORK_BASE_DIRNAME}/client`],
    ['framework/runtime', `${PROJECT_FRAMEWORK_BASE_DIRNAME}/runtime`],
    ['framework/templates', `${PROJECT_FRAMEWORK_BASE_DIRNAME}/templates`],
  ];

  for (const [sourceRel, targetRel] of copyTargets) {
    cpSync(resolve(FRAMEWORK_ROOT, sourceRel), resolve(projectPaths.frameworkDirAbs, targetRel), {
      recursive: true,
    });
  }

  for (const overrideDir of ['client', 'runtime', 'templates']) {
    mkdirSync(resolve(projectPaths.frameworkOverridesAbs, overrideDir), { recursive: true });
  }
}

export function ensureEmptyDirectory(absPath, label) {
  if (!existsSync(absPath)) {
    mkdirSync(absPath, { recursive: true });
    return;
  }

  const entries = readdirSync(absPath);
  if (entries.length > 0) {
    throw new Error(`${label} already exists and is not empty: ${absPath}`);
  }
}

function createPendingProjectPaths(projectRootInput) {
  const ref = createProjectRef(projectRootInput);
  const slug = slugifyProjectName(ref.projectRootAbs.split(/[\\/]/).pop());
  const systemPaths = getProjectSystemPaths(ref.projectRootAbs);

  return {
    kind: 'project',
    projectRootAbs: ref.projectRootAbs,
    projectRootDisplay: ref.projectRootAbs,
    slug,
    title: slugToTitle(slug),
    sourceDirAbs: ref.projectRootAbs,
    sourceDirDisplay: ref.projectRootAbs,
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
    intentRel: `${PROJECT_SYSTEM_DIRNAME}/intent.json`,
    intentAbs: resolve(systemPaths.systemDirAbs, 'intent.json'),
    packageManifestRel: `${PROJECT_SYSTEM_DIRNAME}/package.generated.json`,
    packageManifestAbs: resolve(systemPaths.systemDirAbs, 'package.generated.json'),
    runtimeDirRel: `${PROJECT_SYSTEM_DIRNAME}/runtime`,
    runtimeDirAbs: resolve(systemPaths.systemDirAbs, 'runtime'),
    renderStateRel: `${PROJECT_SYSTEM_DIRNAME}/runtime/render-state.json`,
    renderStateAbs: systemPaths.renderStateAbs,
    artifactsRel: `${PROJECT_SYSTEM_DIRNAME}/runtime/artifacts.json`,
    artifactsAbs: systemPaths.artifactsAbs,
    metadataRel: `${PROJECT_SYSTEM_DIRNAME}/project.json`,
    metadataAbs: systemPaths.metadataAbs,
    frameworkDirAbs: systemPaths.frameworkDirAbs,
    frameworkBaseRel: `${PROJECT_SYSTEM_DIRNAME}/framework/base`,
    frameworkBaseAbs: systemPaths.frameworkBaseAbs,
    frameworkOverridesRel: `${PROJECT_SYSTEM_DIRNAME}/framework/overrides`,
    frameworkOverridesAbs: systemPaths.frameworkOverridesAbs,
  };
}

function initializeProjectGitDirectory(projectRoot) {
  const gitDirRel = '.git';
  const gitDirAbs = resolve(projectRoot, gitDirRel);

  try {
    execFileSync('git', ['init'], {
      cwd: projectRoot,
      stdio: 'ignore',
    });

    return {
      status: existsSync(gitDirAbs) ? 'initialized' : 'missing',
      path: gitDirRel,
    };
  } catch (error) {
    return {
      status: existsSync(gitDirAbs) ? 'initialized' : 'unavailable',
      path: gitDirRel,
      error: error?.message || 'git init failed',
    };
  }
}

function scaffoldIntoPaths(paths, options = {}) {
  const {
    slideCount,
    copyFramework = false,
    frameworkRoot,
  } = options;
  const templatesDir = resolve(FRAMEWORK_ROOT, 'framework', 'templates');
  const deckTitle = slugToTitle(paths.slug);
  const slidePlan = createSlidePlan(slideCount);
  const outlineRequired = slideCount > LONG_DECK_OUTLINE_THRESHOLD;
  const replacements = new Map([
    ['{{DECK_SLUG}}', paths.slug],
    ['{{DECK_TITLE}}', deckTitle],
    ['{{SLIDE_COUNT}}', String(slideCount)],
    ['{{SLIDE_BATCH_SIZE}}', String(LONG_DECK_BATCH_SIZE)],
    ['{{SLIDE_PLAN}}', getSlidePlanMarkdown(slidePlan)],
  ]);

  function renderTemplate(filename, extraReplacements = new Map()) {
    let content = readFileSync(resolve(templatesDir, filename), 'utf-8');
    for (const [needle, value] of replacements) {
      content = content.replaceAll(needle, value);
    }
    for (const [needle, value] of extraReplacements) {
      content = content.replaceAll(needle, value);
    }
    return content;
  }

  mkdirSync(paths.sourceDirAbs, { recursive: true });
  mkdirSync(paths.assetsDirAbs, { recursive: true });
  mkdirSync(paths.slidesDirAbs, { recursive: true });

  writeFileSync(paths.themeCssAbs, renderTemplate('theme.css'));
  writeFileSync(paths.briefAbs, renderTemplate('brief.md'));
  writeFileSync(resolve(paths.assetsDirAbs, '.gitkeep'), '');

  for (const slide of slidePlan) {
    const targetPath = resolve(paths.slidesDirAbs, slide.dirName, 'slide.html');
    mkdirSync(dirname(targetPath), { recursive: true });
    writeFileSync(
      targetPath,
      renderTemplate(slide.templatePath, new Map([
        ['{{SLIDE_LABEL}}', slide.slideLabel],
        ['{{SLIDE_DIR_NAME}}', slide.dirName],
      ]))
    );
  }

  const systemPaths = getProjectSystemPaths(paths.sourceDirAbs);
  mkdirSync(systemPaths.systemDirAbs, { recursive: true });
  mkdirSync(resolve(systemPaths.systemDirAbs, 'runtime'), { recursive: true });
  if (copyFramework) {
    mkdirSync(systemPaths.frameworkDirAbs, { recursive: true });
    mkdirSync(systemPaths.frameworkBaseAbs, { recursive: true });
    mkdirSync(systemPaths.frameworkOverridesAbs, { recursive: true });
  }
  writeFileSync(resolve(paths.sourceDirAbs, PROJECT_LOCAL_FRAMEWORK_CLI_REL), renderProjectFrameworkCliSource());
  const metadata = createProjectMetadata(paths.sourceDirAbs, {
    frameworkMode: copyFramework ? 'copied' : 'linked',
    overrides: {
      projectName: deckTitle,
    },
  });
  writeFileSync(systemPaths.metadataAbs, `${JSON.stringify(metadata, null, 2)}\n`);
  writeInitialPresentationIntent(paths.sourceDirAbs);
  writePresentationPackageManifest(paths.sourceDirAbs);
  ensurePresentationRuntimeStateFiles(paths.sourceDirAbs);
  if (copyFramework) {
    copyFrameworkSnapshot(paths);
  }

  const createdFiles = [
    paths.themeCssRel,
    paths.briefRel,
    `${paths.assetsDirRel}/`,
  ];

  createdFiles.push(paths.metadataRel);
  createdFiles.push(paths.intentRel);
  createdFiles.push(paths.packageManifestRel);
  createdFiles.push(paths.runtimeDirRel);
  createdFiles.push(paths.renderStateRel);
  createdFiles.push(paths.artifactsRel);
  createdFiles.push(PROJECT_LOCAL_FRAMEWORK_CLI_REL);
  if (copyFramework) {
    createdFiles.push(paths.frameworkBaseRel);
    createdFiles.push(paths.frameworkOverridesRel);
  }

  for (const slide of slidePlan) {
    createdFiles.push(`${paths.slidesDirRel}/${slide.dirName}/slide.html`);
  }

  const nextSteps = [
    `Open ${paths.briefRel} and replace every [[TODO_...]] marker with the user's plain-English brief.`,
    `Edit ${paths.themeCssRel} and the slide fragments under ${paths.slidesDirRel}/ to build the deck.`,
    `Use ${formatProjectFrameworkCliCommand('inspect')} and ${formatProjectFrameworkCliCommand('status')} to review package state as you work.`,
    `Run ${formatProjectFrameworkCliCommand('audit', 'all')} after meaningful edits.`,
  ];

  const gitignoreContent = [
    'outputs/',
    'node_modules/',
    '.DS_Store',
    'Thumbs.db',
    '',
  ].join('\n');
  writeFileSync(resolve(paths.sourceDirAbs, '.gitignore'), gitignoreContent);
  createdFiles.push('.gitignore');

  const agentPackage = writeProjectClaudeScaffoldPackage(paths.sourceDirAbs, {
    frameworkRoot: frameworkRoot || FRAMEWORK_ROOT,
  });
  createdFiles.push(...agentPackage.createdPaths);

  const git = initializeProjectGitDirectory(paths.sourceDirAbs);

  return {
    status: 'created',
    targetKind: 'project',
    deck: paths.slug,
    sourceDir: paths.sourceDirDisplay,
    slideCount,
    outlineRequired,
    frameworkMode: copyFramework ? 'copied' : 'linked',
    files: [...new Set(createdFiles)],
    nextSteps,
    git,
  };
}

export function createPresentationScaffold(targetInput, options = {}) {
  const {
    slideCount = 3,
    copyFramework = false,
  } = options;
  const validatedSlideCount = assertSupportedV1SlideCount(slideCount);
  const projectPaths = createPendingProjectPaths(targetInput.projectRootAbs || targetInput.projectRoot || targetInput);
  ensureEmptyDirectory(projectPaths.sourceDirAbs, 'Project folder');
  return scaffoldIntoPaths(projectPaths, {
    slideCount: validatedSlideCount,
    copyFramework,
    frameworkRoot: options.frameworkRoot,
  });
}
