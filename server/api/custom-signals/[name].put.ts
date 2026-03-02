export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  const body = await readBody(event);
  return fwbgFetch<unknown>(`/api/custom-signals/${name}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
