/**
 * GET /api/chart/ohlcv?symbol=EURUSD&timeframe=HOUR&source=forexsb&limit=5000&before=1700000000000
 * Proxy to fwbg API: load OHLCV data from CSV data source.
 * Fetches all data from fwbg on first request, caches it, then serves
 * paginated slices via `before` (timestamp) and `limit` query params.
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

function sliceBars(bars: OhlcvBar[], before: number | null, limit: number | null) {
  let result = bars;
  if (before) {
    result = result.filter((b) => b.timestamp < before);
  }
  if (limit && result.length > limit) {
    result = result.slice(-limit);
  }
  return result;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const source = String(query.source || "");
  const symbol = String(query.symbol || "");
  const timeframe = String(query.timeframe || "");
  const before = query.before ? Number(query.before) : null;
  const limit = query.limit ? Number(query.limit) : null;
  const dropFlatBars = query.drop_flat_bars === "true";

  // Use a distinct cache key when flat bars are filtered
  const cacheTimeframe = dropFlatBars ? `${timeframe}:noflat` : timeframe;

  // ── Cache check ──
  if (source && symbol && timeframe) {
    const cached = getCachedOhlcv(source, symbol, cacheTimeframe);
    if (cached) {
      const sliced = sliceBars(cached, before, limit);
      return {
        symbol,
        timeframe,
        total: cached.length,
        count: sliced.length,
        data: sliced,
        cached: true,
      };
    }
  }

  // ── Cache miss → fetch ALL from fwbg ──
  const params = new URLSearchParams();
  if (query.symbol) params.set("symbol", String(query.symbol));
  if (query.timeframe) params.set("timeframe", String(query.timeframe));
  if (query.source) params.set("source", String(query.source));
  params.set("limit", "50000");
  if (dropFlatBars) params.set("drop_flat_bars", "true");

  const result = await fwbgFetch<FwbgOhlcvResponse>(`/api/chart/ohlcv?${params.toString()}`);

  // Store full dataset in cache
  if (source && symbol && timeframe && result.data?.length > 0) {
    setCachedOhlcv(source, symbol, cacheTimeframe, result.data);
  }

  // Return paginated slice
  const allBars = result.data ?? [];
  const sliced = sliceBars(allBars, before, limit);
  return {
    symbol,
    timeframe,
    total: allBars.length,
    count: sliced.length,
    data: sliced,
  };
});
