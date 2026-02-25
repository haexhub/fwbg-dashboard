/**
 * POST /api/strategy/preview
 * Start a lightweight preview run for a single asset (first N days).
 * Proxies to fwbg /api/preview.
 *
 * Body: { strategy_name: string, asset: string, days_limit?: number }
 * Returns: { run_id: string } (or { job_id: string })
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgFetch<unknown>("/api/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
});
