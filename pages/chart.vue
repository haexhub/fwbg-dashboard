<script setup lang="ts">
import { useFullscreen } from "@vueuse/core";
import type { PluginInfo } from "~/types/strategy";
import type { ActiveIndicator, IndicatorResponse } from "~/types/chart";
import type { CrosshairData } from "~/components/chart/Canvas.vue";
import {
  registerFwbgIndicator,
  registerFwbgSignalIndicator,
  ensureSignalMarkerRegistered,
  updateSignalMarkerData,
  SIGNAL_MARKER_NAME,
  LINE_COLORS,
} from "~/composables/useChartIndicators";

definePageMeta({ layout: "builder" });

const INDICATOR_LIMIT = 10000;

const {
  source,
  symbol,
  timeframe,
  chartType,
  sources,
  currentSymbol,
  availableSymbols,
  availableTimeframes,
  activeIndicators,
  activeDrawingTool,
  setSource,
  setSymbol,
  setTimeframe,
  setChartType,
  addIndicator,
  removeIndicator,
  setDrawingTool,
} = useChart();

const { plugins } = usePlugins();

const indicatorPlugins = computed(
  () => plugins.value?.filter((p) => p.phase === "indicators") ?? []
);

const indicatorPanelOpen = ref(false);

const chartCanvas = ref<{
  getChart: () => import("klinecharts").Chart | null;
  screenshot: () => string | null;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  scrollToTimestamp: (timestamp: number) => void;
} | null>(null);

const crosshairData = ref<CrosshairData | null>(null);
const chartWrapperRef = ref<HTMLElement | null>(null);

const pricePrecision = computed(() =>
  currentSymbol.value?.point
    ? Math.max(0, -Math.floor(Math.log10(currentSymbol.value.point)))
    : 5
);

const chartContainer = ref<HTMLElement | null>(null);
const { isFullscreen, toggle: toggleFullscreen } = useFullscreen(chartContainer);

// ── Collapsible Panes ──
// Uses removeIndicator/createIndicator to fully hide/show panes.
// The indicator registration (registerIndicator) persists globally,
// so re-creating works without re-fetching data.
const collapsedPanes = ref<Record<string, boolean>>({});

function togglePaneCollapse(id: string) {
  const indicator = activeIndicators.value.find((i) => i.id === id);
  if (!indicator) return;
  const chart = chartCanvas.value?.getChart();
  if (!chart) return;

  if (collapsedPanes.value[id]) {
    // Expand: re-create indicator on chart
    delete collapsedPanes.value[id];
    const height = indicator.isSignal ? 80 : 120;
    const newPaneId =
      chart.createIndicator({ name: id }, false, { height }) ?? "";
    indicator.paneId = newPaneId;
    adjustLayout();
  } else {
    // Collapse: remove indicator from chart (pane disappears)
    collapsedPanes.value[id] = true;
    chart.removeIndicator({ name: id });
    adjustLayout();
  }
}

function collapseAllPanes() {
  const chart = chartCanvas.value?.getChart();
  if (!chart) return;
  for (const ind of activeIndicators.value) {
    if (ind.paneId && !collapsedPanes.value[ind.id]) {
      chart.removeIndicator({ name: ind.id });
      collapsedPanes.value[ind.id] = true;
    }
  }
}

function expandAllPanes() {
  const chart = chartCanvas.value?.getChart();
  if (!chart) return;
  for (const ind of activeIndicators.value) {
    if (collapsedPanes.value[ind.id]) {
      const height = ind.isSignal ? 80 : 120;
      const newPaneId =
        chart.createIndicator({ name: ind.id }, false, { height }) ?? "";
      ind.paneId = newPaneId;
    }
  }
  collapsedPanes.value = {};
  adjustLayout();
}

// ── Layout: candle pane gets 50%, oscillators share the rest ──
function adjustLayout() {
  const chart = chartCanvas.value?.getChart();
  const wrapper = chartWrapperRef.value;
  if (!chart || !wrapper) return;

  const totalHeight = wrapper.clientHeight;
  if (totalHeight <= 0) return;

  const visibleIndicators = activeIndicators.value.filter(
    (i) => i.paneId && !collapsedPanes.value[i.id]
  );
  if (visibleIndicators.length === 0) return;

  const candleHeight = Math.floor(totalHeight * 0.5);
  chart.setPaneOptions({ id: "candle_pane", height: candleHeight });

  const oscillatorHeight = Math.floor(
    (totalHeight - candleHeight) / visibleIndicators.length
  );
  for (const ind of visibleIndicators) {
    chart.setPaneOptions({
      id: ind.paneId,
      height: Math.max(30, oscillatorHeight),
    });
  }
}

// Adjust layout on resize
onMounted(() => {
  const observer = new ResizeObserver(() => {
    nextTick(adjustLayout);
  });
  watch(
    chartWrapperRef,
    (el) => {
      if (el) observer.observe(el);
    },
    { immediate: true }
  );
  onBeforeUnmount(() => observer.disconnect());
});

// ── Signal Navigation ──
const selectedSignalIds = ref<string[]>([]);

// All signal timestamps (merged) — used for signal markers on candle chart
const allSignalTimestamps = computed(() => {
  const tsSet = new Set<number>();
  for (const ind of activeIndicators.value) {
    if (ind.isSignal && ind.signalTimestamps) {
      for (const ts of ind.signalTimestamps) {
        tsSet.add(ts);
      }
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
        // If multiple signals at same timestamp, keep the one with larger magnitude
        const existing = map.get(ts);
        if (existing === undefined || Math.abs(val) > Math.abs(existing)) {
          map.set(ts, val);
        }
      }
    }
  }
  return map;
});

const currentSignalIndex = ref(-1);

// Reset navigation index when timestamps or selection change
watch(navSignalTimestamps, () => {
  currentSignalIndex.value = -1;
});

// Remove selection entries if the corresponding signal indicator is removed
watch(activeIndicators, () => {
  const activeIds = new Set(activeIndicators.value.map((i) => i.id));
  selectedSignalIds.value = selectedSignalIds.value.filter((id) =>
    activeIds.has(id)
  );
});

function goToSignal(index: number) {
  if (index < 0 || index >= navSignalTimestamps.value.length) return;
  currentSignalIndex.value = index;
  const ts = navSignalTimestamps.value[index]!;
  chartCanvas.value?.scrollToTimestamp(ts);
}

function goToNextSignal() {
  goToSignal(currentSignalIndex.value + 1);
}

function goToPrevSignal() {
  goToSignal(currentSignalIndex.value - 1);
}

// ── Extract signal TRANSITION timestamps + values ──
function extractSignalTransitions(
  response: IndicatorResponse,
  columns: string[]
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

// ── Signal Markers on candle chart ──
const signalMarkerActive = ref(false);

// Deduplicated key to avoid unnecessary watch triggers
const signalTimestampsKey = computed(() =>
  allSignalTimestamps.value.join(",")
);

function updateSignalMarkers() {
  const chart = chartCanvas.value?.getChart();
  if (!chart) return;

  // Update the mutable data the registered indicator reads
  updateSignalMarkerData(allSignalTimestamps.value, allSignalValues.value);

  if (allSignalTimestamps.value.length > 0) {
    if (!signalMarkerActive.value) {
      ensureSignalMarkerRegistered();
      signalMarkerActive.value = true;
    }
    // Remove + recreate on candle_pane to force redraw with new data
    chart.removeIndicator({ name: SIGNAL_MARKER_NAME });
    chart.createIndicator(
      { name: SIGNAL_MARKER_NAME },
      false,
      { id: "candle_pane" }
    );
  } else if (signalMarkerActive.value) {
    chart.removeIndicator({ name: SIGNAL_MARKER_NAME });
    signalMarkerActive.value = false;
  }
}

watch(signalTimestampsKey, () => nextTick(updateSignalMarkers));

// Screenshot
function handleScreenshot() {
  const url = chartCanvas.value?.screenshot();
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = `${symbol.value}_${timeframe.value}_${Date.now()}.png`;
  a.click();
}

async function handleAddIndicator(
  plugin: PluginInfo,
  params: Record<string, unknown>,
  selectedColumns: string[],
  colors: Record<string, string>,
  isMainOverlay: boolean = false
) {
  try {
    const response = await $fetch<IndicatorResponse>(
      "/api/chart/indicator",
      {
        method: "POST",
        body: {
          symbol: symbol.value,
          timeframe: timeframe.value,
          source: source.value,
          fqn: plugin.fqn,
          params,
          limit: INDICATOR_LIMIT,
        },
      }
    );

    const instanceId = `fwbg_${plugin.name}_${Date.now()}`;
    registerFwbgIndicator(instanceId, response, selectedColumns, colors);

    const chart = chartCanvas.value?.getChart();
    let paneId = "";
    if (chart) {
      if (isMainOverlay) {
        paneId = chart.createIndicator({ name: instanceId }, true) ?? "";
      } else {
        paneId =
          chart.createIndicator({ name: instanceId }, false, {
            height: 150,
          }) ?? "";
      }
    }

    addIndicator({
      id: instanceId,
      fqn: plugin.fqn,
      name: plugin.name,
      params,
      columns: selectedColumns,
      paneId,
    });
    nextTick(adjustLayout);
  } catch (e) {
    console.error("Failed to add indicator:", e);
  }
}

async function handleAddSignalIndicator(
  plugin: PluginInfo,
  params: Record<string, unknown>,
  selectedColumns: string[],
  colors: Record<string, string>
) {
  try {
    const response = await $fetch<IndicatorResponse>(
      "/api/chart/indicator",
      {
        method: "POST",
        body: {
          symbol: symbol.value,
          timeframe: timeframe.value,
          source: source.value,
          fqn: plugin.fqn,
          params,
          limit: INDICATOR_LIMIT,
        },
      }
    );

    const instanceId = `fwbg_sig_${plugin.name}_${Date.now()}`;
    registerFwbgSignalIndicator(instanceId, response, selectedColumns, colors);

    const chart = chartCanvas.value?.getChart();
    let paneId = "";
    if (chart) {
      paneId =
        chart.createIndicator({ name: instanceId }, false, {
          height: 80,
        }) ?? "";
    }

    const transitions = extractSignalTransitions(response, selectedColumns);
    addIndicator({
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
    nextTick(adjustLayout);
  } catch (e) {
    console.error("Failed to add signal indicator:", e);
  }
}

async function handleAddAllDeps(triggerPlugin: PluginInfo) {
  const deps = indicatorPlugins.value.filter(
    (p) => p.fqn !== triggerPlugin.fqn
  );
  for (const plugin of deps) {
    if (activeIndicators.value.some((a) => a.fqn === plugin.fqn)) continue;
    try {
      const response = await $fetch<IndicatorResponse>(
        "/api/chart/indicator",
        {
          method: "POST",
          body: {
            symbol: symbol.value,
            timeframe: timeframe.value,
            source: source.value,
            fqn: plugin.fqn,
            params: plugin.defaults,
            limit: INDICATOR_LIMIT,
          },
        }
      );
      const plotCols = response.plot_columns ?? [];
      const sigCols = response.signal_columns ?? [];
      if (plotCols.length === 0 && sigCols.length === 0) continue;

      if (plotCols.length > 0) {
        const instanceId = `fwbg_${plugin.name}_${Date.now()}`;
        const colors: Record<string, string> = {};
        plotCols.forEach((col, i) => {
          colors[col] = LINE_COLORS[i % LINE_COLORS.length]!;
        });
        registerFwbgIndicator(instanceId, response, plotCols, colors);
        const chart = chartCanvas.value?.getChart();
        const paneId =
          chart?.createIndicator({ name: instanceId }, false, {
            height: 120,
          }) ?? "";
        addIndicator({
          id: instanceId,
          fqn: plugin.fqn,
          name: plugin.name,
          params: plugin.defaults,
          columns: plotCols,
          paneId,
        });
      }

      if (sigCols.length > 0) {
        const sigId = `fwbg_sig_${plugin.name}_${Date.now()}`;
        const sigColors: Record<string, string> = {};
        const SIG_PALETTE = [
          "#4CAF50",
          "#E91E63",
          "#2196F3",
          "#FF9800",
          "#00BCD4",
          "#9C27B0",
        ];
        sigCols.forEach((col, i) => {
          sigColors[col] = SIG_PALETTE[i % SIG_PALETTE.length]!;
        });
        registerFwbgSignalIndicator(sigId, response, sigCols, sigColors);
        const chart = chartCanvas.value?.getChart();
        const paneId =
          chart?.createIndicator({ name: sigId }, false, { height: 80 }) ?? "";
        const sigTransitions = extractSignalTransitions(response, sigCols);
        addIndicator({
          id: sigId,
          fqn: plugin.fqn,
          name: `${plugin.name} (signal)`,
          params: plugin.defaults,
          columns: sigCols,
          paneId,
          isSignal: true,
          signalTimestamps: sigTransitions.timestamps,
          signalValueMap: sigTransitions.valueMap,
        });
      }
    } catch (e) {
      console.warn(`Skipping ${plugin.fqn}:`, e);
    }
  }
  nextTick(adjustLayout);
}

function handleRemoveIndicator(id: string) {
  const chart = chartCanvas.value?.getChart();
  if (chart && !collapsedPanes.value[id]) {
    chart.removeIndicator({ name: id });
  }
  delete collapsedPanes.value[id];
  removeIndicator(id);
  nextTick(adjustLayout);
}
</script>

<template>
  <ClientOnly>
    <div ref="chartContainer" class="flex flex-col h-full">
      <!-- Chart Toolbar -->
      <ChartToolbar
        :source="source"
        :symbol="symbol"
        :timeframe="timeframe"
        :chart-type="chartType"
        :sources="sources ?? []"
        :available-symbols="availableSymbols"
        :available-timeframes="availableTimeframes"
        :active-indicators="activeIndicators"
        :active-drawing-tool="activeDrawingTool"
        :is-fullscreen="isFullscreen"
        @update:source="setSource"
        @update:symbol="setSymbol"
        @update:timeframe="setTimeframe"
        @update:chart-type="setChartType"
        @update:drawing-tool="setDrawingTool"
        @open-indicators="indicatorPanelOpen = true"
        @screenshot="handleScreenshot"
        @toggle-fullscreen="toggleFullscreen"
        @zoom-in="chartCanvas?.zoomIn()"
        @zoom-out="chartCanvas?.zoomOut()"
        @zoom-reset="chartCanvas?.resetZoom()"
      />

      <!-- Active Indicators Strip -->
      <ChartIndicatorStrip
        :indicators="activeIndicators"
        :collapsed-ids="collapsedPanes"
        :signal-timestamps="navSignalTimestamps"
        :current-signal-index="currentSignalIndex"
        :selected-signal-ids="selectedSignalIds"
        @toggle-collapse="togglePaneCollapse"
        @collapse-all="collapseAllPanes"
        @expand-all="expandAllPanes"
        @remove="handleRemoveIndicator"
        @signal-prev="goToPrevSignal"
        @signal-next="goToNextSignal"
        @signal-goto="goToSignal"
        @update:selected-signals="selectedSignalIds = $event"
      />

      <!-- Crosshair Data Legend -->
      <ChartDataLegend :data="crosshairData" :price-precision="pricePrecision" />

      <!-- Chart Canvas -->
      <div ref="chartWrapperRef" class="flex-1 min-h-0">
        <ChartCanvas
          ref="chartCanvas"
          :source="source"
          :symbol="symbol"
          :timeframe="timeframe"
          :chart-type="chartType"
          :price-precision="pricePrecision"
          :active-drawing-tool="activeDrawingTool"
          @crosshair-change="crosshairData = $event"
          @drawing-cancelled="setDrawingTool(null)"
        />
      </div>

      <!-- Indicator Panel -->
      <ChartIndicatorPanel
        :open="indicatorPanelOpen"
        :plugins="indicatorPlugins"
        :source="source"
        :symbol="symbol"
        :timeframe="timeframe"
        @update:open="indicatorPanelOpen = $event"
        @add="handleAddIndicator"
        @add-signal="handleAddSignalIndicator"
        @add-all-deps="handleAddAllDeps"
      />
    </div>

    <template #fallback>
      <div class="h-full flex items-center justify-center text-gray-400">
        Loading chart...
      </div>
    </template>
  </ClientOnly>
</template>
