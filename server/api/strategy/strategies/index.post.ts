/**
 * POST /api/strategy/strategies
 * Proxy to fwbg API: create a new strategy file.
 * Body: { name: string, data: Record<string, unknown> }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgFetch<{ filename: string; name: string; status: string }>(
    "/api/strategies",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
});
