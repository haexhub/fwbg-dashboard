import { fwbgAgentsFetch } from "~/server/utils/fwbg-agents-api";
import type { AgentSecretsStatus } from "~/types/agents";

/**
 * GET /api/agents/secrets
 * Proxy to fwbg-agents: set/not-set status for provider API keys (tavily,
 * brave, google). Values are never exposed, only whether each is configured.
 */
export default defineEventHandler(async () => {
  return fwbgAgentsFetch<AgentSecretsStatus>("/agents/secrets");
});
