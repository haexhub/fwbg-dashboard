import type { Chart } from "klinecharts";
import {
  SESSION_OVERLAY_NAME,
  ensureSessionOverlayRegistered,
  updateSessionEnabledIds,
  updateSessionChartTimeframe,
} from "~/composables/useChartIndicators";

export function useChartSessionOverlay(querySessionIds?: string) {
  const sessionEnabledIds = ref<string[]>(
    querySessionIds ? querySessionIds.split(",").filter(Boolean) : [],
  );

  function handleEnabledIdsChange(ids: string[], getChart: () => Chart | null) {
    sessionEnabledIds.value = ids;
    updateSessionEnabledIds(ids);
    const chart = getChart();
    if (!chart) return;
    if (ids.length > 0) {
      ensureSessionOverlayRegistered();
      chart.removeIndicator({ name: SESSION_OVERLAY_NAME });
      chart.createIndicator({ name: SESSION_OVERLAY_NAME }, { isStack: true, pane: { id: "candle_pane" } });
    } else {
      chart.removeIndicator({ name: SESSION_OVERLAY_NAME });
    }
  }

  function onTimeframeChange(tf: string, getChart: () => Chart | null) {
    updateSessionChartTimeframe(tf);
    if (sessionEnabledIds.value.length > 0) {
      ensureSessionOverlayRegistered();
      const chart = getChart();
      if (chart) {
        chart.removeIndicator({ name: SESSION_OVERLAY_NAME });
        chart.createIndicator({ name: SESSION_OVERLAY_NAME }, { isStack: true, pane: { id: "candle_pane" } });
      }
    }
  }

  /** Restore overlay onto chart (called once after initial data load). */
  function applyToChart(getChart: () => Chart | null) {
    if (sessionEnabledIds.value.length === 0) return;
    updateSessionEnabledIds(sessionEnabledIds.value);
    ensureSessionOverlayRegistered();
    const chart = getChart();
    if (chart) {
      chart.removeIndicator({ name: SESSION_OVERLAY_NAME });
      chart.createIndicator({ name: SESSION_OVERLAY_NAME }, { isStack: true, pane: { id: "candle_pane" } });
    }
  }

  return {
    sessionEnabledIds,
    handleEnabledIdsChange,
    onTimeframeChange,
    applyToChart,
  };
}
