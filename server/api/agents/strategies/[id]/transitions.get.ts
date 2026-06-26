import type { AgentStrategyTransition } from "~/types/agents";

/**
 * GET /api/agents/strategies/:id/transitions
 * Proxy to fwbg-agents: strategy transition history.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<{ transitions: AgentStrategyTransition[] }>(
    `/strategies/${id}/transitions`
  );
});
