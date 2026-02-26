<script setup lang="ts">
import { useFullscreen } from "@vueuse/core";
import type { PluginInfo } from "~/types/strategy";
import type { CrosshairData } from "~/components/chart/Canvas.vue";

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
  () => plugins.value?.filter((p) => p.phase === "indicators") ?? [],
);

const {
  querySource,
  querySymbol,
  queryTimeframe,
  queryChartType,
  queryRangeInterval,
  queryRangeStartTime,
  queryRangeEndTime,
  queryRangeWeekdays,
  queryRangeUseOpenClose,
  querySessionIds,
  queryRunId,
  queryIndicators,
  syncToUrl,
} = useChartQuery();

// Apply timeframe and chart type early (before overlay watchers run)
if (queryTimeframe.value) setTimeframe(queryTimeframe.value);
if (
  queryChartType.value &&
  ["candle_solid", "ohlc", "area"].includes(queryChartType.value)
) {
  setChartType(queryChartType.value as "candle_solid" | "ohlc" | "area");
}

// ── Chart Canvas & UI State ──

interface ChartCanvasExposed {
  getChart: () => any;
  screenshot: () => string | null;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  scrollToTimestamp: (ts: number) => void;
}

const chartCanvas = useTemplateRef<ChartCanvasExposed>("chartCanvas");

const getChart = () => chartCanvas.value?.getChart() ?? null;
const scrollTo = (ts: number) => chartCanvas.value?.scrollToTimestamp(ts);

const crosshairData = ref<CrosshairData | null>(null);
const chartWrapperRef = useTemplateRef<HTMLElement>("chartWrapperRef");
const indicatorPanelOpen = ref(false);

const pricePrecision = computed(() =>
  currentSymbol.value?.point
    ? Math.max(0, -Math.floor(Math.log10(currentSymbol.value.point)))
    : 5,
);

const chartContainer = useTemplateRef<HTMLElement>("chartContainer");
const { isFullscreen, toggle: toggleFullscreen } =
  useFullscreen(chartContainer);

// ── Composables ──

const range = useChartRangeOverlay({
  interval: queryRangeInterval.value ?? undefined,
  startTime: queryRangeStartTime.value ?? undefined,
  endTime: queryRangeEndTime.value ?? undefined,
  weekdays: queryRangeWeekdays.value ?? undefined,
  useOpenClose: queryRangeUseOpenClose.value ?? undefined,
});
const {
  rangeInterval,
  rangeStartTime,
  rangeEndTime,
  rangeWeekdays,
  rangeUseOpenClose,
} = range;

const session = useChartSessionOverlay(querySessionIds.value ?? undefined);
const { sessionEnabledIds } = session;

const signalNav = useChartSignalNav(activeIndicators);
const {
  selectedSignalIds,
  currentSignalIndex,
  navSignalTimestamps,
  signalTimestampsKey,
} = signalNav;

const tradeOverlay = useChartTradeOverlay();
const { tradeOverlayActive, tradeOverlayCount, runIndicatorsLoaded } =
  tradeOverlay;

const indActions = useChartIndicatorActions();

// ── Overlay timeframe sync ──

range.onTimeframeChange(timeframe.value, getChart);
session.onTimeframeChange(timeframe.value, getChart);
watch(timeframe, (tf) => {
  range.onTimeframeChange(tf, getChart);
  session.onTimeframeChange(tf, getChart);
});

// ── Signal markers (re-draw when signal timestamps change) ──
watch(signalTimestampsKey, () =>
  nextTick(() => signalNav.updateMarkers(getChart)),
);

// ── Collapsible Panes ──

const collapsedPanes = ref<Record<string, boolean>>({});

function togglePaneCollapse(id: string) {
  const indicator = activeIndicators.value.find((i) => i.id === id);
  if (!indicator) return;
  const chart = getChart();
  if (!chart) return;

  if (collapsedPanes.value[id]) {
    delete collapsedPanes.value[id];
    const height = indicator.isSignal ? 80 : 120;
    indicator.paneId =
      chart.createIndicator({ name: id }, false, { height }) ?? "";
    adjustLayout();
  } else {
    collapsedPanes.value[id] = true;
    chart.removeIndicator({ name: id });
    adjustLayout();
  }
}

function collapseAllPanes() {
  const chart = getChart();
  if (!chart) return;
  for (const ind of activeIndicators.value) {
    if (ind.paneId && !collapsedPanes.value[ind.id]) {
      chart.removeIndicator({ name: ind.id });
      collapsedPanes.value[ind.id] = true;
    }
  }
}

function expandAllPanes() {
  const chart = getChart();
  if (!chart) return;
  for (const ind of activeIndicators.value) {
    if (collapsedPanes.value[ind.id]) {
      const height = ind.isSignal ? 80 : 120;
      ind.paneId =
        chart.createIndicator({ name: ind.id }, false, { height }) ?? "";
    }
  }
  collapsedPanes.value = {};
  adjustLayout();
}

// ── Layout: candle pane gets 50%, oscillators share the rest ──

function adjustLayout() {
  const chart = getChart();
  const wrapper = chartWrapperRef.value;
  if (!chart || !wrapper) return;

  const totalHeight = wrapper.clientHeight;
  if (totalHeight <= 0) return;

  const visibleIndicators = activeIndicators.value.filter(
    (i) => i.paneId && !collapsedPanes.value[i.id],
  );
  if (visibleIndicators.length === 0) return;

  const candleHeight = Math.floor(totalHeight * 0.5);
  chart.setPaneOptions({ id: "candle_pane", height: candleHeight });

  const oscillatorHeight = Math.floor(
    (totalHeight - candleHeight) / visibleIndicators.length,
  );
  for (const ind of visibleIndicators) {
    chart.setPaneOptions({
      id: ind.paneId,
      height: Math.max(30, oscillatorHeight),
    });
  }
}

let resizeObserver: ResizeObserver | undefined;
onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    nextTick(adjustLayout);
  });
  if (chartWrapperRef.value) resizeObserver.observe(chartWrapperRef.value);
});
watch(chartWrapperRef, (el: HTMLElement | null) => {
  if (el) resizeObserver?.observe(el);
});
onBeforeUnmount(() => resizeObserver?.disconnect());

// ── Contexts for composable methods ──

const indicatorCtx = {
  symbol,
  timeframe,
  source,
  indicatorPlugins,
  activeIndicators,
  collapsedPanes,
  addIndicator,
  removeIndicator,
  getChart,
  adjustLayout,
  limit: INDICATOR_LIMIT,
};

const tradeCtx = {
  symbol,
  timeframe,
  source,
  indicatorPlugins,
  activeIndicators,
  addIndicator,
  getChart,
  adjustLayout,
  scrollToTimestamp: scrollTo,
  limit: INDICATOR_LIMIT,
};

// ── Template event wrappers ──

function handleRangeIntervalChange(v: string) {
  range.handleIntervalChange(v, getChart);
}
function handleRangeTimeChange() {
  range.handleTimeChange(getChart);
}
function handleRangeWeekdaysChange(days: number[]) {
  range.handleWeekdaysChange(days, getChart);
}
function handleRangeUseOpenCloseChange(v: boolean) {
  range.handleUseOpenCloseChange(v, getChart);
}
function handleSessionEnabledIdsChange(ids: string[]) {
  session.handleEnabledIdsChange(ids, getChart);
}

function goToSignal(index: number) {
  signalNav.goToSignal(index, scrollTo);
}
function goToNextSignal() {
  signalNav.goToNextSignal(scrollTo);
}
function goToPrevSignal() {
  signalNav.goToPrevSignal(scrollTo);
}

function handleAddIndicator(
  p: PluginInfo,
  params: Record<string, unknown>,
  cols: string[],
  colors: Record<string, string>,
  isMainOverlay: boolean = false,
) {
  indActions.handleAddIndicator(
    p,
    params,
    cols,
    colors,
    isMainOverlay,
    indicatorCtx,
  );
}
function handleAddSignalIndicator(
  p: PluginInfo,
  params: Record<string, unknown>,
  cols: string[],
  colors: Record<string, string>,
) {
  indActions.handleAddSignalIndicator(p, params, cols, colors, indicatorCtx);
}
function handleAddAllDeps(p: PluginInfo) {
  indActions.handleAddAllDeps(p, indicatorCtx);
}
function handleRemoveIndicator(id: string) {
  indActions.handleRemoveIndicator(id, indicatorCtx);
}
function clearRunTradeOverlay() {
  tradeOverlay.clearOverlay(getChart);
}

// ── Apply source/symbol from URL after sources load ──

watch(
  sources,
  async (list) => {
    if (!list?.length) return;
    await nextTick();

    if (querySource.value) {
      const sourceExists = list.find((src) => src.name === querySource.value);
      if (sourceExists) setSource(querySource.value);
    }

    if (querySymbol.value) {
      await nextTick();
      const inCurrentSource = availableSymbols.value.some(
        (s) => s.symbol === querySymbol.value,
      );
      if (!inCurrentSource) {
        const matchingSrc = list.find((src) =>
          src.symbols?.some(
            (s: { symbol: string }) => s.symbol === querySymbol.value,
          ),
        );
        if (matchingSrc) setSource(matchingSrc.name);
      }
      setSymbol(querySymbol.value);
    }
  },
  { immediate: true },
);

// ── Data Loaded: orchestrate initial overlays + restore ──

let _overlayLoaded = false;
let _stateRestored = false;
let _indicatorsRestored = false;

function handleDataLoaded(count: number) {
  if (count === 0) return;

  if (!_stateRestored) {
    _stateRestored = true;
    range.applyToChart(getChart);
    session.applyToChart(getChart);
    if (
      queryIndicators.value &&
      !_indicatorsRestored &&
      indicatorPlugins.value.length > 0
    ) {
      _indicatorsRestored = true;
      void indActions.restoreFromUrl(queryIndicators.value, indicatorCtx);
    }
  }

  if (_overlayLoaded) return;
  if (!queryRunId.value || !querySymbol.value) return;
  _overlayLoaded = true;
  tradeOverlay.loadTradeOverlay(queryRunId.value, querySymbol.value, tradeCtx);
}

// Reactively load run indicators / restore indicators once plugins become available
watch(indicatorPlugins, (list) => {
  if (
    list.length > 0 &&
    queryRunId.value &&
    !runIndicatorsLoaded.value &&
    _overlayLoaded
  ) {
    tradeOverlay.loadRunIndicators(queryRunId.value, tradeCtx);
  }
  if (
    list.length > 0 &&
    queryIndicators.value &&
    !_indicatorsRestored &&
    _stateRestored
  ) {
    _indicatorsRestored = true;
    void indActions.restoreFromUrl(queryIndicators.value, indicatorCtx);
  }
});

// Reset trade-overlay flags when the run id changes
watch(queryRunId, () => {
  _overlayLoaded = false;
  tradeOverlay.resetFlags();
});

// Screenshot
function handleScreenshot() {
  const url = chartCanvas.value?.screenshot();
  if (!url) return;
  const a = document.createElement("a");
  a.href = url;
  a.download = `${symbol.value}_${timeframe.value}_${Date.now()}.png`;
  a.click();
}

// ── Sync chart state to URL ──
watch(
  [
    source,
    symbol,
    timeframe,
    chartType,
    rangeInterval,
    rangeStartTime,
    rangeEndTime,
    rangeWeekdays,
    rangeUseOpenClose,
    sessionEnabledIds,
    activeIndicators,
  ],
  () =>
    syncToUrl({
      source: source.value,
      symbol: symbol.value,
      timeframe: timeframe.value,
      chartType: chartType.value,
      rangeInterval: rangeInterval.value,
      rangeStartTime: rangeStartTime.value,
      rangeEndTime: rangeEndTime.value,
      rangeWeekdays: rangeWeekdays.value,
      rangeUseOpenClose: rangeUseOpenClose.value,
      sessionIds: sessionEnabledIds.value,
      indicators: activeIndicators.value.map((i) => ({
        fqn: i.fqn,
        params: i.params,
        columns: i.columns,
        isSignal: i.isSignal || false,
      })),
    }),
  { deep: true },
);
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
        :range-interval="rangeInterval"
        :range-start-time="rangeStartTime"
        :range-end-time="rangeEndTime"
        :range-weekdays="rangeWeekdays"
        :range-use-open-close="rangeUseOpenClose"
        :session-enabled-ids="sessionEnabledIds"
        :is-fullscreen="isFullscreen"
        @update:source="setSource"
        @update:symbol="setSymbol"
        @update:timeframe="setTimeframe"
        @update:chart-type="setChartType"
        @update:drawing-tool="setDrawingTool"
        @update:range-interval="handleRangeIntervalChange"
        @update:range-start-time="
          (v: string) => {
            rangeStartTime = v;
            handleRangeTimeChange();
          }
        "
        @update:range-end-time="
          (v: string) => {
            rangeEndTime = v;
            handleRangeTimeChange();
          }
        "
        @update:range-weekdays="handleRangeWeekdaysChange"
        @update:range-use-open-close="handleRangeUseOpenCloseChange"
        @update:session-enabled-ids="handleSessionEnabledIdsChange"
        @open-indicators="indicatorPanelOpen = true"
        @screenshot="handleScreenshot"
        @toggle-fullscreen="toggleFullscreen"
        @zoom-in="chartCanvas?.zoomIn()"
        @zoom-out="chartCanvas?.zoomOut()"
        @zoom-reset="chartCanvas?.resetZoom()"
      />

      <!-- Run Trade Overlay Bar -->
      <div
        v-if="tradeOverlayActive || (queryRunId && querySymbol)"
        class="flex items-center gap-3 px-3 py-1 bg-indigo-950/60 border-b border-indigo-800/40 text-xs text-indigo-300"
      >
        <span class="i-heroicons-chart-bar-square text-indigo-400 shrink-0" />
        <span>
          Run
          <span class="font-mono font-semibold text-white">{{
            queryRunId
          }}</span>
          — <span class="font-mono text-indigo-200">{{ querySymbol }}</span>
          <template v-if="tradeOverlayCount > 0">
            · <span class="text-white">{{ tradeOverlayCount }} Trades</span>
          </template>
        </span>
        <div class="flex items-center gap-2 ml-auto">
          <div class="flex items-center gap-1 text-xs text-gray-400">
            <span
              class="inline-block w-3 h-3 rounded-full bg-teal-500 shrink-0"
            />
            LONG entry
            <span
              class="inline-block w-3 h-3 rounded-full bg-orange-500 shrink-0 ml-2"
            />
            SHORT entry
            <span
              class="inline-block w-3 h-3 rounded-full bg-green-500 shrink-0 ml-2"
            />
            Win exit
            <span
              class="inline-block w-3 h-3 rounded-full bg-red-500 shrink-0 ml-2"
            />
            Loss exit
          </div>
          <UButton
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            @click="clearRunTradeOverlay"
          />
        </div>
      </div>

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
      <ChartDataLegend
        :data="crosshairData"
        :price-precision="pricePrecision"
      />

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
          :load-all="!!queryRunId"
          @crosshair-change="crosshairData = $event"
          @drawing-cancelled="setDrawingTool(null)"
          @data-loaded="handleDataLoaded"
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
