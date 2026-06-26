import type { AgentRun } from "~/types/agents";

/**
 * GET /api/agents/runs/:id
 * Proxy to fwbg-agents: agent run status. Polling target for action buttons.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<AgentRun>(`/agents/runs/${id}`);
});
