import { fwbgAgentsFetch } from "~/server/utils/fwbg-agents-api";
import type { AgentConfigListResponse } from "~/types/agents";

/**
 * GET /api/agents/config
 * Proxy to fwbg-agents: per-agent model + persona overrides for all
 * configurable agents, plus the list of selectable Claude models.
 */
export default defineEventHandler(async () => {
  return fwbgAgentsFetch<AgentConfigListResponse>("/agents/config");
});
