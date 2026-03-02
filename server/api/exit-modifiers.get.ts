/**
 * GET /api/exit-modifiers
 * Proxy to fwbg API: list available exit modifier plugins with schemas.
 */
export default defineEventHandler(async () => {
  return fwbgFetch<unknown[]>("/api/exit-modifiers");
});
