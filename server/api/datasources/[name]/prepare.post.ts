import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;
  const body = await readBody(event);
  return fwbgFetch<{ task_id: string }>(
    `/api/datasources/${name}/prepare`,
    { method: "POST", body: JSON.stringify(body) },
  );
});
