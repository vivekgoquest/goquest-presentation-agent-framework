import { createProjectAgentLauncher } from '../../project-agent/agent-launcher.mjs';

export function createAgentActionAdapter(options = {}) {
  const launcher = createProjectAgentLauncher(options);

  return {
    getAvailability(capabilityId, context = {}) {
      return launcher.getAvailability(capabilityId, context);
    },
    invoke(capabilityId, context = {}) {
      return launcher.invoke(capabilityId, context);
    },
  };
}
