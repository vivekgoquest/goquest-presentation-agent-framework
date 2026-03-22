export const AGENT_CAPABILITIES = Object.freeze([
  {
    id: 'new_presentation',
    label: 'New presentation',
    skillName: 'new-deck',
    requiresProject: false,
    supportedVendors: ['claude'],
    dependencyRequirements: ['claude-cli'],
    launcherStrategy: 'claude_print',
    visibleTrace: 'Starting a new presentation...\r\n',
  },
  {
    id: 'review_presentation',
    label: 'Review presentation',
    skillName: 'review-deck',
    requiresProject: true,
    supportedVendors: ['claude'],
    dependencyRequirements: ['claude-cli'],
    launcherStrategy: 'claude_print',
    visibleTrace: 'Running review for this presentation...\r\n',
  },
  {
    id: 'revise_presentation',
    label: 'Revise presentation',
    skillName: 'revise-deck',
    requiresProject: true,
    supportedVendors: ['claude'],
    dependencyRequirements: ['claude-cli'],
    launcherStrategy: 'claude_print',
    visibleTrace: 'Running revisions for this presentation...\r\n',
  },
  {
    id: 'fix_warnings',
    label: 'Fix warnings',
    skillName: 'fix-warnings',
    requiresProject: true,
    supportedVendors: ['claude'],
    dependencyRequirements: ['claude-cli'],
    launcherStrategy: 'claude_print',
    visibleTrace: 'Fixing presentation warnings...\r\n',
  },
]);

export function listAgentCapabilities() {
  return AGENT_CAPABILITIES.map((capability) => ({ ...capability }));
}

export function getAgentCapability(capabilityId) {
  return AGENT_CAPABILITIES.find((capability) => capability.id === capabilityId) || null;
}
