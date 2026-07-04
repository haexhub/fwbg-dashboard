/**
 * GET /api/agents/queue
 * Proxy to fwbg-agents: backtest queue for PROPOSED strategies.
 */
export default defineEventHandler(async () => {
  return fwbgAgentsFetch<{ strategies: unknown[] }>("/runner/queue");
});
