/**
 * POST /api/exploration/exit-optimization/run
 * Execute exit optimization analysis for an asset.
 * fwbg records it in the research register first and refuses it like a run start.
 * Long-running operation — timeout set to 180s.
 */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, exitOptimizationBodySchema.parse);

  return fwbgFetch<unknown>("/api/exploration/exit-optimization", {
    method: "POST",
    body: JSON.stringify(body),
    timeout: 180_000,
  });
});
