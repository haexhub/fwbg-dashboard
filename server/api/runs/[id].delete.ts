/**
 * DELETE /api/runs/:id
 * Proxy to fwbg API: delete all results for a completed run.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  return fwbgFetch<unknown>(`/api/runs/${id}`, {
    method: "DELETE",
  });
});
