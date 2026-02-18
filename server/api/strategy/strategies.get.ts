/**
 * GET /api/strategy/strategies
 * Proxy to fwbg API: list all strategy files.
 */
export default defineEventHandler(async () => {
  return fwbgFetch<unknown[]>("/api/strategies");
});
