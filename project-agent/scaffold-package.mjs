import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

function listDirectoryEntries(sourceDirAbs, targetDirRel) {
  const entries = [];
  for (const entry of readdirSync(sourceDirAbs, { withFileTypes: true })) {
    const sourceAbs = resolve(sourceDirAbs, entry.name);
    const targetRel = `${targetDirRel}/${entry.name}`;
    if (entry.isDirectory()) {
      entries.push(...listDirectoryEntries(sourceAbs, targetRel));
      continue;
    }
    entries.push({
      sourceAbs,
      targetRel,
    });
  }
  return entries;
}

export function getProjectAgentScaffoldPackage(options = {}) {
  const frameworkRoot = options.frameworkRoot || process.cwd();
  const projectAgentRoot = resolve(frameworkRoot, 'project-agent');
  const claudeRoot = resolve(projectAgentRoot, 'project-dot-claude');

  const entries = [
    {
      sourceAbs: resolve(projectAgentRoot, 'project-agents-md.md'),
      targetRel: '.claude/AGENTS.md',
    },
    {
      sourceAbs: resolve(claudeRoot, 'settings.json'),
      targetRel: '.claude/settings.json',
    },
    {
      sourceAbs: resolve(projectAgentRoot, 'project-claude-md.md'),
      targetRel: '.claude/CLAUDE.md',
    },
    ...listDirectoryEntries(resolve(claudeRoot, 'hooks'), '.claude/hooks'),
    ...listDirectoryEntries(resolve(claudeRoot, 'rules'), '.claude/rules'),
    ...listDirectoryEntries(resolve(claudeRoot, 'skills'), '.claude/skills'),
  ];

  const requiredPaths = Array.from(new Set([
    '.claude',
    ...entries.flatMap((entry) => {
      const segments = entry.targetRel.split('/');
      const paths = [];
      for (let index = 1; index <= segments.length; index += 1) {
        paths.push(segments.slice(0, index).join('/'));
      }
      return paths;
    }),
  ]));

  return {
    packageRootRel: '.claude',
    entries,
    requiredPaths,
  };
}

export function writeProjectAgentScaffoldPackage(projectRootAbs, options = {}) {
  const scaffoldPackage = getProjectAgentScaffoldPackage(options);
  const createdPaths = [];

  for (const entry of scaffoldPackage.entries) {
    const targetAbs = resolve(projectRootAbs, entry.targetRel);
    mkdirSync(dirname(targetAbs), { recursive: true });
    cpSync(entry.sourceAbs, targetAbs, { recursive: false });
    createdPaths.push(entry.targetRel);
  }

  return {
    ...scaffoldPackage,
    createdPaths,
  };
}
