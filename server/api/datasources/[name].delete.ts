import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;
  await fwbgFetch<void>(`/api/datasources/${name}`, { method: "DELETE" });
  return { ok: true };
});
