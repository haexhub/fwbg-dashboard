/**
 * POST /api/chart/ohlcv
 * Load OHLCV data from a broker source.
 *
 * Strategy:
 * 1. Return from cache if available (paginated via before/limit)
 * 2. Try direct IG REST API fetch
 * 3. On failure (e.g. historical data allowance exhausted), fall back
 *    to fwbg backend (which has a yfinance fallback)
 */
import {
  createIGClient,
  SYMBOL_TO_EPIC,
  TIMEFRAME_TO_IG_RESOLUTION,
} from "~/server/utils/ig-client";
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
  const body = await readBody(event);

  const source = body.source as string;
  if (!source?.startsWith("broker:")) {
    throw createError({ statusCode: 400, statusMessage: "Missing broker source" });
  }

  const symbol = body.symbol as string;
  const timeframe = body.timeframe as string;
  const before = body.before ? Number(body.before) : null;
  const limit = body.limit ? Number(body.limit) : null;

  // ── 1. Cache check ──
  const cached = getCachedOhlcv(source, symbol, timeframe);
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

  // ── 2. Try direct IG fetch ──
  const accountId = source.replace("broker:", "");
  const epic = SYMBOL_TO_EPIC[symbol];
  const resolution = epic ? TIMEFRAME_TO_IG_RESOLUTION[timeframe] : undefined;
  const fetchLimit = 1000; // Max from broker API

  if (epic && resolution) {
    try {
      const client = await createIGClient(accountId);
      const bars = await client.fetchLatestPrices(epic, resolution, fetchLimit);

      setCachedOhlcv(source, symbol, timeframe, bars);

      const sliced = sliceBars(bars, before, limit);
      return {
        symbol,
        timeframe,
        total: bars.length,
        count: sliced.length,
        data: sliced,
      };
    } catch (error: any) {
      console.warn(`[ohlcv] Direct IG fetch failed (${error.message}), falling back to fwbg`);
    }
  }

  // ── 3. Fallback: proxy through fwbg (has yfinance fallback) ──
  const accounts = await loadAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) {
    throw createError({ statusCode: 404, statusMessage: `Account not found: ${accountId}` });
  }

  try {
    const result = await fwbgFetch<FwbgOhlcvResponse>("/api/chart/ohlcv", {
      method: "POST",
      body: JSON.stringify({
        symbol,
        timeframe,
        limit: fetchLimit,
        broker_type: "ig",
        credentials: {
          api_key: account.credentials.api_key,
          username: account.credentials.username,
          password: account.credentials.password,
          acc_type: account.credentials.acc_type,
        },
      }),
    });

    if (result.data?.length > 0) {
      setCachedOhlcv(source, symbol, timeframe, result.data);
    }

    const allBars = result.data ?? [];
    const sliced = sliceBars(allBars, before, limit);
    return {
      symbol,
      timeframe,
      total: allBars.length,
      count: sliced.length,
      data: sliced,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to fetch OHLCV data: ${error.message}`,
    });
  }
});
