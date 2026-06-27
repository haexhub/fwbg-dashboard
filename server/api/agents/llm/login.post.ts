/**
 * POST /api/agents/llm/login
 * Proxy to haex-claude-proxy: start (or resume) the `claude auth login`
 * OAuth flow. Resolves with the authorize URL once parsed from the CLI's
 * output.
 */
export default defineEventHandler(async () => {
  return claudeProxyFetch<{ oauthUrl: string }>("/setup/login", {
    method: "POST",
  });
});
