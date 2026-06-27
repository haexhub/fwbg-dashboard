/**
 * POST /api/agents/llm/code
 * Proxy to haex-claude-proxy: submit the authorization code copied off
 * the Claude OAuth callback page. Resolves once credentials.json is
 * written.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ code: string }>(event);
  return claudeProxyFetch<{ ok: true; credentialsPath: string }>("/setup/code", {
    method: "POST",
    body: JSON.stringify(body),
  });
});
