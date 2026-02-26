import type { Chart } from "klinecharts";
import {
  RANGE_RECT_NAME,
  ensureRangeRectRegistered,
  updateRangeMode,
  updateRangeTimeFilter,
  updateRangeWeekdays,
  updateRangeChartTimeframe,
  updateRangeUseOpenClose,
} from "~/composables/useChartIndicators";

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function forceRedraw(chart: Chart | null | undefined) {
  if (!chart) return;
  ensureRangeRectRegistered();
  chart.removeIndicator({ name: RANGE_RECT_NAME });
  chart.createIndicator({ name: RANGE_RECT_NAME }, true, { id: "candle_pane" });
}

export function useChartRangeOverlay(queryDefaults?: {
  interval?: string;
  startTime?: string;
  endTime?: string;
  weekdays?: string;
  useOpenClose?: string;
}) {
  const rangeInterval = ref(queryDefaults?.interval ?? "");
  const rangeStartTime = ref(queryDefaults?.startTime ?? "00:00");
  const rangeEndTime = ref(queryDefaults?.endTime ?? "00:00");
  const rangeWeekdays = ref<number[]>(
    queryDefaults?.weekdays
      ? queryDefaults.weekdays.split(",").map(Number).filter((n) => !isNaN(n))
      : [1, 2, 3, 4, 5],
  );
  const rangeUseOpenClose = ref(queryDefaults?.useOpenClose === "1");

  function handleIntervalChange(value: string, getChart: () => Chart | null) {
    rangeInterval.value = value;
    updateRangeMode(value);
    const chart = getChart();
    if (!chart) return;
    if (value) {
      ensureRangeRectRegistered();
      chart.removeIndicator({ name: RANGE_RECT_NAME });
      chart.createIndicator({ name: RANGE_RECT_NAME }, true, { id: "candle_pane" });
    } else {
      chart.removeIndicator({ name: RANGE_RECT_NAME });
    }
  }

  function handleTimeChange(getChart: () => Chart | null) {
    updateRangeTimeFilter(
      parseTimeToMinutes(rangeStartTime.value),
      parseTimeToMinutes(rangeEndTime.value),
    );
    forceRedraw(getChart());
  }

  function handleWeekdaysChange(days: number[], getChart: () => Chart | null) {
    rangeWeekdays.value = days;
    updateRangeWeekdays(days);
    forceRedraw(getChart());
  }

  function handleUseOpenCloseChange(value: boolean, getChart: () => Chart | null) {
    rangeUseOpenClose.value = value;
    updateRangeUseOpenClose(value);
    forceRedraw(getChart());
  }

  function onTimeframeChange(tf: string, getChart: () => Chart | null) {
    updateRangeChartTimeframe(tf);
    forceRedraw(getChart());
  }

  /** Restore overlay onto chart (called once after initial data load). */
  function applyToChart(getChart: () => Chart | null) {
    if (!rangeInterval.value) return;
    updateRangeMode(rangeInterval.value);
    updateRangeTimeFilter(
      parseTimeToMinutes(rangeStartTime.value),
      parseTimeToMinutes(rangeEndTime.value),
    );
    updateRangeWeekdays(rangeWeekdays.value);
    updateRangeUseOpenClose(rangeUseOpenClose.value);
    ensureRangeRectRegistered();
    const chart = getChart();
    if (chart) {
      chart.removeIndicator({ name: RANGE_RECT_NAME });
      chart.createIndicator({ name: RANGE_RECT_NAME }, true, { id: "candle_pane" });
    }
  }

  return {
    rangeInterval,
    rangeStartTime,
    rangeEndTime,
    rangeWeekdays,
    rangeUseOpenClose,
    handleIntervalChange,
    handleTimeChange,
    handleWeekdaysChange,
    handleUseOpenCloseChange,
    onTimeframeChange,
    applyToChart,
  };
}
