import type { PaperPosition } from "~/types/agents";

/**
 * GET /api/agents/strategies/:id/paper-positions
 * Proxy to fwbg-agents. A 404 upstream means "no positions snapshot yet" —
 * an expected empty state, not an error.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  try {
    const result = await fwbgAgentsFetch<{ positions: PaperPosition[] }>(
      `/strategies/${id}/paper-positions`
    );
    return result.positions;
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) return [];
    throw e;
  }
});
