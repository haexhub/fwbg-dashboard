/**
 * PUT /api/strategy/presets/:section/:name
 * Update an existing preset.
 */
export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, "section");
  const name = getRouterParam(event, "name");
  const body = await readBody(event);
  return fwbgFetch<unknown>(`/api/presets/${section}/${name}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
