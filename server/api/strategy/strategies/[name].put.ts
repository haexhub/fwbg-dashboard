/**
 * PUT /api/strategy/strategies/:name
 * Proxy to fwbg API: update an existing strategy file.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  const body = await readBody(event);
  return fwbgFetch<unknown>(`/api/strategies/${name}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
