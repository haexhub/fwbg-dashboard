import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;
  const taskId = getRouterParam(event, "taskId")!;
  return fwbgFetch<{ status: string; result: string[] | null; error: string | null }>(
    `/api/datasources/${name}/prepare/${taskId}`,
  );
});
