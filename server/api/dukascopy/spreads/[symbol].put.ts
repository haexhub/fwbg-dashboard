import { fwbgFetch } from "~/server/utils/fwbg-api";
import type { DukascopySpread } from "~/composables/useDukascopy";

/**
 * PUT /api/dukascopy/spreads/:symbol
 * Proxy to fwbg: set ({spread}>0) or clear (null) the manual spread override.
 */
export default defineEventHandler(async (event) => {
  const symbol = getRouterParam(event, "symbol");
  const body = await readBody(event);
  return fwbgFetch<DukascopySpread>(`/api/dukascopy/spreads/${symbol}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
});
