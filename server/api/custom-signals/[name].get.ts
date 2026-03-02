export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  return fwbgFetch<unknown>(`/api/custom-signals/${name}`);
});
