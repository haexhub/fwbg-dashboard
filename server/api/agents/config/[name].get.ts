import { fwbgAgentsFetch } from "~/server/utils/fwbg-agents-api";
import type { AgentConfig } from "~/types/agents";

/**
 * GET /api/agents/config/:name
 * Proxy to fwbg-agents: one agent's effective model + persona.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  return fwbgAgentsFetch<AgentConfig>(`/agents/config/${name}`);
});
