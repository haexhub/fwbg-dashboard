// Client helper for the Dukascopy download flow: create (or reuse) a CSV
// source, kick off the background download in fwbg, and poll until done.
// The fwbg endpoint writes ready-to-backtest {SYMBOL}_{TF}.csv files straight
// into the source's datasource dir (no manual ETL needed).

export const DUKASCOPY_TIMEFRAMES = [
  "MINUTE_1",
  "MINUTE_5",
  "MINUTE_15",
  "MINUTE_30",
  "HOUR_1",
  "HOUR_4",
  "DAY_1",
] as const;

export type DukascopyTimeframe = (typeof DUKASCOPY_TIMEFRAMES)[number];

/** Dukascopy publishes history starts per candle granularity, not per timeframe. */
export type HistoryGranularity = "minute" | "hourly" | "daily";

/** Map each timeframe onto the history-start granularity it draws from. */
export const TIMEFRAME_GRANULARITY: Record<DukascopyTimeframe, HistoryGranularity> = {
  MINUTE_1: "minute",
  MINUTE_5: "minute",
  MINUTE_15: "minute",
  MINUTE_30: "minute",
  HOUR_1: "hourly",
  HOUR_4: "hourly",
  DAY_1: "daily",
};

export interface DukascopyInstrument {
  symbol: string; // normalized, ready to pass as a download symbol (e.g. "EURUSD")
  id: string; // dukascopy id (e.g. "EUR/USD")
  description: string;
  group: string; // asset class label (Forex, Krypto, …)
  historyStart: Record<HistoryGranularity, string | null>; // ISO dates (YYYY-MM-DD)
}

export interface DukascopyParams {
  name: string;
  description?: string;
  symbols: string[];
  timeframe: string;
  start: string; // ISO date (YYYY-MM-DD)
  end: string;
}

export interface DukascopyDownloadResult {
  symbol: string;
  file: string;
  rows: number;
  spread?: number; // measured bid-ask spread (price units), used in backtesting
  warning?: string;
}

export interface DukascopyProgress {
  percent: number;
  symbol: string;
  phase: "bid" | "ask" | "write";
  symbol_index: number;
  symbol_total: number;
}

export interface DukascopyTask {
  status: "running" | "done" | "error";
  result: DukascopyDownloadResult[] | null;
  error: string | null;
  progress?: DukascopyProgress | null;
}

/** Per-asset spread used in backtesting: measured p90, manual override, effective. */
export interface DukascopySpread {
  symbol: string;
  measured: number | null;
  manual: number | null;
  effective: number | null;
}

/**
 * Earliest date for which *all* selected instruments have data at the given
 * timeframe — i.e. the latest (most restrictive) history start across the
 * selection. Returns null when nothing is selected or no start is known.
 */
export function earliestAvailable(
  selected: DukascopyInstrument[],
  timeframe: DukascopyTimeframe,
): string | null {
  const granularity = TIMEFRAME_GRANULARITY[timeframe];
  let latest: string | null = null;
  for (const inst of selected) {
    const start = inst.historyStart[granularity];
    if (!start) continue;
    if (latest === null || start > latest) latest = start;
  }
  return latest;
}

export function useDukascopy() {
  async function fetchInstruments(): Promise<DukascopyInstrument[]> {
    return $fetch<DukascopyInstrument[]>("/api/dukascopy/instruments");
  }

  async function fetchSpreads(): Promise<DukascopySpread[]> {
    return $fetch<DukascopySpread[]>("/api/dukascopy/spreads");
  }

  /** Set (spread>0) or clear (null) the manual spread override for a symbol. */
  async function setSpread(symbol: string, spread: number | null): Promise<DukascopySpread> {
    return $fetch<DukascopySpread>(`/api/dukascopy/spreads/${encodeURIComponent(symbol)}`, {
      method: "PUT",
      body: { spread },
    });
  }

  type ProgressHandler = (task: DukascopyTask) => void;

  async function createSourceAndDownload(
    p: DukascopyParams,
    onProgress?: ProgressHandler,
  ): Promise<DukascopyTask> {
    // Reuse the source if it already exists (409), otherwise create it as CSV.
    try {
      await $fetch("/api/datasources", {
        method: "POST",
        body: { type: "csv", name: p.name, description: p.description ?? "" },
      });
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode !== 409) throw e;
    }
    return download(p.name, p, onProgress);
  }

  async function download(
    name: string,
    p: DukascopyParams,
    onProgress?: ProgressHandler,
  ): Promise<DukascopyTask> {
    const { task_id } = await $fetch<{ task_id: string }>(
      `/api/datasources/${name}/dukascopy`,
      {
        method: "POST",
        body: {
          symbols: p.symbols,
          timeframe: p.timeframe,
          start: p.start,
          end: p.end,
        },
      },
    );
    return poll(name, task_id, onProgress);
  }

  function poll(
    name: string,
    taskId: string,
    onProgress?: ProgressHandler,
  ): Promise<DukascopyTask> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const s = await $fetch<DukascopyTask>(
            `/api/datasources/${name}/dukascopy/${taskId}`,
          );
          onProgress?.(s);
          if (s.status !== "running") {
            clearInterval(interval);
            resolve(s);
          }
        } catch (e) {
          clearInterval(interval);
          reject(e);
        }
      }, 1000);
    });
  }

  return { fetchInstruments, fetchSpreads, setSpread, createSourceAndDownload, download, poll };
}
