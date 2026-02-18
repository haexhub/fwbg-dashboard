/**
 * GET /api/runs
 * Proxy to fwbg API: list all runs.
 * Query: ?limit=20
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = query.limit ? `?limit=${query.limit}` : "";
  return fwbgFetch<unknown[]>(`/api/runs${limit}`);
});
