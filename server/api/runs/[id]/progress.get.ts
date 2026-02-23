/**
 * GET /api/runs/:id/progress
 * Proxy to fwbg API: get run progress (reads progress.json).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgFetch<unknown>(`/api/runs/${id}/progress`);
});
