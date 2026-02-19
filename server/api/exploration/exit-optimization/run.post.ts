/**
 * POST /api/exploration/exit-optimization/run
 * Execute exit optimization analysis for an asset.
 * Long-running operation — timeout set to 180s.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  return fwbgFetch<unknown>("/api/exploration/exit-optimization", {
    method: "POST",
    body: JSON.stringify(body),
    timeout: 180_000,
  });
});
