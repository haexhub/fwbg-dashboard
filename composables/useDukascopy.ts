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

export interface DukascopyParams {
  name: string;
  description?: string;
  symbols: string[];
  timeframe: string;
  start: string; // ISO date (YYYY-MM-DD)
  end: string;
  offer_side: string; // "bid" | "ask"
}

export interface DukascopyDownloadResult {
  symbol: string;
  file: string;
  rows: number;
  warning?: string;
}

export interface DukascopyTask {
  status: "running" | "done" | "error";
  result: DukascopyDownloadResult[] | null;
  error: string | null;
}

export function useDukascopy() {
  async function createSourceAndDownload(p: DukascopyParams): Promise<DukascopyTask> {
    // Reuse the source if it already exists (409), otherwise create it as CSV.
    try {
      await $fetch("/api/datasources", {
        method: "POST",
        body: { type: "csv", name: p.name, description: p.description ?? "" },
      });
    } catch (e) {
      if ((e as { statusCode?: number }).statusCode !== 409) throw e;
    }
    return download(p.name, p);
  }

  async function download(name: string, p: DukascopyParams): Promise<DukascopyTask> {
    const { task_id } = await $fetch<{ task_id: string }>(
      `/api/datasources/${name}/dukascopy`,
      {
        method: "POST",
        body: {
          symbols: p.symbols,
          timeframe: p.timeframe,
          start: p.start,
          end: p.end,
          offer_side: p.offer_side,
        },
      },
    );
    return poll(name, task_id);
  }

  function poll(name: string, taskId: string): Promise<DukascopyTask> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const s = await $fetch<DukascopyTask>(
            `/api/datasources/${name}/dukascopy/${taskId}`,
          );
          if (s.status !== "running") {
            clearInterval(interval);
            resolve(s);
          }
        } catch (e) {
          clearInterval(interval);
          reject(e);
        }
      }, 1500);
    });
  }

  return { createSourceAndDownload, download, poll };
}
