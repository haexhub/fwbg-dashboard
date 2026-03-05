/**
 * GET /api/runs/:id/analysis/:symbol
 * Proxy to fwbg API: statistical analysis of trades for a symbol.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const symbol = getRouterParam(event, "symbol");
  return fwbgFetch<unknown>(`/api/runs/${id}/analysis/${symbol}`);
});
