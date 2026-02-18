/**
 * GET /api/chart/ohlcv?symbol=EURUSD&timeframe=HOUR&source=forexsb&limit=5000&offset=0
 * Proxy to fwbg API: load OHLCV data from CSV data source.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const params = new URLSearchParams();
  if (query.symbol) params.set("symbol", String(query.symbol));
  if (query.timeframe) params.set("timeframe", String(query.timeframe));
  if (query.source) params.set("source", String(query.source));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  return fwbgFetch<unknown>(`/api/chart/ohlcv?${params.toString()}`);
});
