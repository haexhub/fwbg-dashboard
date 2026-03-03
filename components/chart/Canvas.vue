<script setup lang="ts">
import { init, dispose, registerOverlay } from "klinecharts";
import type {
  Chart,
  KLineData,
  Crosshair,
  Bounding,
  Coordinate,
  DataLoaderGetBarsParams,
  DataLoaderSubscribeBarParams,
  DataLoaderUnsubscribeBarParams,
} from "klinecharts";
import type { OhlcvResponse } from "~/types/chart";
import type { ChartTick } from "~/composables/useChartStream";

export interface CrosshairData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
  change: number;
  changePercent: number;
}

const props = defineProps<{
  source: string;
  symbol: string;
  timeframe: string;
  pricePrecision: number;
  activeDrawingTool: string | null;
  chartType: "candle_solid" | "ohlc" | "area";
  loadAll?: boolean;
}>();

const emit = defineEmits<{
  "crosshair-change": [data: CrosshairData | null];
  "drawing-cancelled": [];
  "data-loaded": [count: number];
}>();

const chartContainer = ref<HTMLDivElement | null>(null);
let chart: Chart | null = null;

// Timestamp to restore after a timeframe/source change reloads data
let _restoreTimestamp: number | null = null;

// ── Live price streaming for broker sources ──
const {
  isConnected: streamConnected,
  connect: streamConnect,
  disconnect: streamDisconnect,
  resubscribe: streamResubscribe,
  onTick,
} = useChartStream();

// KLineChart's subscribeBar callback — set by the DataLoader, called with each tick
let barCallback: ((data: KLineData) => void) | null = null;

onTick((tick: ChartTick) => {
  if (!barCallback) return;
  barCallback({
    timestamp: tick.timestamp,
    open: tick.open,
    high: tick.high,
    low: tick.low,
    close: tick.close,
  });
});

// Map timeframe strings to KLineChart Period format
const PERIOD_MAP: Record<string, { type: string; span: number }> = {
  MINUTE_1: { type: "minute", span: 1 },
  MINUTE_5: { type: "minute", span: 5 },
  MINUTE_15: { type: "minute", span: 15 },
  MINUTE_30: { type: "minute", span: 30 },
  HOUR: { type: "hour", span: 1 },
  HOUR_4: { type: "hour", span: 4 },
  DAY: { type: "day", span: 1 },
};

/**
 * Custom x-axis date formatter — less noise per timeframe.
 * Hourly: only show "HH:mm", with date only when day changes.
 * Daily: only show "DD.MM", with year only when year changes.
 */
function formatDate(params: {
  timestamp: number;
  template: string;
  type: "tooltip" | "crosshair" | "xAxis";
}): string {
  const d = new Date(params.timestamp);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const weekdays = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const wd = weekdays[d.getDay()];

  // Crosshair/tooltip — always show full date+time with weekday
  if (params.type === "crosshair" || params.type === "tooltip") {
    return `${wd} ${dd}.${mo}.${yyyy} ${hh}:${mm}`;
  }

  const tf = props.timeframe;
  if (tf.startsWith("MINUTE") || tf === "HOUR" || tf === "HOUR_4") {
    // Intraday: show only time, add date at day boundaries
    if (hh === "00" && mm === "00") {
      return `${dd}.${mo}`;
    }
    return `${hh}:${mm}`;
  }
  // Daily+: show only date
  if (dd === "01") {
    return `${mo}/${yyyy}`;
  }
  return `${dd}.${mo}`;
}

const PAGE_SIZE = 5000;

interface FetchResult {
  bars: KLineData[];
  total: number;
  count: number;
}

/**
 * Fetch OHLCV data from the API with optional pagination.
 * Returns bars + total count so caller can determine if more data exists.
 */
async function fetchOhlcvData(
  symbol: string,
  timeframe: string,
  source: string,
  limit: number = PAGE_SIZE,
  before?: number,
): Promise<FetchResult> {
  let response: OhlcvResponse;

  if (source.startsWith("broker:")) {
    response = await $fetch<OhlcvResponse>("/api/chart/ohlcv", {
      method: "POST",
      body: { source, symbol, timeframe, limit, ...(before ? { before } : {}) },
    });
  } else {
    response = await $fetch<OhlcvResponse>("/api/chart/ohlcv", {
      params: { symbol, timeframe, source, limit, ...(before ? { before } : {}) },
    });
  }

  return {
    bars: response.data as KLineData[],
    total: response.total,
    count: response.count,
  };
}

/**
 * Manage streaming connection based on current source.
 * Connects for broker sources, disconnects for CSV sources.
 */
function updateStreamConnection() {
  if (props.source.startsWith("broker:")) {
    if (streamConnected.value) {
      streamResubscribe(props.source, props.symbol, props.timeframe);
    } else {
      streamConnect(props.source, props.symbol, props.timeframe);
    }
  } else {
    streamDisconnect();
  }
}

// Register custom rectangle overlay (not built-in in KLineChart)
registerOverlay({
  name: "rect",
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates }) => {
    if (coordinates.length < 2) return [];
    const [p1, p2] = coordinates;
    const x = Math.min(p1!.x, p2!.x);
    const y = Math.min(p1!.y, p2!.y);
    const w = Math.abs(p2!.x - p1!.x);
    const h = Math.abs(p2!.y - p1!.y);
    return [
      {
        type: "rect",
        attrs: { x, y, width: w, height: h },
        styles: {
          style: "stroke_fill",
          color: "rgba(59, 130, 246, 0.12)",
          borderColor: "rgba(59, 130, 246, 0.5)",
          borderSize: 1,
        },
      },
    ];
  },
});

// Register filled channel overlay (parallel lines + shaded area between them)
registerOverlay({
  name: "filledChannel",
  totalStep: 4,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, bounding }: { coordinates: Coordinate[]; bounding: Bounding }) => {
    if (coordinates.length < 2) return [];

    const [p1, p2] = coordinates;
    const figures: Array<{ type: string; attrs: unknown; styles?: unknown }> = [];

    // First line — extend to screen bounds
    if (p1!.x === p2!.x) {
      // Vertical
      figures.push({
        type: "line",
        attrs: { coordinates: [{ x: p1!.x, y: 0 }, { x: p1!.x, y: bounding.height }] },
      });
    } else {
      const k = (p1!.y - p2!.y) / (p1!.x - p2!.x);
      const b = p1!.y - k * p1!.x;
      figures.push({
        type: "line",
        attrs: { coordinates: [{ x: 0, y: b }, { x: bounding.width, y: k * bounding.width + b }] },
      });
    }

    if (coordinates.length < 3) return figures;

    const p3 = coordinates[2]!;

    if (p1!.x === p2!.x) {
      // Vertical channel
      figures.push({
        type: "line",
        attrs: { coordinates: [{ x: p3.x, y: 0 }, { x: p3.x, y: bounding.height }] },
      });
      figures.push({
        type: "polygon",
        attrs: {
          coordinates: [
            { x: p1!.x, y: 0 },
            { x: p1!.x, y: bounding.height },
            { x: p3.x, y: bounding.height },
            { x: p3.x, y: 0 },
          ],
        },
        styles: { style: "fill", color: "rgba(59, 130, 246, 0.08)" },
      });
    } else {
      const k = (p1!.y - p2!.y) / (p1!.x - p2!.x);
      const b1 = p1!.y - k * p1!.x;
      const b2 = p3.y - k * p3.x;

      // Second line
      figures.push({
        type: "line",
        attrs: { coordinates: [{ x: 0, y: b2 }, { x: bounding.width, y: k * bounding.width + b2 }] },
      });

      // Filled polygon between the two lines
      figures.push({
        type: "polygon",
        attrs: {
          coordinates: [
            { x: 0, y: b1 },
            { x: bounding.width, y: k * bounding.width + b1 },
            { x: bounding.width, y: k * bounding.width + b2 },
            { x: 0, y: b2 },
          ],
        },
        styles: { style: "fill", color: "rgba(59, 130, 246, 0.08)" },
      });
    }

    return figures;
  },
});

onMounted(() => {
  if (!chartContainer.value) return;

  chart = init(chartContainer.value, {
    formatter: {
      formatDate,
    },
    styles: {
      grid: {
        show: true,
        horizontal: { color: "rgba(255, 255, 255, 0.04)" },
        vertical: { color: "rgba(255, 255, 255, 0.04)" },
      },
      candle: {
        priceMark: {
          last: { show: true },
        },
      },
      indicator: {
        lastValueMark: { show: true },
      },
      xAxis: {
        tickText: { color: "#9CA3AF" },
      },
      yAxis: {
        tickText: { color: "#9CA3AF" },
      },
      crosshair: {
        horizontal: {
          line: { color: "#6B7280" },
          text: { backgroundColor: "#374151" },
        },
        vertical: {
          line: { color: "#6B7280" },
          text: { backgroundColor: "#374151" },
        },
      },
    },
    layout: [
      { type: "candle" },
    ],
  });

  if (!chart) return;

  // Set data loader with subscribeBar for live updates
  chart.setDataLoader({
    getBars: async (params: DataLoaderGetBarsParams) => {
      // ── Forward: user scrolled to oldest bar, load more history ──
      if (params.type === "forward") {
        try {
          const before = params.timestamp ?? chart?.getDataList()[0]?.timestamp;
          const result = await fetchOhlcvData(
            params.symbol.ticker,
            props.timeframe,
            props.source,
            PAGE_SIZE,
            before ?? undefined,
          );
          // total = all bars in backend, loaded = what chart already has + this batch
          const loaded = (chart?.getDataList().length ?? 0) + result.bars.length;
          const hasMore = loaded < result.total;
          params.callback(result.bars, { forward: hasMore });
        } catch (e) {
          console.error("Failed to load older chart data:", e);
          params.callback([], false);
        }
        return;
      }

      // ── Backward / other: no newer data to load (live streaming handles this) ──
      if (params.type !== "init") {
        params.callback([], false);
        return;
      }

      // ── Init: load most recent page (or all data if loadAll is set) ──
      try {
        const initLimit = props.loadAll ? 999_999 : PAGE_SIZE;
        const result = await fetchOhlcvData(
          params.symbol.ticker,
          props.timeframe,
          props.source,
          initLimit,
        );
        const hasMore = !props.loadAll && result.count < result.total;
        params.callback(result.bars, { forward: hasMore, backward: false });

        // Restore scroll position after timeframe/source change.
        // KLineChart auto-scrolls to the latest bar after data load.
        // We retry scrollToDataIndex until the target is actually visible.
        if (_restoreTimestamp && chart && result.bars.length > 0) {
          const ts = _restoreTimestamp;
          _restoreTimestamp = null;
          let closestIdx = 0;
          let closestDist = Math.abs(result.bars[0]!.timestamp - ts);
          for (let i = 1; i < result.bars.length; i++) {
            const dist = Math.abs(result.bars[i]!.timestamp - ts);
            if (dist < closestDist) {
              closestIdx = i;
              closestDist = dist;
            }
          }
          let attempts = 0;
          const scrollToTarget = () => {
            if (!chart || attempts >= 15) return;
            attempts++;
            chart.scrollToDataIndex(closestIdx);
            requestAnimationFrame(() => {
              const range = chart?.getVisibleRange();
              if (range && (closestIdx < range.from || closestIdx > range.to)) {
                requestAnimationFrame(scrollToTarget);
              }
            });
          };
          requestAnimationFrame(() => requestAnimationFrame(scrollToTarget));
        }

        // Start streaming after initial data is loaded
        nextTick(updateStreamConnection);
        emit("data-loaded", result.bars.length);
      } catch (e) {
        console.error("Failed to load chart data:", e);
        params.callback([], false);
      }
    },
    subscribeBar: (params: DataLoaderSubscribeBarParams) => {
      // KLineChart calls this when it wants real-time bar updates
      barCallback = params.callback;
    },
    unsubscribeBar: (_params: DataLoaderUnsubscribeBarParams) => {
      barCallback = null;
    },
  });

  // Set period first (no data load without symbol)
  const period = PERIOD_MAP[props.timeframe] ?? { type: "hour", span: 1 };
  chart.setPeriod(period as any);

  // Only trigger initial data load if source is available;
  // otherwise the combined source+symbol watch will handle it.
  if (props.source) {
    chart.setSymbol({
      ticker: props.symbol,
      pricePrecision: props.pricePrecision,
      volumePrecision: 0,
    });
  }

  // Handle resize
  const observer = new ResizeObserver(() => {
    chart?.resize();
  });
  observer.observe(chartContainer.value);
  onBeforeUnmount(() => observer.disconnect());

  // Crosshair data subscription
  const crosshairHandler = (data: unknown) => {
    const bar = (data as Crosshair).kLineData;
    if (!bar) {
      emit("crosshair-change", null);
      return;
    }
    const change = bar.close - bar.open;
    const changePercent = bar.open !== 0 ? (change / bar.open) * 100 : 0;
    emit("crosshair-change", {
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume ?? 0,
      timestamp: bar.timestamp,
      change,
      changePercent,
    });
  };
  chart.subscribeAction("onCrosshairChange", crosshairHandler);
  onBeforeUnmount(() => {
    chart?.unsubscribeAction("onCrosshairChange", crosshairHandler);
  });
});

onBeforeUnmount(() => {
  streamDisconnect();
  if (chartContainer.value) {
    dispose(chartContainer.value);
    chart = null;
  }
});

// Combined watch for source + symbol changes.
// Vue batches reactive updates, so when both change in the same tick
// (e.g. navigating from strategy page), this fires ONCE instead of
// triggering multiple overlapping data loads.
watch(
  () => [props.source, props.symbol] as const,
  ([newSource, newSymbol], [oldSource, oldSymbol]) => {
    if (!chart || !newSource) return;
    // Capture scroll position before reload
    if (newSource !== oldSource || newSymbol !== oldSymbol) {
      const dataList = chart.getDataList();
      const range = chart.getVisibleRange();
      if (dataList.length > 0 && range) {
        const centerIdx = Math.round((range.from + range.to) / 2);
        const clampedIdx = Math.max(0, Math.min(centerIdx, dataList.length - 1));
        _restoreTimestamp = dataList[clampedIdx]?.timestamp ?? null;
      }
      streamDisconnect();
    }
    chart.setSymbol({
      ticker: newSymbol,
      pricePrecision: props.pricePrecision,
      volumePrecision: 0,
    });
  }
);

// Watch timeframe changes → update chart period, preserving scroll position
watch(
  () => props.timeframe,
  (newTf) => {
    if (!chart) return;
    // Capture the center of the visible range so we can restore it after reload
    const dataList = chart.getDataList();
    const range = chart.getVisibleRange();
    if (dataList.length > 0 && range) {
      const centerIdx = Math.round((range.from + range.to) / 2);
      const clampedIdx = Math.max(0, Math.min(centerIdx, dataList.length - 1));
      _restoreTimestamp = dataList[clampedIdx]?.timestamp ?? null;
    }
    // Disconnect stream first — will reconnect after data reload
    streamDisconnect();
    const period = PERIOD_MAP[newTf] ?? { type: "hour", span: 1 };
    chart.setPeriod(period as any);
    // Re-set symbol to trigger DataLoader reload with new timeframe
    chart.setSymbol({
      ticker: props.symbol,
      pricePrecision: props.pricePrecision,
      volumePrecision: 0,
    });
  }
);

// Watch precision changes
watch(
  () => props.pricePrecision,
  (prec) => {
    if (!chart) return;
    chart.setSymbol({
      ticker: props.symbol,
      pricePrecision: prec,
      volumePrecision: 0,
    });
  }
);

// Watch chart type changes
watch(
  () => props.chartType,
  (type) => {
    if (!chart) return;
    chart.setStyles({ candle: { type } });
  }
);

// Watch drawing tool changes — keep creating new overlays while tool is active
function createDrawingOverlay(tool: string) {
  if (!chart) return;
  let completed = false;
  chart.createOverlay({
    name: tool,
    onDrawEnd: () => {
      completed = true;
      if (props.activeDrawingTool === tool) {
        createDrawingOverlay(tool);
      }
    },
    onRemoved: () => {
      // Right-click cancels an in-progress overlay — deselect the tool
      if (!completed && props.activeDrawingTool === tool) {
        emit("drawing-cancelled");
      }
    },
  });
}

watch(
  () => props.activeDrawingTool,
  (tool) => {
    if (!chart) return;
    if (tool) {
      createDrawingOverlay(tool);
    }
  }
);

// Expose chart instance + utility methods
function getChart(): Chart | null {
  return chart;
}

function screenshot(): string | null {
  if (!chart) return null;
  return chart.getConvertPictureUrl(true, "png", "#030712");
}

function zoomIn() {
  chart?.zoomAtCoordinate(1.2);
}

function zoomOut() {
  chart?.zoomAtCoordinate(0.8);
}

function resetZoom() {
  chart?.scrollToRealTime();
}

function scrollToTimestamp(timestamp: number) {
  chart?.scrollToTimestamp(timestamp, 300);
}

defineExpose({ getChart, screenshot, zoomIn, zoomOut, resetZoom, scrollToTimestamp });
</script>

<template>
  <div ref="chartContainer" class="w-full h-full bg-gray-950" />
</template>
