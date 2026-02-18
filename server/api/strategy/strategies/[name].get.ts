/**
 * GET /api/strategy/strategies/:name
 * Proxy to fwbg API: load a strategy JSON file.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  return fwbgFetch<unknown>(`/api/strategies/${name}`);
});
