/**
 * POST /api/agents/llm/reset
 * Proxy to haex-claude-proxy: force the setup flow back to idle (used to
 * start over, e.g. for a re-link).
 */
export default defineEventHandler(async () => {
  return claudeProxyFetch<{ ok: true }>("/setup/reset", {
    method: "POST",
  });
});
