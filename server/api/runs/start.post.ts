/**
 * POST /api/runs/start
 * Proxy to fwbg API: start a new optimization run.
 */
export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, runStartBodySchema.parse);
  return fwbgFetch<unknown>("/api/runs/start", {
    method: "POST",
    body: JSON.stringify(body),
    // fwbg runs its research preflight before answering, which takes up to 120 s.
    timeout: 150_000,
  });
});
