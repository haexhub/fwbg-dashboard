/**
 * GET /api/exploration/exit-optimization/:symbol
 * Get cached exit optimization result for a specific symbol.
 */
export default defineEventHandler(async (event) => {
  const symbol = getRouterParam(event, "symbol");
  return fwbgFetch<unknown>(`/api/exploration/exit-optimization/${symbol}`);
});
