/**
 * POST /api/strategy/preview
 * Synchronous signal preview for a single symbol — no optimization, no polling.
 * fwbg records it in the research register first and refuses it like a run start.
 *
 * Body: { strategy_name, asset, research_id, note, reason?, last_n_bars? }
 * Returns: { symbol, timeframe, total_bars, trades: TradeEntry[] }
 */
export default defineEventHandler(async (event) => {
  const { asset, ...body } = await readValidatedBody(event, previewBodySchema.parse);

  return fwbgFetch<unknown>("/api/runs/preview", {
    method: "POST",
    body: JSON.stringify({ ...body, symbol: asset }),
  });
});
