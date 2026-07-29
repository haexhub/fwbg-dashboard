import { fwbgAgentsFetch } from "~/server/utils/fwbg-agents-api";
import type { AgentSecretsStatus, AgentSecretsUpdate } from "~/types/agents";

/**
 * PUT /api/agents/secrets
 * Proxy to fwbg-agents: set or clear one or more provider API keys. Keys
 * omitted from the body are left untouched (partial update).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<AgentSecretsUpdate>(event);
  return fwbgAgentsFetch<AgentSecretsStatus>("/agents/secrets", {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
