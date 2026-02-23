/**
 * POST /api/strategy/presets/:section
 * Create a new preset for a section.
 */
export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, "section");
  const body = await readBody(event);
  return fwbgFetch<unknown>(`/api/presets/${section}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
});
