import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;
  const body = await readBody(event);
  return fwbgFetch<Record<string, unknown>>(`/api/datasources/${name}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
