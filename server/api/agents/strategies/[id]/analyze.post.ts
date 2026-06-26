/**
 * POST /api/agents/strategies/:id/analyze
 * Proxy to fwbg-agents: kick off the Analyst agent.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<{ strategy_id: number; agent_run_id: number; status: string }>(
    `/strategies/${id}/analyze`,
    { method: "POST" }
  );
});
