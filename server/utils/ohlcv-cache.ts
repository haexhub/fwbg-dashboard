/**
 * Server-side in-memory cache for OHLCV data.
 *
 * Broker-independent: caches by source/symbol/timeframe, so it works
 * for CSV sources (e.g. "forexsb") and broker sources (e.g. "broker:ig-demo")
 * alike. Avoids redundant fetches to fwbg or broker APIs.
 */

export interface OhlcvBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CacheEntry {
  bars: OhlcvBar[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

/** TTL in ms per timeframe — longer TFs get longer cache */
const TTL: Record<string, number> = {
  MINUTE_1: 60_000,          // 1 min
  MINUTE_5: 5 * 60_000,      // 5 min
  MINUTE_15: 10 * 60_000,    // 10 min
  MINUTE_30: 15 * 60_000,    // 15 min
  HOUR: 30 * 60_000,         // 30 min
  HOUR_4: 60 * 60_000,       // 1 hour
  DAY: 4 * 60 * 60_000,      // 4 hours
};

function cacheKey(source: string, symbol: string, timeframe: string): string {
  return `${source}:${symbol}:${timeframe}`;
}

/**
 * Get cached OHLCV bars if still fresh.
 */
export function getCachedOhlcv(
  source: string,
  symbol: string,
  timeframe: string,
): OhlcvBar[] | null {
  const key = cacheKey(source, symbol, timeframe);
  const entry = cache.get(key);
  if (!entry) return null;

  const ttl = TTL[timeframe] ?? 30 * 60_000;
  if (Date.now() - entry.fetchedAt > ttl) {
    cache.delete(key);
    return null;
  }

  return entry.bars;
}

/**
 * Store OHLCV bars in the cache.
 */
export function setCachedOhlcv(
  source: string,
  symbol: string,
  timeframe: string,
  bars: OhlcvBar[],
): void {
  const key = cacheKey(source, symbol, timeframe);
  cache.set(key, { bars, fetchedAt: Date.now() });
}

/**
 * Append/update the latest bar in the cache without refetching history.
 * Used by the WebSocket handler to keep the cache fresh with live ticks.
 */
export function updateCachedLastBar(
  source: string,
  symbol: string,
  timeframe: string,
  bar: OhlcvBar,
): void {
  const key = cacheKey(source, symbol, timeframe);
  const entry = cache.get(key);
  if (!entry || entry.bars.length === 0) return;

  const lastBar = entry.bars[entry.bars.length - 1]!;
  if (bar.timestamp === lastBar.timestamp) {
    // Update existing candle
    entry.bars[entry.bars.length - 1] = bar;
  } else if (bar.timestamp > lastBar.timestamp) {
    // New candle started
    entry.bars.push(bar);
  }
}

/**
 * Clear all cached entries (e.g., on account credential changes).
 */
export function clearOhlcvCache(): void {
  cache.clear();
}
