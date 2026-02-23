/**
 * GET /api/runs/:id/trades/:symbol
 * Proxy to fwbg API: get all detailed trades for a symbol across all folds.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const symbol = getRouterParam(event, "symbol");
  return fwbgFetch<unknown>(`/api/runs/${id}/trades/${symbol}`);
});
