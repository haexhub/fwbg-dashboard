/**
 * GET /api/agents/runs/:id/events
 * Proxy to fwbg-agents: stored research events (search queries + result URLs) for a run.
 * Returns 404 until fwbg-agents implements the endpoint — callers must handle gracefully.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  // Pass include_descendants through so the envelope view can aggregate the
  // whole flow subtree's events in one call.
  const { include_descendants } = getQuery(event);
  const raw = Array.isArray(include_descendants) ? include_descendants[0] : include_descendants;
  const params = new URLSearchParams();
  if (raw) params.set("include_descendants", String(raw));
  const qs = params.toString() ? `?${params.toString()}` : "";
  return fwbgAgentsFetch<Array<Record<string, unknown>>>(`/agents/runs/${id}/events${qs}`);
});
