<script setup lang="ts">
import { TIMEFRAME_LABELS } from "~/types/chart";
import type { ChartSource, ChartSymbol } from "~/types/chart";

const props = defineProps<{
  source: string;
  symbol: string;
  timeframe: string;
  chartType: "candle_solid" | "ohlc" | "area";
  sources: ChartSource[];
  availableSymbols: ChartSymbol[];
  availableTimeframes: string[];
  isFullscreen: boolean;
}>();

const emit = defineEmits<{
  "update:source": [value: string];
  "update:symbol": [value: string];
  "update:timeframe": [value: string];
  "update:chart-type": [value: "candle_solid" | "ohlc" | "area"];
  screenshot: [];
  "toggle-fullscreen": [];
  "zoom-in": [];
  "zoom-out": [];
  "zoom-reset": [];
}>();

const chartTypes = [
  { type: "candle_solid" as const, icon: "i-lucide-candlestick-chart", label: "Candles" },
  { type: "ohlc" as const, icon: "i-lucide-bar-chart-3", label: "Bars" },
  { type: "area" as const, icon: "i-lucide-area-chart", label: "Area" },
];

const sourceOptions = computed(() =>
  props.sources.map((s) => ({
    label: s.name,
    value: s.name,
    description: s.description,
  }))
);

const symbolItems = computed(() =>
  props.availableSymbols.map((s) => ({
    label: s.symbol,
    value: s.symbol,
  }))
);

const timeframeItems = computed(() =>
  props.availableTimeframes.map((tf) => ({
    label: TIMEFRAME_LABELS[tf] ?? tf,
    value: tf,
  }))
);
</script>

<template>
  <div class="shrink-0 flex items-center gap-3 px-2 py-2 border-b border-gray-800/50">
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
