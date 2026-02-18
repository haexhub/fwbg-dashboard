/**
 * POST /api/strategy/plugins/:fqn/tests
 * Proxy to fwbg API: run tests for a plugin.
 */
export default defineEventHandler(async (event) => {
  const fqn = getRouterParam(event, "fqn");
  return fwbgFetch<unknown>(`/api/plugins/${fqn}/tests/run`, {
    method: "POST",
  });
});
