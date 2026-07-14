import type { TrialsSummary } from "~/types/agents";

/**
 * GET /api/agents/trials/summary
 * Proxy to fwbg-agents: global trial census (n_trials + cross-trial SR
 * variance) used to compute the Deflated Sharpe Ratio client-side for
 * arbitrary fwbg runs (see utils/dsr.ts).
 */
export default defineEventHandler(async () => {
  return fwbgAgentsFetch<TrialsSummary>("/trials/summary");
});
