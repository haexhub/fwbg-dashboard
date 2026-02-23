/**
 * GET /api/runs/:id/grid-details
 * Proxy to fwbg API: list grid detail files for a run.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgFetch<string[]>(`/api/runs/${id}/grid_details`);
});
