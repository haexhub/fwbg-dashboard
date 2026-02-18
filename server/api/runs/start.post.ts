/**
 * POST /api/runs/start
 * Proxy to fwbg API: start a new optimization run.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgFetch<unknown>("/api/runs/start", {
    method: "POST",
    body: JSON.stringify(body),
  });
});
