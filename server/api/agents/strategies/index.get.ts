import type { AgentStrategySummary } from "~/types/agents";

/**
 * GET /api/agents/strategies
 * Proxy to fwbg-agents: list strategies, filterable by state/asset_class.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const params = new URLSearchParams();
  if (query.state) params.set("state", String(query.state));
  if (query.asset_class) params.set("asset_class", String(query.asset_class));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return fwbgAgentsFetch<{ strategies: AgentStrategySummary[] }>(
    `/strategies${qs ? `?${qs}` : ""}`
  );
});
