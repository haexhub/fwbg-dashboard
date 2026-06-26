import type { PromoteLiveInput } from "~/types/agents";

/**
 * POST /api/agents/strategies/:id/promote-live
 * Proxy to fwbg-agents: triple-gated promotion to LIVE_TRADING.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const body = await readBody<PromoteLiveInput>(event);
  return fwbgAgentsFetch<{ strategy_id: number; new_state: string; agent_run_id: number }>(
    `/strategies/${id}/promote-live`,
    { method: "POST", body: JSON.stringify(body) }
  );
});
