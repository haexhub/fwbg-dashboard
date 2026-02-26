import type { Chart } from "klinecharts";
import type { PluginInfo } from "~/types/strategy";
import type { ActiveIndicator, IndicatorResponse } from "~/types/chart";
import {
  registerFwbgIndicator,
  registerFwbgSignalIndicator,
  LINE_COLORS,
} from "~/composables/useChartIndicators";
import { extractSignalTransitions } from "~/composables/useChartSignalNav";

export interface IndicatorActionContext {
  symbol: Ref<string>;
  timeframe: Ref<string>;
  source: Ref<string>;
  indicatorPlugins: Ref<PluginInfo[]>;
  activeIndicators: Ref<ActiveIndicator[]>;
  collapsedPanes: Ref<Record<string, boolean>>;
  addIndicator: (ind: ActiveIndicator) => void;
  removeIndicator: (id: string) => void;
  getChart: () => Chart | null;
  adjustLayout: () => void;
  limit: number;
}

export function useChartIndicatorActions() {
  async function handleAddIndicator(
    plugin: PluginInfo,
    params: Record<string, unknown>,
    selectedColumns: string[],
    colors: Record<string, string>,
    isMainOverlay: boolean,
    ctx: IndicatorActionContext,
  ) {
    try {
      const response = await $fetch<IndicatorResponse>("/api/chart/indicator", {
        method: "POST",
        body: {
          symbol: ctx.symbol.value,
          timeframe: ctx.timeframe.value,
          source: ctx.source.value,
          fqn: plugin.fqn,
          params,
          limit: ctx.limit,
        },
      });

      const instanceId = `fwbg_${plugin.name}_${Date.now()}`;
      registerFwbgIndicator(instanceId, response, selectedColumns, colors);

      const chart = ctx.getChart();
      let paneId = "";
      if (chart) {
        if (isMainOverlay) {
          paneId = chart.createIndicator({ name: instanceId }, true) ?? "";
        } else {
          paneId = chart.createIndicator({ name: instanceId }, false, { height: 150 }) ?? "";
        }
      }

      ctx.addIndicator({
        id: instanceId,
        fqn: plugin.fqn,
        name: plugin.name,
        params,
        columns: selectedColumns,
        paneId,
      });
      nextTick(ctx.adjustLayout);
    } catch (e) {
      console.error("Failed to add indicator:", e);
    }
  }

  async function handleAddSignalIndicator(
    plugin: PluginInfo,
    params: Record<string, unknown>,
    selectedColumns: string[],
    colors: Record<string, string>,
    ctx: IndicatorActionContext,
  ) {
    try {
      const response = await $fetch<IndicatorResponse>("/api/chart/indicator", {
        method: "POST",
        body: {
          symbol: ctx.symbol.value,
          timeframe: ctx.timeframe.value,
          source: ctx.source.value,
          fqn: plugin.fqn,
          params,
          limit: ctx.limit,
        },
      });

      const instanceId = `fwbg_sig_${plugin.name}_${Date.now()}`;
      registerFwbgSignalIndicator(instanceId, response, selectedColumns, colors);

      const chart = ctx.getChart();
      let paneId = "";
      if (chart) {
        paneId = chart.createIndicator({ name: instanceId }, false, { height: 80 }) ?? "";
      }

      const transitions = extractSignalTransitions(response, selectedColumns);
      ctx.addIndicator({
        id: instanceId,
        fqn: plugin.fqn,
        name: `${plugin.name} (signal)`,
        params,
        columns: selectedColumns,
        paneId,
        isSignal: true,
        signalTimestamps: transitions.timestamps,
        signalValueMap: transitions.valueMap,
      });
      nextTick(ctx.adjustLayout);
    } catch (e) {
      console.error("Failed to add signal indicator:", e);
    }
  }

  async function handleAddAllDeps(
    triggerPlugin: PluginInfo,
    ctx: IndicatorActionContext,
  ) {
    const deps = ctx.indicatorPlugins.value.filter(
      (p) => p.fqn !== triggerPlugin.fqn,
    );
    const SIG_PALETTE = ["#4CAF50", "#E91E63", "#2196F3", "#FF9800", "#00BCD4", "#9C27B0"];

    for (const plugin of deps) {
      if (ctx.activeIndicators.value.some((a) => a.fqn === plugin.fqn)) continue;
      try {
        const response = await $fetch<IndicatorResponse>("/api/chart/indicator", {
          method: "POST",
          body: {
            symbol: ctx.symbol.value,
            timeframe: ctx.timeframe.value,
            source: ctx.source.value,
            fqn: plugin.fqn,
            params: plugin.defaults,
            limit: ctx.limit,
          },
        });

        const plotCols = response.plot_columns ?? [];
        const sigCols = response.signal_columns ?? [];
        if (plotCols.length === 0 && sigCols.length === 0) continue;
        const chart = ctx.getChart();

        if (plotCols.length > 0) {
          const instanceId = `fwbg_${plugin.name}_${Date.now()}`;
          const colors: Record<string, string> = {};
          plotCols.forEach((col, i) => { colors[col] = LINE_COLORS[i % LINE_COLORS.length]!; });
          registerFwbgIndicator(instanceId, response, plotCols, colors);
          const paneId = chart?.createIndicator({ name: instanceId }, false, { height: 120 }) ?? "";
          ctx.addIndicator({ id: instanceId, fqn: plugin.fqn, name: plugin.name, params: plugin.defaults, columns: plotCols, paneId });
        }

        if (sigCols.length > 0) {
          const sigId = `fwbg_sig_${plugin.name}_${Date.now()}`;
          const sigColors: Record<string, string> = {};
          sigCols.forEach((col, i) => { sigColors[col] = SIG_PALETTE[i % SIG_PALETTE.length]!; });
          registerFwbgSignalIndicator(sigId, response, sigCols, sigColors);
          const paneId = chart?.createIndicator({ name: sigId }, false, { height: 80 }) ?? "";
          const transitions = extractSignalTransitions(response, sigCols);
          ctx.addIndicator({ id: sigId, fqn: plugin.fqn, name: `${plugin.name} (signal)`, params: plugin.defaults, columns: sigCols, paneId, isSignal: true, signalTimestamps: transitions.timestamps, signalValueMap: transitions.valueMap });
        }
      } catch (e) {
        console.warn(`Skipping ${plugin.fqn}:`, e);
      }
    }
    nextTick(ctx.adjustLayout);
  }

  function handleRemoveIndicator(id: string, ctx: IndicatorActionContext) {
    const chart = ctx.getChart();
    if (chart && !ctx.collapsedPanes.value[id]) {
      chart.removeIndicator({ name: id });
    }
    delete ctx.collapsedPanes.value[id];
    ctx.removeIndicator(id);
    nextTick(ctx.adjustLayout);
  }

  async function restoreFromUrl(indJson: string, ctx: IndicatorActionContext) {
    try {
      const entries: Array<{
        fqn: string;
        params: Record<string, unknown>;
        columns: string[];
        isSignal?: boolean;
      }> = JSON.parse(indJson);

      for (const entry of entries) {
        if (ctx.activeIndicators.value.some((a) => a.fqn === entry.fqn)) continue;
        const plugin = ctx.indicatorPlugins.value.find((p) => p.fqn === entry.fqn);
        if (!plugin) continue;

        try {
          const response = await $fetch<IndicatorResponse>("/api/chart/indicator", {
            method: "POST",
            body: {
              symbol: ctx.symbol.value,
              timeframe: ctx.timeframe.value,
              source: ctx.source.value,
              fqn: entry.fqn,
              params: entry.params,
              limit: ctx.limit,
            },
          });

          const chart = ctx.getChart();
          if (entry.isSignal) {
            const sigId = `fwbg_sig_${plugin.name}_${Date.now()}`;
            const colors: Record<string, string> = {};
            entry.columns.forEach((col, i) => { colors[col] = LINE_COLORS[i % LINE_COLORS.length]!; });
            registerFwbgSignalIndicator(sigId, response, entry.columns, colors);
            const paneId = chart?.createIndicator({ name: sigId }, false, { height: 80 }) ?? "";
            const transitions = extractSignalTransitions(response, entry.columns);
            ctx.addIndicator({ id: sigId, fqn: entry.fqn, name: `${plugin.name} (signal)`, params: entry.params, columns: entry.columns, paneId, isSignal: true, signalTimestamps: transitions.timestamps, signalValueMap: transitions.valueMap });
          } else {
            const instanceId = `fwbg_${plugin.name}_${Date.now()}`;
            const colors: Record<string, string> = {};
            entry.columns.forEach((col, i) => { colors[col] = LINE_COLORS[i % LINE_COLORS.length]!; });
            registerFwbgIndicator(instanceId, response, entry.columns, colors);
            const paneId = chart?.createIndicator({ name: instanceId }, false, { height: 120 }) ?? "";
            ctx.addIndicator({ id: instanceId, fqn: entry.fqn, name: plugin.name, params: entry.params, columns: entry.columns, paneId });
          }
        } catch (e) {
          console.warn(`[restore] Skipping ${entry.fqn}:`, e);
        }
      }
      nextTick(ctx.adjustLayout);
    } catch (e) {
      console.warn("[restore] Invalid ind param:", e);
    }
  }

  return {
    handleAddIndicator,
    handleAddSignalIndicator,
    handleAddAllDeps,
    handleRemoveIndicator,
    restoreFromUrl,
  };
}
