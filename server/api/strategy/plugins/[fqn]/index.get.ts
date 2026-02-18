/**
 * GET /api/strategy/plugins/:fqn
 * Proxy to fwbg API: get single plugin details.
 */
export default defineEventHandler(async (event) => {
  const fqn = getRouterParam(event, "fqn");
  return fwbgFetch<unknown>(`/api/plugins/${fqn}`);
});
