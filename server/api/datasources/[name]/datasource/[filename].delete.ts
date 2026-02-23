import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;
  const filename = getRouterParam(event, "filename")!;
  await fwbgFetch<void>(`/api/datasources/${name}/datasource/${filename}`, { method: "DELETE" });
  return { ok: true };
});
