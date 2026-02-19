/**
 * GET /api/chart/ohlcv?symbol=EURUSD&timeframe=HOUR&source=forexsb&limit=5000&offset=0
 * Proxy to fwbg API: load OHLCV data from CSV data source.
 * Cache-first: returns cached bars when available.
 */
import type { OhlcvBar } from "~/server/utils/ohlcv-cache";
import { getCachedOhlcv, setCachedOhlcv } from "~/server/utils/ohlcv-cache";

interface FwbgOhlcvResponse {
  symbol: string;
  timeframe: string;
  total: number;
  count: number;
  data: OhlcvBar[];
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const source = String(query.source || "");
  const symbol = String(query.symbol || "");
  const timeframe = String(query.timeframe || "");

  // ── Cache check ──
  if (source && symbol && timeframe) {
    const cached = getCachedOhlcv(source, symbol, timeframe);
    if (cached) {
      return {
        symbol,
        timeframe,
        total: cached.length,
        count: cached.length,
        data: cached,
        cached: true,
      };
    }
  }

  // ── Cache miss → fetch from fwbg ──
  const params = new URLSearchParams();
  if (query.symbol) params.set("symbol", String(query.symbol));
  if (query.timeframe) params.set("timeframe", String(query.timeframe));
  if (query.source) params.set("source", String(query.source));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));

  const result = await fwbgFetch<FwbgOhlcvResponse>(`/api/chart/ohlcv?${params.toString()}`);

  // Store in cache
  if (source && symbol && timeframe && result.data?.length > 0) {
    setCachedOhlcv(source, symbol, timeframe, result.data);
  }

  return result;
});
