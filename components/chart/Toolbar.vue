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
  rangeInterval: string;
  rangeStartTime: string;
  rangeEndTime: string;
  rangeWeekdays: number[];
  rangeUseOpenClose: boolean;
  isFullscreen: boolean;
}>();

const emit = defineEmits<{
  "update:source": [value: string];
  "update:symbol": [value: string];
  "update:timeframe": [value: string];
  "update:chart-type": [value: "candle_solid" | "ohlc" | "area"];
  "update:drawing-tool": [value: string | null];
  "update:range-interval": [value: string];
  "update:range-start-time": [value: string];
  "update:range-end-time": [value: string];
  "update:range-weekdays": [value: number[]];
  "update:range-use-open-close": [value: boolean];
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
  { name: "rect", icon: "i-lucide-square", label: "Rectangle" },
];

// Range rectangle interval options
const rangeIntervalOptions = [
  { label: "Off", value: "" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
];

const activeRangeLabel = computed(
  () => rangeIntervalOptions.find((o) => o.value === props.rangeInterval)?.label ?? "Off"
);

// Weekday toggle for 1W mode
const weekdayLabels = [
  { value: 1, label: "Mo" },
  { value: 2, label: "Tu" },
  { value: 3, label: "We" },
  { value: 4, label: "Th" },
  { value: 5, label: "Fr" },
  { value: 6, label: "Sa" },
  { value: 0, label: "Su" },
];

function toggleWeekday(day: number) {
  const current = new Set(props.rangeWeekdays);
  if (current.has(day)) {
    current.delete(day);
  } else {
    current.add(day);
  }
  emit("update:range-weekdays", [...current]);
}

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
      class="w-36"
      @update:model-value="emit('update:source', $event)"
    />

    <!-- Symbol selector -->
    <USelect
      :model-value="symbol"
      :items="symbolItems"
      value-key="value"
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
          @click="emit('update:chart-type', ct.type)"
        />
      </UTooltip>
    </div>

    <!-- Timeframe selector -->
    <USelect
      :model-value="timeframe"
      :items="timeframeItems"
      value-key="value"
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
          @click="toggleDrawingTool(tool.name)"
        />
      </UTooltip>
    </div>

    <USeparator orientation="vertical" class="h-6" />

    <!-- Indicator button -->
    <UButton
      icon="i-heroicons-chart-bar-square"
      variant="ghost"
      @click="emit('open-indicators')"
    >
      Indicators
      <UBadge
        v-if="activeIndicators.length > 0"
        :label="String(activeIndicators.length)"
        color="primary"
        variant="subtle"
        class="ml-1"
      />
    </UButton>

    <!-- Range Rectangles -->
    <UPopover>
      <UButton
        icon="i-lucide-grid-2x2"
        :variant="rangeInterval ? 'soft' : 'ghost'"
      >
        Ranges
        <UBadge
          v-if="rangeInterval"
          :label="activeRangeLabel"
          color="primary"
          variant="subtle"
          class="ml-1"
        />
      </UButton>

      <template #content>
        <div class="p-4 space-y-4 w-96">
          <!-- Interval selector -->
          <div>
            <div class="text-sm text-gray-400 mb-2">Interval</div>
            <div class="flex flex-wrap gap-1.5">
              <UButton
                v-for="o in rangeIntervalOptions"
                :key="o.value"
                :variant="rangeInterval === o.value ? 'soft' : 'ghost'"
                @click="emit('update:range-interval', o.value)"
              >
                {{ o.label }}
              </UButton>
            </div>
          </div>

          <!-- Time filter -->
          <div v-if="rangeInterval">
            <div class="text-sm text-gray-400 mb-2">Time Filter</div>
            <div class="flex items-center gap-2">
              <UInput
                type="time"
                :model-value="rangeStartTime"
                class="flex-1"
                @update:model-value="emit('update:range-start-time', $event)"
              />
              <span class="text-sm text-gray-500">–</span>
              <UInput
                type="time"
                :model-value="rangeEndTime"
                class="flex-1"
                @update:model-value="emit('update:range-end-time', $event)"
              />
            </div>
          </div>

          <!-- Open/Close only toggle -->
          <div v-if="rangeInterval" class="flex items-center justify-between">
            <span class="text-sm text-gray-400">Open/Close only</span>
            <USwitch
              :model-value="rangeUseOpenClose"
              @update:model-value="emit('update:range-use-open-close', $event)"
            />
          </div>

          <!-- Weekday selector (1W only) -->
          <div v-if="rangeInterval === '1w'">
            <div class="text-sm text-gray-400 mb-2">Weekdays</div>
            <div class="flex gap-1">
              <UButton
                v-for="wd in weekdayLabels"
                :key="wd.value"
                :variant="rangeWeekdays.includes(wd.value) ? 'soft' : 'ghost'"
                @click="toggleWeekday(wd.value)"
              >
                {{ wd.label }}
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UPopover>

    <!-- Spacer -->
    <div class="flex-1" />

    <!-- Zoom controls -->
    <div class="flex gap-0.5">
      <UTooltip text="Zoom In">
        <UButton icon="i-lucide-zoom-in" variant="ghost" @click="emit('zoom-in')" />
      </UTooltip>
      <UTooltip text="Zoom Out">
        <UButton icon="i-lucide-zoom-out" variant="ghost" @click="emit('zoom-out')" />
      </UTooltip>
      <UTooltip text="Reset">
        <UButton icon="i-lucide-rotate-ccw" variant="ghost" @click="emit('zoom-reset')" />
      </UTooltip>
    </div>

    <USeparator orientation="vertical" class="h-6" />

    <!-- Screenshot -->
    <UTooltip text="Screenshot">
      <UButton icon="i-lucide-camera" variant="ghost" @click="emit('screenshot')" />
    </UTooltip>

    <!-- Fullscreen -->
    <UTooltip :text="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'">
      <UButton
        :icon="isFullscreen ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
        variant="ghost"
        @click="emit('toggle-fullscreen')"
      />
    </UTooltip>
  </div>
</template>
