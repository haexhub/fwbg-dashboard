import type { PaperSummary } from "~/types/agents";

/**
 * GET /api/agents/strategies/:id/paper-summary
 * Proxy to fwbg-agents. A 404 upstream means "no paper-trade data yet" —
 * an expected empty state, not an error.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  try {
    return await fwbgAgentsFetch<PaperSummary>(`/strategies/${id}/paper-summary`);
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
});
