import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  return fwbgFetch<Record<string, unknown>>("/api/datasources", {
    method: "POST",
    body: JSON.stringify(body),
  });
});
