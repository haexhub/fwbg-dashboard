/**
 * PUT /api/agents/runner-auto
 * Proxy to fwbg-agents: enable/disable the Runner auto mode.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgAgentsFetch<{ enabled: boolean }>("/runner/auto", {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
