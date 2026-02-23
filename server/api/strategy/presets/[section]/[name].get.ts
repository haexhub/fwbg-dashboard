/**
 * GET /api/strategy/presets/:section/:name
 * Load a single preset by section and name.
 */
export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, "section");
  const name = getRouterParam(event, "name");
  return fwbgFetch<unknown>(`/api/presets/${section}/${name}`);
});
