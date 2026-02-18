/**
 * POST /api/runs/:id/cancel
 * Proxy to fwbg API: cancel an active run.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgFetch<unknown>(`/api/runs/${id}/cancel`, {
    method: "POST",
  });
});
