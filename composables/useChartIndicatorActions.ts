import type { Chart } from "klinecharts";
import type { PluginInfo } from "~/types/strategy";
import type { ActiveIndicator, IndicatorResponse } from "~/types/chart";
import {
  registerFwbgIndicator,
  registerFwbgSignalIndicator,
  registerFwbgOverlayIndicator,
  LINE_COLORS,
  ORB_ZONE_NAME,
  addOrbZoneData,
  removeOrbZoneData,
  hasOrbZones,
  ensureOrbZoneRegistered,
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

/** Extract session IDs from column names, e.g. "rb1_orb_s08_range" → "s08" */
function extractSessions(columns: string[]): Set<string> {
  const sessions = new Set<string>();
  for (const col of columns) {
    const match = col.match(/_s(\d{2})_/);
    if (match) sessions.add(`s${match[1]}`);
  }
  return sessions;
}

/** Strip param-dependent prefixes from column names so we can match by suffix.
 *  e.g. "rb2_cf3_prb1_orb_s00_range" → "orb_s00_range" */
export function stripParamPrefixes(col: string): string {
  return col.replace(/^(?:rb\d+_)?(?:cf\d+_)?(?:prb\d+_)?/, "");
}

/** Remap selectedColumns to response columns when param changes affect prefixes.
 *  Returns the original columns if they all match, or 1:1 remapped columns otherwise. */
export function remapColumns(selectedColumns: string[], responseCols: string[]): string[] {
  const responseSet = new Set(responseCols);
  if (selectedColumns.every(c => responseSet.has(c))) return selectedColumns;

  const strippedToResponse = new Map<string, string>();
  for (const rc of responseCols) {
    strippedToResponse.set(stripParamPrefixes(rc), rc);
  }

  const mapped: string[] = [];
  for (const sel of selectedColumns) {
    if (responseSet.has(sel)) {
      mapped.push(sel);
    } else {
      const match = strippedToResponse.get(stripParamPrefixes(sel));
      if (match) mapped.push(match);
    }
  }
  return mapped.length > 0 ? mapped : selectedColumns;
}

function refreshOrbZoneOverlay(chart: Chart | null) {
  if (!chart) return;
  chart.removeIndicator({ name: ORB_ZONE_NAME });
  if (hasOrbZones()) {
    ensureOrbZoneRegistered();
    chart.createIndicator({ name: ORB_ZONE_NAME, paneId: "candle_pane" }, true);
  }
}

/**
 * chart.createIndicator() returns indicator.id, NOT the pane ID.
 * Retrieve the actual pane ID so setPaneOptions works in adjustLayout.
 */
function getIndicatorPaneId(chart: import("klinecharts").Chart, name: string): string {
  const inds = chart.getIndicators({ name });
  return (inds[0] as any)?.paneId ?? "";
}

/** Create a new (non-stacked) indicator pane and set its initial height. */
function createIndicatorPane(chart: Chart, name: string, height: number): string {
  chart.createIndicator({ name }, false);
  const paneId = getIndicatorPaneId(chart, name);
  if (paneId) chart.setPaneOptions({ id: paneId, height });
  return paneId;
}

export function useChartIndicatorActions() {
  const loading = ref(false);

  async function handleAddIndicator(
    plugin: PluginInfo,
    params: Record<string, unknown>,
    selectedColumns: string[],
    colors: Record<string, string>,
    isMainOverlay: boolean,
    ctx: IndicatorActionContext,
    indicatorTimeframe?: string,
  ) {
    loading.value = true;
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
          ...(indicatorTimeframe ? { indicator_timeframe: indicatorTimeframe } : {}),
        },
      });

      const instanceId = `fwbg_${plugin.name}_${Date.now()}`;
      const validColumns = remapColumns(selectedColumns, response.plot_columns ?? []);
      // Carry over colors for remapped columns
      if (validColumns !== selectedColumns) {
        for (let i = 0; i < selectedColumns.length; i++) {
          const oldCol = selectedColumns[i]!;
          const newCol = validColumns[i];
          if (newCol && newCol !== oldCol && colors[oldCol]) {
            colors[newCol] = colors[oldCol]!;
          }
        }
      }
      registerFwbgIndicator(instanceId, response, validColumns, colors);

      const chart = ctx.getChart();
      let paneId = "";
      if (chart) {
        if (isMainOverlay) {
          chart.createIndicator({ name: instanceId, paneId: "candle_pane" }, true);
          paneId = "candle_pane";
        } else {
          paneId = createIndicatorPane(chart, instanceId, 150);
        }
      }

      // Add ORB range zones filtered to selected sessions
      if (response.range_zones?.length) {
        const activeSessions = extractSessions(validColumns);
        const filtered = response.range_zones.filter(z => activeSessions.has(z.session));
        if (filtered.length > 0) {
          addOrbZoneData(instanceId, plugin.fqn, filtered);
          refreshOrbZoneOverlay(chart);
        }
      }

      // Auto-register overlay columns (absolute price-scale values) on candle_pane
      let overlayId: string | undefined;
      const overlayCols = response.overlay_columns ?? [];
      if (overlayCols.length > 0 && chart) {
        overlayId = `${instanceId}_overlay`;
        const overlayColors: Record<string, string> = {};
        overlayCols.forEach((col, i) => {
          overlayColors[col] = LINE_COLORS[i % LINE_COLORS.length]!;
        });
        registerFwbgOverlayIndicator(overlayId, response, overlayCols, overlayColors);
        chart.createIndicator({ name: overlayId, paneId: "candle_pane" }, true);
      }

      ctx.addIndicator({
        id: instanceId,
        fqn: plugin.fqn,
        name: plugin.name,
        params,
        columns: validColumns,
        paneId,
        overlayId,
        indicatorTimeframe,
      });
      nextTick(ctx.adjustLayout);
    } catch (e) {
      console.error("Failed to add indicator:", e);
    } finally {
      loading.value = false;
    }
  }

  async function handleAddSignalIndicator(
    plugin: PluginInfo,
    params: Record<string, unknown>,
    selectedColumns: string[],
    colors: Record<string, string>,
    ctx: IndicatorActionContext,
    indicatorTimeframe?: string,
  ) {
    loading.value = true;
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
          ...(indicatorTimeframe ? { indicator_timeframe: indicatorTimeframe } : {}),
        },
      });

      const instanceId = `fwbg_sig_${plugin.name}_${Date.now()}`;
      const validColumns = remapColumns(selectedColumns, response.signal_columns ?? []);
      if (validColumns !== selectedColumns) {
        const SIG_PALETTE = ["#4CAF50", "#E91E63", "#2196F3", "#FF9800", "#00BCD4", "#9C27B0"];
        for (let i = 0; i < selectedColumns.length; i++) {
          const oldCol = selectedColumns[i]!;
          const newCol = validColumns[i];
          if (newCol && newCol !== oldCol) {
            colors[newCol] = colors[oldCol] ?? SIG_PALETTE[i % SIG_PALETTE.length]!;
          }
        }
      }
      registerFwbgSignalIndicator(instanceId, response, validColumns, colors);

      const chart = ctx.getChart();
      let paneId = "";
      if (chart) {
        paneId = createIndicatorPane(chart, instanceId, 80);
      }

      const transitions = extractSignalTransitions(response, validColumns);
      ctx.addIndicator({
        id: instanceId,
        fqn: plugin.fqn,
        name: `${plugin.name} (signal)`,
        params,
        columns: validColumns,
        paneId,
        isSignal: true,
        signalTimestamps: transitions.timestamps,
        signalValueMap: transitions.valueMap,
        indicatorTimeframe,
      });
      nextTick(ctx.adjustLayout);
    } catch (e) {
      console.error("Failed to add signal indicator:", e);
    } finally {
      loading.value = false;
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
          const paneId = chart ? createIndicatorPane(chart, instanceId, 120) : "";
          if (response.range_zones?.length) {
            const activeSessions = extractSessions(plotCols);
            const filtered = response.range_zones.filter(z => activeSessions.has(z.session));
            if (filtered.length > 0) addOrbZoneData(instanceId, plugin.fqn, filtered);
          }
          // Auto-register overlay columns on candle_pane
          let overlayId: string | undefined;
          const overlayCols = response.overlay_columns ?? [];
          if (overlayCols.length > 0 && chart) {
            overlayId = `${instanceId}_overlay`;
            const overlayColors: Record<string, string> = {};
            overlayCols.forEach((col, i) => { overlayColors[col] = LINE_COLORS[i % LINE_COLORS.length]!; });
            registerFwbgOverlayIndicator(overlayId, response, overlayCols, overlayColors);
            chart.createIndicator({ name: overlayId, paneId: "candle_pane" }, true);
          }
          ctx.addIndicator({ id: instanceId, fqn: plugin.fqn, name: plugin.name, params: plugin.defaults, columns: plotCols, paneId, overlayId });
        }

        if (sigCols.length > 0) {
          const sigId = `fwbg_sig_${plugin.name}_${Date.now()}`;
          const sigColors: Record<string, string> = {};
          sigCols.forEach((col, i) => { sigColors[col] = SIG_PALETTE[i % SIG_PALETTE.length]!; });
          registerFwbgSignalIndicator(sigId, response, sigCols, sigColors);
          const paneId = chart ? createIndicatorPane(chart, sigId, 80) : "";
          const transitions = extractSignalTransitions(response, sigCols);
          ctx.addIndicator({ id: sigId, fqn: plugin.fqn, name: `${plugin.name} (signal)`, params: plugin.defaults, columns: sigCols, paneId, isSignal: true, signalTimestamps: transitions.timestamps, signalValueMap: transitions.valueMap });
        }
      } catch (e) {
        console.warn(`Skipping ${plugin.fqn}:`, e);
      }
    }
    refreshOrbZoneOverlay(ctx.getChart());
    nextTick(ctx.adjustLayout);
  }

  function handleRemoveIndicator(id: string, ctx: IndicatorActionContext) {
    const chart = ctx.getChart();
    // Remove companion overlay indicator if present
    const indicator = ctx.activeIndicators.value.find((a) => a.id === id);
    if (indicator?.overlayId && chart) {
      chart.removeIndicator({ name: indicator.overlayId });
    }
    if (chart && !ctx.collapsedPanes.value[id]) {
      chart.removeIndicator({ name: id });
    }
    delete ctx.collapsedPanes.value[id];
    ctx.removeIndicator(id);

    // Remove any ORB range zones for this indicator
    removeOrbZoneData(id);
    refreshOrbZoneOverlay(chart);

    nextTick(ctx.adjustLayout);
  }

  let _restoring = false;

  async function restoreFromUrl(indJson: string, ctx: IndicatorActionContext) {
    if (_restoring) return;
    _restoring = true;
    loading.value = true;
    try {
      const entries: Array<{
        fqn: string;
        params: Record<string, unknown>;
        columns: string[];
        isSignal?: boolean;
        indicatorTimeframe?: string;
      }> = JSON.parse(indJson);

      for (const entry of entries) {
        if (ctx.activeIndicators.value.some((a) => a.fqn === entry.fqn && !!a.isSignal === !!entry.isSignal)) continue;
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
              ...(entry.indicatorTimeframe ? { indicator_timeframe: entry.indicatorTimeframe } : {}),
            },
          });

          const chart = ctx.getChart();
          const plotCols = entry.columns.length > 0 ? entry.columns : (entry.isSignal ? response.signal_columns : response.plot_columns) ?? [];
          if (plotCols.length === 0) continue;

          if (entry.isSignal) {
            const sigId = `fwbg_sig_${plugin.name}_${Date.now()}`;
            const colors: Record<string, string> = {};
            plotCols.forEach((col, i) => { colors[col] = LINE_COLORS[i % LINE_COLORS.length]!; });
            registerFwbgSignalIndicator(sigId, response, plotCols, colors);
            const paneId = chart ? createIndicatorPane(chart, sigId, 80) : "";
            const transitions = extractSignalTransitions(response, plotCols);
            ctx.addIndicator({ id: sigId, fqn: entry.fqn, name: `${plugin.name} (signal)`, params: entry.params, columns: plotCols, paneId, isSignal: true, signalTimestamps: transitions.timestamps, signalValueMap: transitions.valueMap, indicatorTimeframe: entry.indicatorTimeframe });
          } else {
            const instanceId = `fwbg_${plugin.name}_${Date.now()}`;
            const colors: Record<string, string> = {};
            plotCols.forEach((col, i) => { colors[col] = LINE_COLORS[i % LINE_COLORS.length]!; });
            registerFwbgIndicator(instanceId, response, plotCols, colors);
            const paneId = chart ? createIndicatorPane(chart, instanceId, 120) : "";
            if (response.range_zones?.length) {
              const activeSessions = extractSessions(plotCols);
              const filtered = response.range_zones.filter(z => activeSessions.has(z.session));
              if (filtered.length > 0) addOrbZoneData(instanceId, entry.fqn, filtered);
            }
            ctx.addIndicator({ id: instanceId, fqn: entry.fqn, name: plugin.name, params: entry.params, columns: plotCols, paneId, indicatorTimeframe: entry.indicatorTimeframe });
          }

          // Settle layout after each indicator — matches manual add flow
          await nextTick();
          ctx.adjustLayout();
        } catch (e) {
          console.warn(`[restore] Skipping ${entry.fqn}:`, e);
        }
      }
      refreshOrbZoneOverlay(ctx.getChart());
      await nextTick();
      ctx.adjustLayout();
    } catch (e) {
      console.warn("[restore] Invalid ind param:", e);
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    handleAddIndicator,
    handleAddSignalIndicator,
    handleAddAllDeps,
    handleRemoveIndicator,
    restoreFromUrl,
  };
}
