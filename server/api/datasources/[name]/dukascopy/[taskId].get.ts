import { fwbgFetch } from "~/server/utils/fwbg-api";
import type { DukascopyTask } from "~/composables/useDukascopy";

/**
 * GET /api/datasources/:name/dukascopy/:taskId
 * Proxy to fwbg: poll a Dukascopy download task.
 */
export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name");
  const taskId = getRouterParam(event, "taskId");
  return fwbgFetch<DukascopyTask>(`/api/datasources/${name}/dukascopy/${taskId}`);
});
