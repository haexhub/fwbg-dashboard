import type { Chart } from "klinecharts";
import type { ActiveIndicator, IndicatorResponse } from "~/types/chart";
import {
  SIGNAL_MARKER_NAME,
  ensureSignalMarkerRegistered,
  updateSignalMarkerData,
} from "~/composables/useChartIndicators";

/**
 * Extract signal TRANSITION timestamps + values from indicator response.
 * A transition is a point where the signal value changes from its previous value.
 */
export function extractSignalTransitions(
  response: IndicatorResponse,
  columns: string[],
): { timestamps: number[]; valueMap: Map<number, number> } {
  const timestamps: number[] = [];
  const valueMap = new Map<number, number>();
  for (let i = 0; i < response.timestamps.length; i++) {
    let transitionValue: number | null = null;
    for (const col of columns) {
      const val = response.data[col]?.[i] ?? null;
      const prevVal = i > 0 ? (response.data[col]?.[i - 1] ?? null) : null;
      if (val === null) continue;
      if (prevVal === null && val !== 0) {
        transitionValue = val;
        break;
      }
      if (prevVal !== null && val !== prevVal) {
        transitionValue = val;
        break;
      }
    }
    if (transitionValue !== null) {
      const ts = response.timestamps[i]!;
      timestamps.push(ts);
      valueMap.set(ts, transitionValue);
    }
  }
  return { timestamps, valueMap };
}

export function useChartSignalNav(
  activeIndicators: Ref<ActiveIndicator[]>,
) {
  const selectedSignalIds = ref<string[]>([]);
  const currentSignalIndex = ref(-1);

  // All signal timestamps (merged) — used for signal markers on candle chart
  const allSignalTimestamps = computed(() => {
    const tsSet = new Set<number>();
    for (const ind of activeIndicators.value) {
      if (ind.isSignal && ind.signalTimestamps) {
        for (const ts of ind.signalTimestamps) tsSet.add(ts);
      }
    }
    return [...tsSet].sort((a, b) => a - b);
  });

  // Filtered timestamps for navigation — based on selected signals
  const navSignalTimestamps = computed(() => {
    if (selectedSignalIds.value.length === 0) return allSignalTimestamps.value;
    const tsSet = new Set<number>();
    for (const id of selectedSignalIds.value) {
      const ind = activeIndicators.value.find((i) => i.id === id);
      if (ind?.signalTimestamps) {
        for (const ts of ind.signalTimestamps) tsSet.add(ts);
      }
    }
    return [...tsSet].sort((a, b) => a - b);
  });

  // Aggregated signal values for marker coloring
  const allSignalValues = computed(() => {
    const map = new Map<number, number>();
    for (const ind of activeIndicators.value) {
      if (ind.isSignal && ind.signalValueMap) {
        for (const [ts, val] of ind.signalValueMap) {
          const existing = map.get(ts);
          if (existing === undefined || Math.abs(val) > Math.abs(existing)) {
            map.set(ts, val);
          }
        }
      }
    }
    return map;
  });

  // Deduplicated key to avoid unnecessary watch triggers
  const signalTimestampsKey = computed(() =>
    allSignalTimestamps.value.join(","),
  );

  // Reset navigation index when timestamps or selection change
  watch(navSignalTimestamps, () => {
    currentSignalIndex.value = -1;
  });

  // Remove selection entries if the corresponding signal indicator is removed
  watch(activeIndicators, () => {
    const activeIds = new Set(activeIndicators.value.map((i) => i.id));
    selectedSignalIds.value = selectedSignalIds.value.filter((id) =>
      activeIds.has(id),
    );
  });

  // ── Navigation ──

  function goToSignal(index: number, scrollFn?: (ts: number) => void) {
    if (index < 0 || index >= navSignalTimestamps.value.length) return;
    currentSignalIndex.value = index;
    const ts = navSignalTimestamps.value[index]!;
    scrollFn?.(ts);
  }

  function goToNextSignal(scrollFn?: (ts: number) => void) {
    goToSignal(currentSignalIndex.value + 1, scrollFn);
  }

  function goToPrevSignal(scrollFn?: (ts: number) => void) {
    goToSignal(currentSignalIndex.value - 1, scrollFn);
  }

  // ── Signal Markers on candle chart ──

  const signalMarkerActive = ref(false);

  function updateMarkers(getChart: () => Chart | null) {
    const chart = getChart();
    if (!chart) return;

    updateSignalMarkerData(allSignalTimestamps.value, allSignalValues.value);

    if (allSignalTimestamps.value.length > 0) {
      if (!signalMarkerActive.value) {
        ensureSignalMarkerRegistered();
        signalMarkerActive.value = true;
      }
      chart.removeIndicator({ name: SIGNAL_MARKER_NAME });
      chart.createIndicator(
        { name: SIGNAL_MARKER_NAME },
        true,
        { id: "candle_pane" },
      );
    } else if (signalMarkerActive.value) {
      chart.removeIndicator({ name: SIGNAL_MARKER_NAME });
      signalMarkerActive.value = false;
    }
  }

  return {
    selectedSignalIds,
    currentSignalIndex,
    allSignalTimestamps,
    navSignalTimestamps,
    allSignalValues,
    signalTimestampsKey,
    goToSignal,
    goToNextSignal,
    goToPrevSignal,
    updateMarkers,
  };
}
