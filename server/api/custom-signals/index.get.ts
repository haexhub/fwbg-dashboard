export default defineEventHandler(async () => {
  return fwbgFetch<unknown[]>("/api/custom-signals");
});
