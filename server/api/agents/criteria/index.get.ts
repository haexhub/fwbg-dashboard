import type { CriteriaListResponse } from "~/types/agents";

/**
 * GET /api/agents/criteria
 * Proxy to fwbg-agents: list asset classes that have a criteria YAML on disk.
 */
export default defineEventHandler(async () => {
  return fwbgAgentsFetch<CriteriaListResponse>("/criteria");
});
