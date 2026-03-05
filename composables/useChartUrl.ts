import type { RunDetail } from "~/types/strategy";

interface ChartIndicatorParam {
  fqn: string;
  params: Record<string, unknown>;
  columns?: string[];
  isSignal?: boolean;
}

/**
 * Build a /chart URL for a run+symbol with all indicators embedded.
 *
 * Extracts datasource, timeframe, and pipeline indicators from the run's
 * strategy config so the chart page can restore everything from the URL
 * without a separate fetch.
 */
export function buildRunChartUrl(
  detail: RunDetail,
  symbol: string,
  plugins: { name: string; fqn: string }[],
): string {
  const strategy = detail.strategy;
  const config = detail.config as Record<string, unknown> | undefined;
  const params = new URLSearchParams();

  params.set("run", detail.run_id);
  params.set("symbol", symbol);
  if (strategy?.datasource) params.set("source", strategy.datasource);
  const tf = (config?.timeframe as string) ?? strategy?.timeframe;
  if (tf) params.set("timeframe", tf);

  const indicators: ChartIndicatorParam[] = [];
  for (const entry of strategy?.pipeline?.indicators ?? []) {
    const plugin = plugins.find((p) => p.name === entry.name);
    if (!plugin) continue;
    const p = entry.params ?? {};
    // Plot columns (restoreFromUrl picks response.plot_columns when columns=[])
    indicators.push({ fqn: plugin.fqn, params: p, columns: [] });
    // Signal columns
    indicators.push({ fqn: plugin.fqn, params: p, columns: [], isSignal: true });
  }

  if (indicators.length > 0) {
    params.set("indicators", JSON.stringify(indicators));
  }

  return `/chart?${params.toString()}`;
}
