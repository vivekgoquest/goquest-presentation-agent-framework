import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import {
  FRAMEWORK_ROOT,
  LONG_DECK_BATCH_SIZE,
  LONG_DECK_OUTLINE_THRESHOLD,
  PROJECT_FRAMEWORK_BASE_DIRNAME,
  PROJECT_FRAMEWORK_OVERRIDES_DIRNAME,
  PROJECT_SYSTEM_DIRNAME,
  createProjectMetadata,
  createProjectRef,
  getDeckWorkspacePaths,
  getProjectSystemPaths,
  parsePresentationTargetCliArgs,
  slugifyProjectName,
  slugToTitle,
} from './deck-paths.js';

function parseNewDeckArgs(argv) {
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

    slideCount = Number.parseInt(rawValue, 10);
    if (!Number.isSafeInteger(slideCount) || slideCount < 1 || slideCount > 99) {
      throw new Error('--slides <count> must stay between 1 and 99.');
    }

    i += 1;
  }

  const parsed = parsePresentationTargetCliArgs(cleaned);
  return { parsed, slideCount, copyFramework };
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
    ['templates', `${PROJECT_FRAMEWORK_BASE_DIRNAME}/templates`],
    ['prompts', `${PROJECT_FRAMEWORK_BASE_DIRNAME}/prompts`],
    ['specs', `${PROJECT_FRAMEWORK_BASE_DIRNAME}/specs`],
  ];

  for (const [sourceRel, targetRel] of copyTargets) {
    cpSync(resolve(FRAMEWORK_ROOT, sourceRel), resolve(projectPaths.frameworkDirAbs, targetRel), {
      recursive: true,
    });
  }

  for (const overrideDir of ['client', 'runtime', 'templates', 'prompts', 'specs']) {
    mkdirSync(resolve(projectPaths.frameworkOverridesAbs, overrideDir), { recursive: true });
  }
}

function ensureEmptyDirectory(absPath, label) {
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
    revisionsRel: 'revisions.md',
    revisionsAbs: resolve(ref.projectRootAbs, 'revisions.md'),
    assetsDirRel: 'assets',
    assetsDirAbs: resolve(ref.projectRootAbs, 'assets'),
    slidesDirRel: 'slides',
    slidesDirAbs: resolve(ref.projectRootAbs, 'slides'),
    outputsDirRel: 'outputs',
    outputsDirAbs: resolve(ref.projectRootAbs, 'outputs'),
    metadataRel: `${PROJECT_SYSTEM_DIRNAME}/project.json`,
    metadataAbs: systemPaths.metadataAbs,
    frameworkDirAbs: systemPaths.frameworkDirAbs,
    frameworkBaseRel: `${PROJECT_SYSTEM_DIRNAME}/framework/base`,
    frameworkBaseAbs: systemPaths.frameworkBaseAbs,
    frameworkOverridesRel: `${PROJECT_SYSTEM_DIRNAME}/framework/overrides`,
    frameworkOverridesAbs: systemPaths.frameworkOverridesAbs,
  };
}

function scaffoldIntoPaths(paths, options = {}) {
  const {
    slideCount,
    copyFramework = false,
  } = options;
  const templatesDir = resolve(FRAMEWORK_ROOT, 'templates');
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
  mkdirSync(paths.outputsDirAbs, { recursive: true });

  // Copy Claude Code hooks into the project so they activate when the user runs `claude`
  const claudeDir = resolve(paths.sourceDirAbs, '.claude');
  const claudeHooksDir = resolve(claudeDir, 'hooks');
  mkdirSync(claudeHooksDir, { recursive: true });
  cpSync(resolve(FRAMEWORK_ROOT, 'templates', 'claude-settings.json'), resolve(claudeDir, 'settings.json'));
  cpSync(resolve(FRAMEWORK_ROOT, 'templates', 'claude-hooks', 'check-slide-quality.mjs'), resolve(claudeHooksDir, 'check-slide-quality.mjs'));

  writeFileSync(paths.themeCssAbs, renderTemplate('theme.css'));
  writeFileSync(paths.briefAbs, renderTemplate('brief.md'));
  writeFileSync(paths.revisionsAbs, renderTemplate('revisions.md'));
  writeFileSync(resolve(paths.assetsDirAbs, '.gitkeep'), '');
  writeFileSync(resolve(paths.outputsDirAbs, '.gitkeep'), '');

  if (outlineRequired) {
    writeFileSync(paths.outlineAbs, renderTemplate('outline.md'));
  }

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
  if (paths.kind === 'project') {
    mkdirSync(systemPaths.systemDirAbs, { recursive: true });
    mkdirSync(systemPaths.frameworkDirAbs, { recursive: true });
    mkdirSync(systemPaths.frameworkBaseAbs, { recursive: true });
    mkdirSync(systemPaths.frameworkOverridesAbs, { recursive: true });
    const metadata = createProjectMetadata(paths.sourceDirAbs, {
      frameworkMode: copyFramework ? 'copied' : 'linked',
      overrides: {
        projectName: deckTitle,
      },
    });
    writeFileSync(systemPaths.metadataAbs, `${JSON.stringify(metadata, null, 2)}\n`);
    if (copyFramework) {
      copyFrameworkSnapshot(paths);
    }
  }

  const createdFiles = [
    paths.themeCssRel,
    paths.briefRel,
    paths.revisionsRel,
    `${paths.assetsDirRel}/`,
    `${paths.outputsDirRel}/`,
    '.claude/settings.json',
    '.claude/hooks/check-slide-quality.mjs',
  ];

  if (paths.kind === 'project') {
    createdFiles.push(paths.metadataRel);
    if (copyFramework) {
      createdFiles.push(paths.frameworkBaseRel);
      createdFiles.push(paths.frameworkOverridesRel);
    }
  }

  if (outlineRequired) {
    createdFiles.push(paths.outlineRel);
  }

  for (const slide of slidePlan) {
    createdFiles.push(`${paths.slidesDirRel}/${slide.dirName}/slide.html`);
  }

  const nextSteps = [
    `Open ${paths.briefRel} and replace every [[TODO_...]] marker with the user's plain-English brief.`,
    `Edit ${paths.themeCssRel} and the slide fragments under ${paths.slidesDirRel}/ to build the deck.`,
    `Preview, check, export, and finalize will stay blocked until ${paths.briefRel} no longer contains TODO markers.`,
    paths.kind === 'project'
      ? `Preview the project at /preview/ with npm run start -- --project ${paths.sourceDirAbs}.`
      : `Preview the virtual deck at /decks/${paths.slug}/ with npm run start.`,
  ];

  if (outlineRequired) {
    nextSteps.splice(1, 0, `Open ${paths.outlineRel}, replace every [[TODO_...]] marker, and lock the full story before slide buildout.`);
    nextSteps.splice(2, 0, `Build ${slideCount} slides in batches of ${LONG_DECK_BATCH_SIZE} and run ${paths.kind === 'project' ? `npm run check -- --project ${paths.sourceDirAbs}` : `npm run check -- --deck ${paths.slug}`} after each batch.`);
  }

  nextSteps.push(paths.kind === 'project'
    ? `Run npm run finalize -- --project ${paths.sourceDirAbs}`
    : `Run npm run finalize -- --deck ${paths.slug}`);

  // Initialize local git repo for edit history
  const gitignoreContent = [
    'outputs/',
    'node_modules/',
    '.DS_Store',
    'Thumbs.db',
    '',
  ].join('\n');
  writeFileSync(resolve(paths.sourceDirAbs, '.gitignore'), gitignoreContent);
  createdFiles.push('.gitignore');

  try {
    const gitOpts = { cwd: paths.sourceDirAbs, stdio: 'ignore' };
    execFileSync('git', ['init'], gitOpts);
    execFileSync('git', ['add', '-A'], gitOpts);
    execFileSync('git', ['commit', '-m', `Scaffold: ${deckTitle}`], gitOpts);
  } catch {
    // git not available — skip silently, edit history is optional
  }

  return {
    status: 'created',
    targetKind: paths.kind,
    deck: paths.slug,
    sourceDir: paths.sourceDirDisplay,
    slideCount,
    outlineRequired,
    frameworkMode: paths.kind === 'project' ? (copyFramework ? 'copied' : 'linked') : 'legacy-workspace',
    files: createdFiles,
    nextSteps,
  };
}

let parsed;
let slideCount;
let copyFramework;
try {
  ({ parsed, slideCount, copyFramework } = parseNewDeckArgs(process.argv.slice(2)));
} catch (err) {
  console.error(`Usage: npm run new -- --project /abs/path [--slides <count>] [--copy-framework] | --deck <slug> [--slides <count>]\n\n${err.message}`);
  process.exit(1);
}

const target = parsed.target;

try {
  if (target.kind === 'workspace') {
    if (target.ownerType !== 'deck') {
      throw new Error('New deck scaffolding only supports --deck <slug> or --project /abs/path.');
    }

    const paths = getDeckWorkspacePaths(target.ownerName);
    if (existsSync(paths.sourceDirAbs)) {
      throw new Error(`Deck workspace already exists: ${paths.sourceDirRel}`);
    }

    console.log(JSON.stringify(scaffoldIntoPaths(paths, { slideCount }), null, 2));
  } else {
    const projectPaths = createPendingProjectPaths(target.projectRootAbs);
    ensureEmptyDirectory(projectPaths.sourceDirAbs, 'Project folder');
    console.log(JSON.stringify(scaffoldIntoPaths(projectPaths, { slideCount, copyFramework }), null, 2));
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
