#!/usr/bin/env node

// Claude Code Stop hook — runs quality checks after Claude finishes responding.
// If warnings are found, exits 2 with fix instructions so Claude continues fixing.
// If clean (0 warnings), auto-commits the current state for edit history.

import { readFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve } from 'path';

// Read hook input from stdin
let input = '';
for await (const chunk of process.stdin) input += chunk;

let parsed;
try { parsed = JSON.parse(input); } catch { process.exit(0); }

// Determine the project root
const projectRoot = parsed?.cwd || process.cwd();

// Only run if this is a presentation project (has .presentation/project.json)
const metadataPath = resolve(projectRoot, '.presentation', 'project.json');
if (!existsSync(metadataPath)) {
  process.exit(0);
}

// Only run if slides exist
const slidesDir = resolve(projectRoot, 'slides');
if (!existsSync(slidesDir)) {
  process.exit(0);
}

// Find the framework root from project metadata
let frameworkRoot = '';
try {
  const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
  frameworkRoot = metadata.frameworkSource || '';
} catch { process.exit(0); }

const qualityPath = resolve(frameworkRoot, 'framework', 'runtime', 'deck-quality.js');
if (!frameworkRoot || !existsSync(qualityPath)) {
  process.exit(0);
}

// Import quality checker from the framework
const qualityMod = await import(qualityPath);
const sourceMod = await import(resolve(frameworkRoot, 'framework', 'runtime', 'deck-source.js'));
const pathsMod = await import(resolve(frameworkRoot, 'framework', 'runtime', 'deck-paths.js'));

const paths = pathsMod.getProjectPaths(projectRoot);
const entries = sourceMod.listSlideSourceEntries(paths).filter((e) => e.isValidName);

// Skip if no valid slides yet (still scaffolding)
if (entries.length === 0) {
  process.exit(0);
}

const result = qualityMod.checkDeckQuality(entries);

if (result.warnings.length === 0) {
  // Clean pass — auto-commit for edit history
  try {
    const gitOpts = { cwd: projectRoot, stdio: 'pipe' };
    execFileSync('git', ['add', '-A'], gitOpts);

    // Check if there are staged changes
    try {
      execFileSync('git', ['diff', '--cached', '--quiet'], gitOpts);
      // Exit 0 = no changes staged, nothing to commit
    } catch {
      // Exit 1 = changes staged, commit them
      // Build commit message from changed files
      const diff = execFileSync('git', ['diff', '--cached', '--name-only'], gitOpts).toString().trim();
      const changed = diff.split('\n').filter(Boolean);
      const summary = changed.length <= 3
        ? changed.join(', ')
        : `${changed.slice(0, 3).join(', ')} +${changed.length - 3} more`;
      execFileSync('git', ['commit', '-m', `Update: ${summary}`], gitOpts);
    }
  } catch {
    // git not available or not initialized — skip silently
  }

  process.exit(0);
}

// Print warnings to stderr — Claude reads this as feedback and keeps working
for (const w of result.warnings) {
  process.stderr.write(`\n⚠ ${w.rule} [${w.slideId}]\n  ${w.message}\n  Fix: ${w.fix}\n`);
}
process.stderr.write(`\n${result.warnings.length} quality warning(s). Fix them before stopping.\n`);
process.exit(2);
