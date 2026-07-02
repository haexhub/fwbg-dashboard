import { fwbgFetch } from "~/server/utils/fwbg-api";
import type { AssetClassesResponse } from "~/types/agents";

/**
 * GET /api/assets-classes
 * Proxy to fwbg's asset registry — the single source of truth for the
 * controlled asset-class vocabulary (and known symbols per class). The research
 * brief form consumes this so its dropdown can never drift from the backend.
 */
export default defineEventHandler(() => {
  return fwbgFetch<AssetClassesResponse>("/api/assets/classes");
});
