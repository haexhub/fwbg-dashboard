import { fwbgFetch } from "~/server/utils/fwbg-api";
import type { DukascopyInstrument } from "~/composables/useDukascopy";

/**
 * GET /api/dukascopy/instruments
 * Proxy to fwbg: catalogue of downloadable Dukascopy instruments with their
 * per-timeframe history-start dates. Static data — cached for an hour.
 */
export default defineCachedEventHandler(
  () => fwbgFetch<DukascopyInstrument[]>("/api/dukascopy/instruments"),
  { maxAge: 60 * 60, name: "dukascopy-instruments", getKey: () => "all" },
);
