import type { HypothesisContentResponse } from "~/types/agents";

/**
 * GET /api/agents/strategies/:id/hypothesis
 * Proxy to fwbg-agents: the full researcher hypothesis JSON (sources with
 * key_points, suggested_universe, model_knowledge_only). 404 if the strategy
 * has no hypothesis on record.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<HypothesisContentResponse>(
    `/strategies/${id}/hypothesis`
  );
});
