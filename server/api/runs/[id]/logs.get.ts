/**
 * GET /api/runs/:id/logs
 * Proxy to fwbg API: get structured run logs (reads logs.jsonl).
 * Query: ?symbol=EURUSD&level=INFO&stage=preprocessing&limit=500
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  const query = getQuery(event);

  const params = new URLSearchParams();
  if (query.symbol) params.set("symbol", String(query.symbol));
  if (query.level) params.set("level", String(query.level));
  if (query.stage) params.set("stage", String(query.stage));
  if (query.limit) params.set("limit", String(query.limit));

  const qs = params.toString();
  const path = `/api/runs/${id}/logs${qs ? `?${qs}` : ""}`;
  return fwbgFetch<unknown[]>(path);
});
