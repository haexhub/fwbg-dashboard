/**
 * GET /api/runs/:id/discovery/:symbol
 * Proxy to fwbg API: feature discovery for a symbol's trades.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const symbol = getRouterParam(event, "symbol");
  return fwbgFetch<unknown>(`/api/runs/${id}/discovery/${symbol}`, {
    timeout: 300_000,
  });
});
