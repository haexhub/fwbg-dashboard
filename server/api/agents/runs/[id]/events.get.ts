/**
 * GET /api/agents/runs/:id/events
 * Proxy to fwbg-agents: stored research events (search queries + result URLs) for a run.
 * Returns 404 until fwbg-agents implements the endpoint — callers must handle gracefully.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<Array<Record<string, unknown>>>(`/agents/runs/${id}/events`);
});
