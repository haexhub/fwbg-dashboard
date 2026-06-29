import { fwbgFetch } from "~/server/utils/fwbg-api";

/**
 * POST /api/datasources/:name/dukascopy
 * Proxy to fwbg: start a background Dukascopy download into the source's
 * datasource dir. Returns a { task_id } to poll.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  const body = await readBody(event);
  return fwbgFetch<{ task_id: string }>(`/api/datasources/${name}/dukascopy`, {
    method: "POST",
    body: JSON.stringify(body),
  });
});
