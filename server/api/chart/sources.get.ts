/**
 * GET /api/chart/sources
 * Proxy to fwbg API: list available data sources.
 * Merges CSV sources from fwbg with configured broker accounts.
 */

import type { ChartSymbol } from "~/types/chart";

/** Timeframes supported by the fwbg broker adapter */
const IG_TIMEFRAMES = ["MINUTE_1", "MINUTE_5", "MINUTE_15", "MINUTE_30", "HOUR", "DAY"];

/** All symbols supported by the fwbg IG adapter (mapped to SYMBOL_TO_EPIC in Python) */
const IG_SYMBOLS: ChartSymbol[] = [
  // Forex Majors
  { symbol: "EURUSD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "GBPUSD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "USDJPY", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "USDCHF", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "USDCAD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "AUDUSD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "NZDUSD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  // Forex Crosses - EUR
  { symbol: "EURCAD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "EURCHF", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "EURGBP", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "EURJPY", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "EURAUD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "EURNZD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  // Forex Crosses - GBP
  { symbol: "GBPAUD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "GBPCAD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "GBPCHF", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "GBPJPY", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "GBPNZD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  // Forex Crosses - AUD
  { symbol: "AUDCAD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "AUDCHF", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "AUDJPY", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "AUDNZD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  // Forex Crosses - NZD
  { symbol: "NZDCAD", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "NZDCHF", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "NZDJPY", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  // Forex Crosses - CAD/CHF
  { symbol: "CADCHF", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "CADJPY", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  { symbol: "CHFJPY", timeframes: IG_TIMEFRAMES, asset_class: "FOREX" },
  // Indices
  { symbol: "DAX", timeframes: IG_TIMEFRAMES, asset_class: "INDEX" },
  { symbol: "DOW30", timeframes: IG_TIMEFRAMES, asset_class: "INDEX" },
  { symbol: "NAS100", timeframes: IG_TIMEFRAMES, asset_class: "INDEX" },
  { symbol: "SPX500", timeframes: IG_TIMEFRAMES, asset_class: "INDEX" },
  { symbol: "FTSE100", timeframes: IG_TIMEFRAMES, asset_class: "INDEX" },
  // Commodities
  { symbol: "XAUUSD", timeframes: IG_TIMEFRAMES, asset_class: "COMMODITY" },
  { symbol: "XAGUSD", timeframes: IG_TIMEFRAMES, asset_class: "COMMODITY" },
  { symbol: "BRENT", timeframes: IG_TIMEFRAMES, asset_class: "COMMODITY" },
  { symbol: "WTI", timeframes: IG_TIMEFRAMES, asset_class: "COMMODITY" },
  // Crypto
  { symbol: "BTCUSD", timeframes: IG_TIMEFRAMES, asset_class: "CRYPTO" },
  { symbol: "ETHUSD", timeframes: IG_TIMEFRAMES, asset_class: "CRYPTO" },
];

export default defineEventHandler(async () => {
  // Get CSV sources from fwbg
  const csvSources = await fwbgFetch<unknown[]>("/api/chart/sources");

  // Get configured broker accounts and add as additional sources
  const accounts = await loadAccounts();
  const brokerSources = accounts
    .filter((a) => a.isActive)
    .map((a) => ({
      name: `broker:${a.id}`,
      type: "broker" as const,
      description: `${a.name} (${a.credentials?.acc_type || "UNKNOWN"})`,
      broker_type: "ig",
      account_id: a.id,
      symbols: IG_SYMBOLS,
    }));

  return [...csvSources, ...brokerSources];
});
