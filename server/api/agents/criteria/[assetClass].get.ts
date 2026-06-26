import type { CriteriaDetailResponse } from "~/types/agents";

/**
 * GET /api/agents/criteria/:assetClass
 * Proxy to fwbg-agents: criteria doc for one asset class (parsed + raw YAML).
 */
export default defineEventHandler(async (event) => {
  const assetClass = getRouterParam(event, "assetClass");
  return fwbgAgentsFetch<CriteriaDetailResponse>(`/criteria/${assetClass}`);
});
