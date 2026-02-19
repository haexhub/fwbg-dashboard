/**
 * GET /api/exploration/exit-optimization
 * List all cached exit optimization results (summary only).
 */
export default defineEventHandler(async () => {
  return fwbgFetch<unknown[]>("/api/exploration/exit-optimization");
});
