/**
 * GET /api/strategy/strategies/:name/history
 * Proxy to fwbg API: get git commit history for a strategy file.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  return fwbgFetch<{ hash: string; short_hash: string; date: string; message: string }[]>(
    `/api/strategies/${name}/history`,
  );
});
