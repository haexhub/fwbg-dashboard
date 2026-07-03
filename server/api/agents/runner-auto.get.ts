/**
 * GET /api/agents/runner-auto
 * Proxy to fwbg-agents: current state of the Runner auto mode.
 */
export default defineEventHandler(async () => {
  return fwbgAgentsFetch<{ enabled: boolean }>("/runner/auto");
});
