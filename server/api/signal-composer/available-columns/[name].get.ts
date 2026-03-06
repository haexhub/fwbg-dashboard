export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  return fwbgFetch(`/api/signal-composer/available-columns/${name}`);
});
