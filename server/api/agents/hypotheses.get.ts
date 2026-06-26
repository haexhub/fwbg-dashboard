import type { Hypothesis } from "~/types/agents";

/**
 * GET /api/agents/hypotheses
 * Proxy to fwbg-agents: strategies that have a hypothesis_path set, newest first.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return fwbgAgentsFetch<{ hypotheses: Hypothesis[] }>(
    `/hypotheses${qs ? `?${qs}` : ""}`
  );
});
