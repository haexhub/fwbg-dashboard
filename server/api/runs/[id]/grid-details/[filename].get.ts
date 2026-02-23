/**
 * GET /api/runs/:id/grid-details/:filename
 * Proxy to fwbg API: fetch a single grid detail file.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const filename = getRouterParam(event, "filename");
  return fwbgFetch<unknown>(`/api/runs/${id}/grid_details/${filename}`);
});
