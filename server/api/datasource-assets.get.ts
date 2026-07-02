import { fwbgFetch } from "~/server/utils/fwbg-api";
import type { AssetsResponse } from "~/types/datasource";

export default defineEventHandler(() => {
  return fwbgFetch<AssetsResponse>("/api/datasources/assets");
});
