/**
 * DELETE /api/strategy/presets/:section/:name
 * Delete a preset. Pass ?scope=all to delete all versions with the same display name.
 */
export default defineEventHandler(async (event) => {
  const section = getRouterParam(event, "section");
  const name = getRouterParam(event, "name");
  const { scope } = getQuery(event);
  const qs = scope === "all" ? "?scope=all" : "";
  return fwbgFetch<unknown>(`/api/presets/${section}/${name}${qs}`, {
    method: "DELETE",
  });
});
