import type { AgentStrategyTransition } from "~/types/agents";

/**
 * GET /api/agents/plugins/:id/transitions
 * Proxy to fwbg-agents: plugin transition history.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<{ transitions: AgentStrategyTransition[] }>(
    `/plugins/${id}/transitions`
  );
});
