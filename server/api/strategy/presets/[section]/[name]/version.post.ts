/**
 * POST /api/strategy/presets/:section/:name/version
 * Create a new version of an existing preset with updated content.
 */
export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, "section");
  const name = getRouterParam(event, "name");
  const body = await readBody(event);
  return fwbgFetch<unknown>(`/api/presets/${section}/${name}/version`, {
    method: "POST",
    body: JSON.stringify(body),
  });
});
