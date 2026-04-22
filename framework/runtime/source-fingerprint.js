import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

function collectFingerprintFiles(projectRootAbs, relativePath, files) {
  const targetAbs = resolve(projectRootAbs, relativePath);
  const stats = statSync(targetAbs, { throwIfNoEntry: false });
  if (!stats) {
    return;
  }

  if (stats.isDirectory()) {
    const entries = readdirSync(targetAbs, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const childRel = `${relativePath}/${entry.name}`;
      if (entry.isDirectory()) {
        collectFingerprintFiles(projectRootAbs, childRel, files);
      } else if (entry.isFile()) {
        files.push(childRel);
      }
    }
    return;
  }

  if (stats.isFile()) {
    files.push(relativePath);
  }
}

export function computeFileFingerprint(absPath) {
  const stats = statSync(absPath, { throwIfNoEntry: false });
  if (!stats || !stats.isFile()) {
    return '';
  }

  const hash = createHash('sha256');
  hash.update(readFileSync(absPath));
  return `sha256:${hash.digest('hex')}`;
}

export function computePathFingerprint(projectRootAbs, relativePath) {
  const files = [];
  collectFingerprintFiles(projectRootAbs, relativePath, files);
  files.sort();

  if (files.length === 0) {
    return '';
  }

  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`${file}\n`);
    hash.update(readFileSync(resolve(projectRootAbs, file)));
    hash.update('\n');
  }

  return `sha256:${hash.digest('hex')}`;
}

export function computeSourceFingerprint(projectRootAbs) {
  const hash = createHash('sha256');
  const files = [];
  const roots = [
    'brief.md',
    'outline.md',
    'theme.css',
    'assets',
    'slides',
    '.presentation/intent.json',
    '.presentation/framework/base',
    '.presentation/framework/overrides',
  ];

  for (const relativePath of roots) {
    collectFingerprintFiles(projectRootAbs, relativePath, files);
  }

  files.sort();
  for (const relativePath of files) {
    hash.update(`${relativePath}\n`);
    hash.update(readFileSync(resolve(projectRootAbs, relativePath)));
    hash.update('\n');
  }

  return `sha256:${hash.digest('hex')}`;
}
