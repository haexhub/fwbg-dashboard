/**
 * GET /api/plugins
 * Proxy to fwbg API: list all plugins with schemas.
 * Query: ?phase=indicators
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const phase = query.phase ? `?phase=${query.phase}` : "";
  return fwbgFetch<unknown[]>(`/api/plugins${phase}`);
});
