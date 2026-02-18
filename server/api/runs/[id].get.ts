/**
 * GET /api/runs/:id
 * Proxy to fwbg API: get run details.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgFetch<unknown>(`/api/runs/${id}`);
});
