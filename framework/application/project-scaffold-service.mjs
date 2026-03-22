import { execFileSync } from 'node:child_process';
import { createPresentationScaffold, parseNewDeckCliArgs } from '../runtime/services/scaffold-service.mjs';
import { writeProjectAgentScaffoldPackage } from '../../project-agent/scaffold-package.mjs';

export { parseNewDeckCliArgs };

function initializeProjectGitHistory(projectRoot, deckSlug) {
  try {
    const gitOpts = { cwd: projectRoot, stdio: 'ignore' };
    execFileSync('git', ['init'], gitOpts);
    execFileSync('git', ['add', '-A'], gitOpts);
    execFileSync('git', ['commit', '-m', `Scaffold: ${deckSlug}`], gitOpts);
  } catch {
    // git not available - edit history is optional
  }
}

export function createProjectScaffold(targetInput, options = {}, dependencies = {}) {
  const frameworkRoot = dependencies.frameworkRoot || process.cwd();
  const scaffoldResult = createPresentationScaffold(targetInput, options);
  const projectRoot = targetInput.projectRootAbs || targetInput.projectRoot || targetInput;
  const agentPackage = writeProjectAgentScaffoldPackage(projectRoot, { frameworkRoot });
  initializeProjectGitHistory(projectRoot, scaffoldResult.deck);

  return {
    ...scaffoldResult,
    files: [
      ...scaffoldResult.files,
      ...agentPackage.createdPaths,
    ],
  };
}
