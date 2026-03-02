/**
 * GET /api/plugins/:fqn/docs
 * Proxy to fwbg API: get plugin documentation (README).
 */
export default defineEventHandler(async (event) => {
  const fqn = getRouterParam(event, "fqn");
  return fwbgFetch<unknown>(`/api/plugins/${fqn}/docs`);
});
