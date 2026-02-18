/**
 * DELETE /api/strategy/strategies/:name
 * Proxy to fwbg API: delete a strategy file.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  return fwbgFetch<unknown>(`/api/strategies/${name}`, {
    method: "DELETE",
  });
});
