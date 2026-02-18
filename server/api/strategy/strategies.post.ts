/**
 * POST /api/strategy/strategies
 * Proxy to fwbg API: create a new strategy file.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgFetch<unknown>("/api/strategies", {
    method: "POST",
    body: JSON.stringify(body),
  });
});
