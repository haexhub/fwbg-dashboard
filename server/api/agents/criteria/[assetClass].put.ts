import type { CriteriaUpdateResponse } from "~/types/agents";

/**
 * PUT /api/agents/criteria/:assetClass
 * Proxy to fwbg-agents: update criteria doc from raw YAML text.
 */
export default defineEventHandler(async (event) => {
  const assetClass = getRouterParam(event, "assetClass");
  const body = await readBody<{ yaml_text: string }>(event);
  return fwbgAgentsFetch<CriteriaUpdateResponse>(`/criteria/${assetClass}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
