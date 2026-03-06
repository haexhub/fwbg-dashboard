/**
 * GET /api/strategy/strategies/:name/version/:ref
 * Proxy to fwbg API: load a specific git version of a strategy.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  const ref = getRouterParam(event, "ref");
  return fwbgFetch<Record<string, unknown>>(
    `/api/strategies/${name}/version/${ref}`,
  );
});
