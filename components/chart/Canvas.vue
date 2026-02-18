<script setup lang="ts">
import { init, dispose } from "klinecharts";
import type {
  Chart,
  KLineData,
  DataLoaderGetBarsParams,
} from "klinecharts";
import type { OhlcvResponse } from "~/types/chart";

const props = defineProps<{
  source: string;
  symbol: string;
  timeframe: string;
  pricePrecision: number;
  activeDrawingTool: string | null;
}>();

const chartContainer = ref<HTMLDivElement | null>(null);
let chart: Chart | null = null;

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
 * Fetch OHLCV data from the API.
 * For broker sources, uses POST (credentials injected server-side).
 * For CSV sources, uses GET.
 */
async function fetchOhlcvData(
  symbol: string,
  timeframe: string,
  source: string,
  limit: number = 10000
): Promise<KLineData[]> {
  let response: OhlcvResponse;

  if (source.startsWith("broker:")) {
    response = await $fetch<OhlcvResponse>("/api/chart/ohlcv", {
      method: "POST",
      body: { source, symbol, timeframe, limit },
    });
  } else {
    response = await $fetch<OhlcvResponse>("/api/chart/ohlcv", {
      params: { symbol, timeframe, source, limit },
    });
  }

  return response.data as KLineData[];
}

onMounted(() => {
  if (!chartContainer.value) return;

  chart = init(chartContainer.value, {
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

  // Set data loader
  chart.setDataLoader({
    getBars: async (params: DataLoaderGetBarsParams) => {
      // Only load on init; ignore forward/backward for now
      if (params.type !== "init") {
        params.callback([], false);
        return;
      }

      try {
        const data = await fetchOhlcvData(
          params.symbol.ticker,
          props.timeframe,
          props.source
        );
        params.callback(data, false);
      } catch (e) {
        console.error("Failed to load chart data:", e);
        params.callback([], false);
      }
    },
  });

  // Set initial symbol and period
  chart.setSymbol({
    ticker: props.symbol,
    pricePrecision: props.pricePrecision,
    volumePrecision: 0,
  });

  const period = PERIOD_MAP[props.timeframe] ?? { type: "hour", span: 1 };
  chart.setPeriod(period as any);

  // Handle resize
  const observer = new ResizeObserver(() => {
    chart?.resize();
  });
  observer.observe(chartContainer.value);
  onBeforeUnmount(() => observer.disconnect());
});

onBeforeUnmount(() => {
  if (chartContainer.value) {
    dispose(chartContainer.value);
    chart = null;
  }
});

// Watch symbol changes → update chart symbol (triggers data reload via DataLoader)
watch(
  () => props.symbol,
  (newSymbol) => {
    if (!chart) return;
    chart.setSymbol({
      ticker: newSymbol,
      pricePrecision: props.pricePrecision,
      volumePrecision: 0,
    });
  }
);

// Watch timeframe changes → update chart period
watch(
  () => props.timeframe,
  (newTf) => {
    if (!chart) return;
    const period = PERIOD_MAP[newTf] ?? { type: "hour", span: 1 };
    chart.setPeriod(period as any);
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

// Watch source changes → reset data (symbol stays same but source changes)
watch(
  () => props.source,
  () => {
    if (!chart) return;
    // Re-set symbol to trigger DataLoader reload
    chart.setSymbol({
      ticker: props.symbol,
      pricePrecision: props.pricePrecision,
      volumePrecision: 0,
    });
  }
);

// Watch drawing tool changes
watch(
  () => props.activeDrawingTool,
  (tool) => {
    if (!chart) return;
    if (tool) {
      chart.createOverlay(tool);
    }
  }
);

// Expose chart instance for parent component access
function getChart(): Chart | null {
  return chart;
}

defineExpose({ getChart });
</script>

<template>
  <div ref="chartContainer" class="w-full h-full bg-gray-950" />
</template>
