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
    id: 'fix_validation_issues',
    label: 'Fix validation issues',
    skillName: 'fix-warnings',
    requiresProject: true,
    supportedVendors: ['claude'],
    dependencyRequirements: ['claude-cli'],
    launcherStrategy: 'claude_print',
    visibleTrace: 'Fixing presentation validation issues...\r\n',
  },
  {
    id: 'review_narrative_presentation',
    label: 'Review narrative',
    skillName: 'review-narrative-presentation',
    requiresProject: true,
    supportedVendors: ['claude'],
    dependencyRequirements: ['claude-cli'],
    launcherStrategy: 'claude_print',
    completionMode: 'async-start',
    visibleTrace: 'Starting the narrative review swarm...\r\n',
  },
  {
    id: 'apply_narrative_review_changes',
    label: 'Apply narrative fixes',
    skillName: 'apply-narrative-review-changes',
    requiresProject: true,
    supportedVendors: ['claude'],
    dependencyRequirements: ['claude-cli'],
    launcherStrategy: 'claude_print',
    completionMode: 'async-start',
    visibleTrace: 'Applying narrative review changes...\r\n',
  },
  {
    id: 'review_visual_presentation',
    label: 'Review visuals',
    skillName: 'review-visual-presentation',
    requiresProject: true,
    supportedVendors: ['claude'],
    dependencyRequirements: ['claude-cli'],
    launcherStrategy: 'claude_print',
    completionMode: 'async-start',
    visibleTrace: 'Starting the visual review swarm...\r\n',
  },
  {
    id: 'apply_visual_review_changes',
    label: 'Apply visual fixes',
    skillName: 'apply-visual-review-changes',
    requiresProject: true,
    supportedVendors: ['claude'],
    dependencyRequirements: ['claude-cli'],
    launcherStrategy: 'claude_print',
    completionMode: 'async-start',
    visibleTrace: 'Applying visual review changes...\r\n',
  },
]);

export function listAgentCapabilities() {
  return AGENT_CAPABILITIES.map((capability) => ({ ...capability }));
}

export function getAgentCapability(capabilityId) {
  return AGENT_CAPABILITIES.find((capability) => capability.id === capabilityId) || null;
}
