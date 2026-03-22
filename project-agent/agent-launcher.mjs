import { existsSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { getAgentCapability } from './agent-capabilities.mjs';

function resolveCommandAvailability(command) {
  if (process.platform === 'win32') {
    const result = spawnSync('where', [command], { stdio: 'ignore' });
    return result.status === 0;
  }

  const result = spawnSync('bash', ['-lc', `command -v ${command}`], { stdio: 'ignore' });
  return result.status === 0;
}

function tailText(text = '', limit = 600) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.length <= limit) {
    return trimmed;
  }

  return trimmed.slice(-limit);
}

function createCapabilityPrompt(capability, context, options = {}) {
  const projectRoot = context.target?.projectRootAbs || context.meta?.projectRoot || '';
  const frameworkRoot = context.frameworkRoot || process.cwd();
  const resolveContractPaths = typeof options.resolveContractPaths === 'function'
    ? options.resolveContractPaths
    : null;

  if (!projectRoot && capability.requiresProject) {
    throw new Error(`Capability "${capability.id}" requires an active presentation project.`);
  }

  const resolvedPaths = resolveContractPaths
    ? resolveContractPaths({ capability, projectRoot, frameworkRoot })
    : null;

  let agentsPath = resolvedPaths?.agentsPath || (capability.requiresProject
    ? resolve(projectRoot, 'AGENTS.md')
    : null);
  const contractPath = resolvedPaths?.contractPath || (capability.requiresProject
    ? resolve(projectRoot, '.claude', 'CLAUDE.md')
    : resolve(frameworkRoot, 'project-agent', 'project-claude-md.md'));
  const skillPath = resolvedPaths?.skillPath || (capability.requiresProject
    ? resolve(projectRoot, '.claude', 'skills', capability.skillName, 'SKILL.md')
    : resolve(frameworkRoot, 'project-agent', 'project-dot-claude', 'skills', capability.skillName, 'SKILL.md'));

  if (agentsPath && !existsSync(agentsPath)) {
    // Legacy scaffolded projects may only have the vendor adapter contract.
    // Fall back to that path so older decks can still launch project-mode agents.
    agentsPath = null;
  }
  if (!existsSync(contractPath)) {
    throw new Error(`Agent contract file is missing: ${contractPath}`);
  }
  if (!existsSync(skillPath)) {
    throw new Error(`Agent skill file is missing: ${skillPath}`);
  }

  const workflowPrompt = typeof context.workflow?.prompt === 'string'
    ? context.workflow.prompt.trim()
    : '';

  return [
    `You are executing the "${capability.id}" capability for the presentation framework.`,
    '',
    capability.requiresProject ? '' : `Framework root: ${frameworkRoot}`,
    capability.requiresProject ? `Project root: ${projectRoot}` : '',
    '',
    'Read and follow these files first:',
    agentsPath ? `- ${agentsPath}` : '',
    `- ${contractPath}`,
    `- ${skillPath}`,
    '',
    workflowPrompt
      ? 'Treat the application-prepared workflow context below as the canonical workflow definition. Use the contract files and skill file as supporting guidance.'
      : 'Treat those files as the source of truth for the workflow.',
    workflowPrompt ? '' : '',
    workflowPrompt ? workflowPrompt : '',
    'Do not ask follow-up questions unless you are blocked by a missing file or an unrecoverable error.',
    capability.requiresProject
      ? `When a command needs a project path, use: ${projectRoot}`
      : '',
  ].filter(Boolean).join('\n');
}

export function createProjectAgentLauncher(options = {}) {
  const frameworkRoot = options.frameworkRoot || process.cwd();
  const preferredVendor = options.preferredVendor || 'claude';
  const spawnImpl = options.spawnImpl || spawn;
  const commandAvailabilityResolver = options.commandAvailabilityResolver || resolveCommandAvailability;
  const resolveContractPaths = options.resolveContractPaths || null;
  const commandAvailability = new Map();

  function isVendorAvailable(vendor) {
    if (!commandAvailability.has(vendor)) {
      commandAvailability.set(vendor, commandAvailabilityResolver(vendor));
    }
    return commandAvailability.get(vendor);
  }

  return {
    async getAvailability(capabilityId) {
      const capability = getAgentCapability(capabilityId);
      if (!capability) {
        return {
          available: false,
          reason: `Unknown agent capability "${capabilityId}".`,
        };
      }

      const selectedVendor = capability.supportedVendors.includes(preferredVendor)
        ? preferredVendor
        : capability.supportedVendors[0];

      if (!selectedVendor || !isVendorAvailable(selectedVendor)) {
        return {
          available: false,
          reason: 'Claude CLI is not available on this machine.',
        };
      }

      return {
        available: true,
        vendor: selectedVendor,
        capability,
      };
    },

    async invoke(capabilityId, context = {}) {
      const capability = getAgentCapability(capabilityId);
      if (!capability) {
        throw new Error(`Unsupported agent capability "${capabilityId}".`);
      }

      const availability = await this.getAvailability(capabilityId);
      if (!availability.available) {
        return {
          status: 'fail',
          message: `${capability.label} is unavailable.`,
          detail: availability.reason || '',
        };
      }

      const projectRoot = context.target?.projectRootAbs || context.meta?.projectRoot || '';
      const prompt = createCapabilityPrompt(capability, {
        ...context,
        frameworkRoot,
      }, { resolveContractPaths });

      context.terminalService?.writeSystemOutput?.(capability.visibleTrace || '');

      const args = [
        '-p',
        '--permission-mode',
        'acceptEdits',
        '--output-format',
        'text',
      ];

      if (projectRoot) {
        args.push('--add-dir', projectRoot);
      }
      args.push(prompt);

      return await new Promise((resolvePromise, reject) => {
        const child = spawnImpl(availability.vendor, args, {
          cwd: projectRoot || frameworkRoot,
          env: {
            ...process.env,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');

        child.stdout.on('data', (chunk) => {
          stdout += chunk;
          context.terminalService?.writeSystemOutput?.(chunk);
        });

        child.stderr.on('data', (chunk) => {
          stderr += chunk;
          context.terminalService?.writeSystemOutput?.(chunk);
        });

        child.on('error', (error) => {
          reject(error);
        });

        child.on('close', (code) => {
          const detail = tailText(stdout || stderr);
          if (code === 0) {
            resolvePromise({
              status: 'pass',
              message: `${capability.label} completed.`,
              detail,
              vendor: availability.vendor,
            });
            return;
          }

          resolvePromise({
            status: 'fail',
            message: `${capability.label} failed.`,
            detail: detail || `Exited with code ${code}.`,
            exitCode: code,
            vendor: availability.vendor,
          });
        });
      });
    },
  };
}
