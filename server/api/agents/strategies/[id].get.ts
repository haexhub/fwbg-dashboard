import type { AgentStrategyDetail } from "~/types/agents";

/**
 * GET /api/agents/strategies/:id
 * Proxy to fwbg-agents: strategy detail with transition history.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<AgentStrategyDetail>(`/strategies/${id}`);
});
