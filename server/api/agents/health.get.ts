/**
 * GET /api/agents/health
 * Proxy to fwbg-agents: liveness probe.
 */
export default defineEventHandler(async () => {
  return fwbgAgentsFetch<{ status: string; version: string }>("/healthz");
});
