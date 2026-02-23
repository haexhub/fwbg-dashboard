import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;
  return fwbgFetch<Record<string, unknown>>(`/api/datasources/${name}`);
});
