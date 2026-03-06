/**
 * POST /api/strategy/strategies/:name/commit
 * Proxy to fwbg API: git-commit the current state of a strategy file.
 * Body: { message: string }
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  const body = await readBody(event);
  return fwbgFetch<{ filename: string; hash: string; status: string }>(
    `/api/strategies/${name}/commit`,
    { method: "POST", body: JSON.stringify(body) },
  );
});
