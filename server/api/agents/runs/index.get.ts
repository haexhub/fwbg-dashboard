import type { AgentRun } from "~/types/agents";

/**
 * GET /api/agents/runs[?status=pending,running&limit=20]
 * Proxy to fwbg-agents: lists agent runs, newest first.
 */
export default defineEventHandler(async (event) => {
  const { status, limit } = getQuery(event);
  const params = new URLSearchParams();
  if (status) params.set("status", String(status));
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return fwbgAgentsFetch<{ runs: AgentRun[] }>(`/agents/runs${qs ? `?${qs}` : ""}`);
});
