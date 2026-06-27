import type { ClaudeProxySetupStatus } from "~/types/claude-proxy";

/**
 * GET /api/agents/llm/status
 * Proxy to haex-claude-proxy: current OAuth setup state.
 */
export default defineEventHandler(async () => {
  return claudeProxyFetch<ClaudeProxySetupStatus>("/setup/status");
});
