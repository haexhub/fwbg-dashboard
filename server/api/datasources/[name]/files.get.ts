import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;
  try {
    return await fwbgFetch<Record<string, unknown>[]>(`/api/datasources/${name}/files`);
  } catch {
    return [];
  }
});
