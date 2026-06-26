/**
 * POST /api/agents/strategies/:id/paper-analyze
 * Proxy to fwbg-agents: kick off the PaperAnalyst agent against on-disk telemetry.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<{ agent_run_id: number; status: string }>(
    `/strategies/${id}/paper-analyze`,
    { method: "POST" }
  );
});
