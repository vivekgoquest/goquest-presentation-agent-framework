import { createProjectAgentLauncher } from '../../project-agent/agent-launcher.mjs';

export function createAgentActionAdapter(options = {}) {
  const launcher = createProjectAgentLauncher(options);

  return {
    getAvailability(capabilityId) {
      return launcher.getAvailability(capabilityId);
    },
    invoke(capabilityId, context = {}) {
      return launcher.invoke(capabilityId, context);
    },
  };
}
