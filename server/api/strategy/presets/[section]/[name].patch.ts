/**
 * PATCH /api/strategy/presets/:section/:name
 * Update preset metadata (name and description only).
 */
export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, "section");
  const name = getRouterParam(event, "name");
  const body = await readBody(event);
  return fwbgFetch<unknown>(`/api/presets/${section}/${name}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
});
