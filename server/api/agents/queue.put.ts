/**
 * PUT /api/agents/queue
 * Proxy to fwbg-agents: reorder the backtest queue.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgAgentsFetch<{ ok: boolean }>("/runner/queue", {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
