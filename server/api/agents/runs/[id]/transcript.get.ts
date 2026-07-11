/**
 * GET /api/agents/runs/:id/transcript?round=NNN
 * Proxy to fwbg-agents: the parsed pydantic-ai message transcript for one LLM
 * round. 404 until the run has produced a transcript for that round.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const round = getQuery(event).round ?? 1;
  return fwbgAgentsFetch<unknown>(`/agents/runs/${id}/transcript?round=${round}`);
});
