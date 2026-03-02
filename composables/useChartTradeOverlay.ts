import type { Chart } from "klinecharts";
import type { PluginInfo } from "~/types/strategy";
import type { ActiveIndicator, IndicatorResponse } from "~/types/chart";
import {
  TRADE_MARKER_NAME,
  ensureTradeMarkerRegistered,
  updateTradeMarkerData,
  clearTradeMarkerData,
  type RunTradeMarker,
  registerFwbgIndicator,
  registerFwbgSignalIndicator,
  LINE_COLORS,
} from "~/composables/useChartIndicators";
import { extractSignalTransitions } from "~/composables/useChartSignalNav";

interface RunTradesResponse {
  symbol: string;
  run_id: string;
  trades: Array<{
    entry_time?: string;
    exit_time?: string;
    entry_price?: number;
    exit_price?: number;
    direction?: string;
    result?: number;
    pnl_raw?: number;
    tp_level?: number;
    sl_level?: number;
    fold_id?: number;
  }>;
}

function parseUTC(s: string): number {
  if (s.includes("Z") || s.includes("+") || s.match(/-\d{2}:\d{2}$/)) return new Date(s).getTime();
  return new Date(s + "Z").getTime();
}

export interface TradeOverlayContext {
  symbol: Ref<string>;
  timeframe: Ref<string>;
  source: Ref<string>;
  indicatorPlugins: Ref<PluginInfo[]>;
  activeIndicators: Ref<ActiveIndicator[]>;
  addIndicator: (ind: ActiveIndicator) => void;
  getChart: () => Chart | null;
  adjustLayout: () => void;
  scrollToTimestamp: (ts: number) => void;
  limit: number;
}

export function useChartTradeOverlay() {
  const tradeOverlayActive = ref(false);
  const tradeOverlayCount = ref(0);
  const runIndicatorsLoaded = ref(false);

  async function loadRunIndicators(runId: string, ctx: TradeOverlayContext) {
    if (runIndicatorsLoaded.value) return;
    if (ctx.indicatorPlugins.value.length === 0) return;

    try {
      type RunWithStrategy = { strategy?: { pipeline?: { indicators?: Array<{ name: string; params: Record<string, unknown> }> } } };
      const runDetail = await $fetch<RunWithStrategy>(`/api/runs/${runId}`);
      const indicatorEntries = runDetail.strategy?.pipeline?.indicators ?? [];
      if (indicatorEntries.length === 0) return;

      runIndicatorsLoaded.value = true;

      for (const entry of indicatorEntries) {
        const plugin = ctx.indicatorPlugins.value.find((p) => p.name === entry.name);
        if (!plugin) continue;
        if (ctx.activeIndicators.value.some((a) => a.fqn === plugin.fqn)) continue;

        try {
          const response = await $fetch<IndicatorResponse>("/api/chart/indicator", {
            method: "POST",
            body: {
              symbol: ctx.symbol.value,
              timeframe: ctx.timeframe.value,
              source: ctx.source.value,
              fqn: plugin.fqn,
              params: { ...plugin.defaults, ...entry.params },
              limit: ctx.limit,
            },
          });

          const plotCols = response.plot_columns ?? [];
          const sigCols = response.signal_columns ?? [];
          const chart = ctx.getChart();

          if (plotCols.length > 0) {
            const instanceId = `fwbg_${plugin.name}_${Date.now()}`;
            const colors: Record<string, string> = {};
            plotCols.forEach((col, i) => { colors[col] = LINE_COLORS[i % LINE_COLORS.length]!; });
            registerFwbgIndicator(instanceId, response, plotCols, colors);
            chart?.createIndicator({ name: instanceId }, false, { height: 120 });
            const paneId = chart ? (chart.getIndicators({ name: instanceId })[0] as any)?.paneId ?? "" : "";
            ctx.addIndicator({ id: instanceId, fqn: plugin.fqn, name: plugin.name, params: entry.params ?? plugin.defaults, columns: plotCols, paneId });
          }

          if (sigCols.length > 0) {
            const sigId = `fwbg_sig_${plugin.name}_${Date.now()}`;
            const sigColors: Record<string, string> = {};
            sigCols.forEach((col, i) => { sigColors[col] = LINE_COLORS[i % LINE_COLORS.length]!; });
            registerFwbgSignalIndicator(sigId, response, sigCols, sigColors);
            chart?.createIndicator({ name: sigId }, false, { height: 80 });
            const paneId = chart ? (chart.getIndicators({ name: sigId })[0] as any)?.paneId ?? "" : "";
            const transitions = extractSignalTransitions(response, sigCols);
            ctx.addIndicator({ id: sigId, fqn: plugin.fqn, name: `${plugin.name} (signal)`, params: entry.params ?? plugin.defaults, columns: sigCols, paneId, isSignal: true, signalTimestamps: transitions.timestamps, signalValueMap: transitions.valueMap });
          }
        } catch (e) {
          console.warn(`[run indicators] Skipping ${plugin.fqn}:`, e);
        }
      }
      nextTick(ctx.adjustLayout);
    } catch (e) {
      console.warn("Failed to load run indicators:", e);
    }
  }

  async function loadTradeOverlay(runId: string, sym: string, ctx: TradeOverlayContext) {
    try {
      const [resp] = await Promise.all([
        $fetch<RunTradesResponse>(`/api/runs/${runId}/trades/${sym}`),
        loadRunIndicators(runId, ctx),
      ]);

      const markers: RunTradeMarker[] = resp.trades
        .filter((t) => t.entry_time && t.entry_price != null)
        .map((t) => ({
          entryTime: parseUTC(t.entry_time!),
          exitTime: t.exit_time ? parseUTC(t.exit_time) : parseUTC(t.entry_time!),
          entryPrice: t.entry_price!,
          exitPrice: t.exit_price ?? t.entry_price!,
          direction: (t.direction ?? "LONG") as "LONG" | "SHORT",
          result: t.result ?? 0,
          pnlRaw: t.pnl_raw ?? 0,
          tpLevel: t.tp_level,
          slLevel: t.sl_level,
          foldId: t.fold_id,
        }));

      updateTradeMarkerData(markers);
      tradeOverlayCount.value = markers.length;

      const chart = ctx.getChart();
      if (chart) {
        ensureTradeMarkerRegistered();
        chart.removeIndicator({ name: TRADE_MARKER_NAME });
        chart.createIndicator({ name: TRADE_MARKER_NAME }, true, { id: "candle_pane" });
        tradeOverlayActive.value = true;

        const first = markers.reduce<RunTradeMarker | null>(
          (min, m) => (!min || m.entryTime < min.entryTime ? m : min),
          null,
        );
        if (first) {
          nextTick(() => ctx.scrollToTimestamp(first.entryTime));
        }
      }
    } catch (e) {
      console.error("Failed to load run trade overlay:", e);
    }
  }

  function clearOverlay(getChart: () => Chart | null) {
    const chart = getChart();
    if (chart) chart.removeIndicator({ name: TRADE_MARKER_NAME });
    clearTradeMarkerData();
    tradeOverlayActive.value = false;
    tradeOverlayCount.value = 0;
  }

  function resetFlags() {
    runIndicatorsLoaded.value = false;
  }

  return {
    tradeOverlayActive,
    tradeOverlayCount,
    runIndicatorsLoaded,
    loadRunIndicators,
    loadTradeOverlay,
    clearOverlay,
    resetFlags,
  };
}
