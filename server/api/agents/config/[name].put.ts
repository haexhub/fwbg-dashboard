import { fwbgAgentsFetch } from "~/server/utils/fwbg-agents-api";
import type { AgentConfig, AgentConfigUpdate } from "~/types/agents";

/**
 * PUT /api/agents/config/:name
 * Proxy to fwbg-agents: set this agent's model and/or persona override.
 * Empty values reset the respective field to its built-in default.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  const body = await readBody<AgentConfigUpdate>(event);
  return fwbgAgentsFetch<AgentConfig>(`/agents/config/${name}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
