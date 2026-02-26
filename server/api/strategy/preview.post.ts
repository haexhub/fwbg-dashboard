/**
 * POST /api/strategy/preview
 * Synchronous signal preview for a single symbol — no optimization, no polling.
 *
 * Body: { strategy_name: string, asset: string, last_n_bars?: number }
 * Returns: { symbol, timeframe, total_bars, trades: TradeEntry[] }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    strategy_name: string;
    asset: string;
    last_n_bars?: number;
  }>(event);

  return fwbgFetch<unknown>("/api/runs/preview", {
    method: "POST",
    body: JSON.stringify({
      strategy_name: body.strategy_name,
      symbol: body.asset,
      last_n_bars: body.last_n_bars,
    }),
  });
});
