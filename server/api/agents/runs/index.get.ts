import type { AgentRun } from "~/types/agents";

/**
 * GET /api/agents/runs[?status=pending,running&limit=20]
 * Proxy to fwbg-agents: lists agent runs, newest first.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  return fwbgAgentsFetch<{ runs: AgentRun[] }>("/agents/runs", { query });
});
