import { execFileSync } from 'node:child_process';

function buildCommitSummary(projectRoot) {
  const diff = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const changed = diff.split('\n').filter(Boolean);
  if (changed.length === 0) {
    return '';
  }
  if (changed.length <= 3) {
    return changed.join(', ');
  }
  return `${changed.slice(0, 3).join(', ')} +${changed.length - 3} more`;
}

export function checkpointProjectGit(projectRoot) {
  try {
    execFileSync('git', ['add', '-A'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    try {
      execFileSync('git', ['diff', '--cached', '--quiet'], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { committed: false, commit: '' };
    } catch {
      const summary = buildCommitSummary(projectRoot);
      execFileSync('git', ['commit', '-m', `Update: ${summary}`], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: projectRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
      return { committed: true, commit };
    }
  } catch {
    return { committed: false, commit: '' };
  }
}
