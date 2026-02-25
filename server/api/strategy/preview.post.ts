/**
 * POST /api/strategy/preview
 * Start a lightweight preview run for a single asset class (first N days).
 *
 * Body: { strategy_name: string, asset: string, days_limit?: number }
 * Returns: { job_id: string, status: string }
 *
 * Tries fwbg /api/preview first; if not available falls back to
 * /api/runs/start with asset_classes + preview hints so the feature
 * works without a dedicated backend endpoint.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{
    strategy_name: string;
    asset: string;
    days_limit?: number;
  }>(event);

  // Try dedicated preview endpoint first
  try {
    return await fwbgFetch<unknown>("/api/preview", {
      method: "POST",
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    const status = (err as { statusCode?: number })?.statusCode;
    // Fall back to regular run start if endpoint doesn't exist yet
    if (status !== 404 && status !== 405) throw err;
  }

  // Fallback: use the existing runs/start endpoint
  return fwbgFetch<unknown>("/api/runs/start", {
    method: "POST",
    body: JSON.stringify({
      strategy_name: body.strategy_name,
      asset_classes: [body.asset],
      description: `preview · ${body.asset} · ${body.days_limit ?? 60}d`,
      preview: true,
      days_limit: body.days_limit ?? 60,
    }),
  });
});
