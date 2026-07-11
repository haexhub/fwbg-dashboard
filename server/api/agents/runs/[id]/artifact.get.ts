/**
 * GET /api/agents/runs/:id/artifact?kind=input|output
 * Proxy to fwbg-agents: the text content of a run's input/output artifact.
 * The backend enforces a data-dir path-traversal guard + size/suffix limits.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const kind = getQuery(event).kind ?? "output";
  return fwbgAgentsFetch<unknown>(`/agents/runs/${id}/artifact?kind=${kind}`);
});
