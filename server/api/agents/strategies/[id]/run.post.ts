/**
 * POST /api/agents/strategies/:id/run
 * Proxy to fwbg-agents: kick off the Runner agent (backtest).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<{ strategy_id: number; agent_run_id: number; status: string }>(
    `/strategies/${id}/run`,
    { method: "POST" }
  );
});
