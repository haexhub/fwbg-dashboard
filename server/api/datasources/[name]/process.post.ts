import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;
  const body = await readBody(event);
  return fwbgFetch<{ output: string; rows: number }>(
    `/api/datasources/${name}/process`,
    { method: "POST", body: JSON.stringify(body) },
  );
});
