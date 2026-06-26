import type { AgentPluginDetail } from "~/types/agents";

/**
 * GET /api/agents/plugins/:id
 * Proxy to fwbg-agents: plugin detail with transition history.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<AgentPluginDetail>(`/plugins/${id}`);
});
