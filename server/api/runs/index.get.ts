/**
 * GET /api/runs
 * Proxy to fwbg API: list runs with pagination.
 * Query: ?limit=20&offset=0
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  const qs = params.toString();
  return fwbgFetch<{ items: unknown[]; total: number }>(`/api/runs${qs ? `?${qs}` : ""}`);
});
