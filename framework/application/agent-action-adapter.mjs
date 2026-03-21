import { existsSync } from 'fs';
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'path';
import { getAgentCapability } from '../../project-agent/agent-capabilities.mjs';

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

function createCapabilityPrompt(capability, context) {
  const projectRoot = context.target?.projectRootAbs || context.meta?.projectRoot || '';
  const frameworkRoot = context.frameworkRoot || process.cwd();

  if (!projectRoot && capability.requiresProject) {
    throw new Error(`Capability "${capability.id}" requires an active presentation project.`);
  }

  const contractPath = capability.requiresProject
    ? resolve(projectRoot, '.claude', 'CLAUDE.md')
    : resolve(frameworkRoot, 'project-agent', 'project-claude-md.md');
  const skillPath = capability.requiresProject
    ? resolve(projectRoot, '.claude', 'skills', capability.skillName, 'SKILL.md')
    : resolve(frameworkRoot, 'project-agent', 'project-dot-claude', 'skills', capability.skillName, 'SKILL.md');

  if (!existsSync(contractPath)) {
    throw new Error(`Agent contract file is missing: ${contractPath}`);
  }
  if (!existsSync(skillPath)) {
    throw new Error(`Agent skill file is missing: ${skillPath}`);
  }

  return [
    `You are executing the "${capability.id}" capability for the presentation framework.`,
    '',
    `Framework root: ${frameworkRoot}`,
    capability.requiresProject ? `Project root: ${projectRoot}` : '',
    '',
    'Read and follow these files first:',
    `- ${contractPath}`,
    `- ${skillPath}`,
    '',
    'Treat those files as the source of truth for the workflow.',
    'Do not ask follow-up questions unless you are blocked by a missing file or an unrecoverable error.',
    capability.requiresProject
      ? `When a command needs a project path, use: ${projectRoot}`
      : '',
  ].filter(Boolean).join('\n');
}

export function createAgentActionAdapter(options = {}) {
  const frameworkRoot = options.frameworkRoot || process.cwd();
  const preferredVendor = options.preferredVendor || 'claude';
  const commandAvailability = new Map();

  function isVendorAvailable(vendor) {
    if (!commandAvailability.has(vendor)) {
      commandAvailability.set(vendor, resolveCommandAvailability(vendor));
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

    async invoke(actionId, context = {}) {
      const capability = getAgentCapability(actionId);
      if (!capability) {
        throw new Error(`Unsupported agent action "${actionId}".`);
      }

      const availability = await this.getAvailability(actionId);
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
      });

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
        const child = spawn(availability.vendor, args, {
          cwd: frameworkRoot,
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
          context.terminalService?.writeSystemOutput(chunk);
        });

        child.stderr.on('data', (chunk) => {
          stderr += chunk;
          context.terminalService?.writeSystemOutput(chunk);
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
