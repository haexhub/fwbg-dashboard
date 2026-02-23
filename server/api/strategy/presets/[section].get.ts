/**
 * GET /api/strategy/presets/:section
 * List all available presets for a section (e.g. models, pipelines, grids).
 */
export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, "section");
  return fwbgFetch<unknown[]>(`/api/presets/${section}`);
});
