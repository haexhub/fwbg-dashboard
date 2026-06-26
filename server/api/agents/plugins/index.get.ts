import type { AgentPluginSummary } from "~/types/agents";

/**
 * GET /api/agents/plugins
 * Proxy to fwbg-agents: list plugins, filterable by state/kind.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const params = new URLSearchParams();
  if (query.state) params.set("state", String(query.state));
  if (query.kind) params.set("kind", String(query.kind));
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return fwbgAgentsFetch<{ plugins: AgentPluginSummary[] }>(
    `/plugins${qs ? `?${qs}` : ""}`
  );
});
