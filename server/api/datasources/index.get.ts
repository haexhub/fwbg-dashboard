import { fwbgFetch } from "~/server/utils/fwbg-api";

export default defineEventHandler(async () => {
  return fwbgFetch<Record<string, unknown>[]>("/api/datasources");
});
