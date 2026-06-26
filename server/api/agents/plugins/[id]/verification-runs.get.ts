import type { VerificationRun } from "~/types/agents";

/**
 * GET /api/agents/plugins/:id/verification-runs
 * Proxy to fwbg-agents: plugin verification run history.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgAgentsFetch<{ verification_runs: VerificationRun[] }>(
    `/plugins/${id}/verification-runs`
  );
});
