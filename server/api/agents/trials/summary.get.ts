import type { TrialsSummary } from "~/types/agents";

/**
 * GET /api/agents/trials/summary
 * Proxy to fwbg-agents: global trial census (n_trials + cross-trial SR
 * variance) used to compute the Deflated Sharpe Ratio client-side for
 * arbitrary fwbg runs (see utils/dsr.ts). The census is a filesystem scan
 * over all completed backtests in fwbg-agents and changes slowly — cached
 * briefly so every run-detail view doesn't retrigger the scan.
 */
export default defineCachedEventHandler(
  () => fwbgAgentsFetch<TrialsSummary>("/trials/summary"),
  { maxAge: 60, name: "agents-trials-summary", getKey: () => "all" },
);
