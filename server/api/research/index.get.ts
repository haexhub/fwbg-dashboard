/**
 * GET /api/research
 * Proxy to fwbg API: list research register cards.
 * Query: ?status=active&tag=fx
 */
export default defineEventHandler(async (event) => {
  const query = await getValidatedQuery(event, researchListQuerySchema.parse);
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.tag) params.set("tag", query.tag);
  const qs = params.toString();
  return fwbgFetch<unknown>(`/api/research${qs ? `?${qs}` : ""}`);
});
