/**
 * GET /api/entry-modifiers
 * Proxy to fwbg API: list available entry modifier plugins with schemas.
 */
export default defineEventHandler(async () => {
  return fwbgFetch<unknown[]>("/api/entry-modifiers");
});
