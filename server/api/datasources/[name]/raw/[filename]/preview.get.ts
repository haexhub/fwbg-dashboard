import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const name = getRouterParam(event, "name")!;
  const filename = getRouterParam(event, "filename")!;
  return fwbgFetch<{ columns: string[]; rows: unknown[][] }>(
    `/api/datasources/${name}/raw/${filename}/preview`,
  );
});
