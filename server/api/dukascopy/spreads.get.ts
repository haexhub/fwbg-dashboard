import { fwbgFetch } from "~/server/utils/fwbg-api";
import type { DukascopySpread } from "~/composables/useDukascopy";

/**
 * GET /api/dukascopy/spreads
 * Proxy to fwbg: per-asset backtest spreads (measured p90, manual override, effective).
 */
export default defineEventHandler(() =>
  fwbgFetch<DukascopySpread[]>("/api/dukascopy/spreads"),
);
