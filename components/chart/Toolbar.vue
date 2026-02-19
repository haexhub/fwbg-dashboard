<script setup lang="ts">
import { TIMEFRAME_LABELS } from "~/types/chart";
import type { ChartSource, ChartSymbol, ActiveIndicator } from "~/types/chart";

const props = defineProps<{
  source: string;
  symbol: string;
  timeframe: string;
  chartType: "candle_solid" | "ohlc" | "area";
  sources: ChartSource[];
  availableSymbols: ChartSymbol[];
  availableTimeframes: string[];
  activeIndicators: ActiveIndicator[];
  activeDrawingTool: string | null;
  isFullscreen: boolean;
}>();

const emit = defineEmits<{
  "update:source": [value: string];
  "update:symbol": [value: string];
  "update:timeframe": [value: string];
  "update:chart-type": [value: "candle_solid" | "ohlc" | "area"];
  "update:drawing-tool": [value: string | null];
  "open-indicators": [];
  screenshot: [];
  "toggle-fullscreen": [];
  "zoom-in": [];
  "zoom-out": [];
  "zoom-reset": [];
}>();

// Chart type options
const chartTypes = [
  { type: "candle_solid" as const, icon: "i-lucide-candlestick-chart", label: "Candles" },
  { type: "ohlc" as const, icon: "i-lucide-bar-chart-3", label: "Bars" },
  { type: "area" as const, icon: "i-lucide-area-chart", label: "Area" },
];

// Source options for USelect
const sourceOptions = computed(() =>
  props.sources.map((s) => ({
    label: s.name,
    value: s.name,
    description: s.description,
  }))
);

// Symbol options grouped by asset class
const symbolOptions = computed(() => {
  const groups: Record<string, { label: string; value: string }[]> = {};
  for (const sym of props.availableSymbols) {
    const cls = sym.asset_class ?? "OTHER";
    if (!groups[cls]) groups[cls] = [];
    groups[cls].push({ label: sym.symbol, value: sym.symbol });
  }
  return Object.entries(groups).map(([label, items]) => ({
    label,
    items,
  }));
});

// Flat symbol items for non-grouped select
const symbolItems = computed(() =>
  props.availableSymbols.map((s) => ({
    label: s.symbol,
    value: s.symbol,
  }))
);

// Timeframe options for USelect
const timeframeItems = computed(() =>
  props.availableTimeframes.map((tf) => ({
    label: TIMEFRAME_LABELS[tf] ?? tf,
    value: tf,
  }))
);

// Drawing tools — icons matching KLineChart demo style
const drawingTools = [
  { name: "segment", icon: "i-lucide-minus", label: "Segment" },
  { name: "horizontalStraightLine", icon: "i-lucide-grip-horizontal", label: "Horizontal" },
  { name: "rayLine", icon: "i-lucide-move-diagonal-2", label: "Ray" },
  { name: "fibonacciLine", icon: "i-lucide-align-justify", label: "Fibonacci" },
  { name: "parallelStraightLine", icon: "i-lucide-equal", label: "Channel" },
  { name: "priceLine", icon: "i-lucide-dollar-sign", label: "Price Line" },
  { name: "simpleTag", icon: "i-lucide-tag", label: "Tag" },
];

function toggleDrawingTool(tool: string) {
  if (props.activeDrawingTool === tool) {
    emit("update:drawing-tool", null);
  } else {
    emit("update:drawing-tool", tool);
  }
}
</script>

<template>
  <div
    class="shrink-0 flex items-center gap-3 px-2 py-2 border-b border-gray-800/50"
  >
    <!-- Source selector -->
    <USelect
      :model-value="source"
      :items="sourceOptions"
      value-key="value"
      size="sm"
      class="w-36"
      @update:model-value="emit('update:source', $event)"
    />

    <!-- Symbol selector -->
    <USelect
      :model-value="symbol"
      :items="symbolItems"
      value-key="value"
      size="sm"
      class="w-32"
      @update:model-value="emit('update:symbol', $event)"
    />

    <!-- Chart type switcher -->
    <div class="flex gap-0.5">
      <UTooltip
        v-for="ct in chartTypes"
        :key="ct.type"
        :text="ct.label"
      >
        <UButton
          :icon="ct.icon"
          :variant="chartType === ct.type ? 'soft' : 'ghost'"
          size="xs"
          @click="emit('update:chart-type', ct.type)"
        />
      </UTooltip>
    </div>

    <!-- Timeframe selector -->
    <USelect
      :model-value="timeframe"
      :items="timeframeItems"
      value-key="value"
      size="sm"
      class="w-20"
      @update:model-value="emit('update:timeframe', $event)"
    />

    <USeparator orientation="vertical" class="h-6" />

    <!-- Drawing tools -->
    <div class="flex gap-0.5">
      <UTooltip
        v-for="tool in drawingTools"
        :key="tool.name"
        :text="tool.label"
      >
        <UButton
          :icon="tool.icon"
          :variant="activeDrawingTool === tool.name ? 'soft' : 'ghost'"
          size="xs"
          @click="toggleDrawingTool(tool.name)"
        />
      </UTooltip>
    </div>

    <USeparator orientation="vertical" class="h-6" />

    <!-- Indicator button -->
    <UButton
      icon="i-heroicons-chart-bar-square"
      variant="ghost"
      size="xs"
      @click="emit('open-indicators')"
    >
      Indicators
      <UBadge
        v-if="activeIndicators.length > 0"
        :label="String(activeIndicators.length)"
        size="sm"
        color="primary"
        variant="subtle"
        class="ml-1"
      />
    </UButton>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Zoom controls -->
    <div class="flex gap-0.5">
      <UTooltip text="Zoom In">
        <UButton icon="i-lucide-zoom-in" variant="ghost" size="xs" @click="emit('zoom-in')" />
      </UTooltip>
      <UTooltip text="Zoom Out">
        <UButton icon="i-lucide-zoom-out" variant="ghost" size="xs" @click="emit('zoom-out')" />
      </UTooltip>
      <UTooltip text="Reset">
        <UButton icon="i-lucide-rotate-ccw" variant="ghost" size="xs" @click="emit('zoom-reset')" />
      </UTooltip>
    </div>

    <USeparator orientation="vertical" class="h-6" />

    <!-- Screenshot -->
    <UTooltip text="Screenshot">
      <UButton icon="i-lucide-camera" variant="ghost" size="xs" @click="emit('screenshot')" />
    </UTooltip>

    <!-- Fullscreen -->
    <UTooltip :text="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'">
      <UButton
        :icon="isFullscreen ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
        variant="ghost"
        size="xs"
        @click="emit('toggle-fullscreen')"
      />
    </UTooltip>
  </div>
</template>
