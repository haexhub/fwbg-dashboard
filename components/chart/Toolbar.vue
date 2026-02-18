<script setup lang="ts">
import { TIMEFRAME_LABELS } from "~/types/chart";
import type { ChartSource, ChartSymbol, ActiveIndicator } from "~/types/chart";

const props = defineProps<{
  source: string;
  symbol: string;
  timeframe: string;
  sources: ChartSource[];
  availableSymbols: ChartSymbol[];
  availableTimeframes: string[];
  activeIndicators: ActiveIndicator[];
  activeDrawingTool: string | null;
}>();

const emit = defineEmits<{
  "update:source": [value: string];
  "update:symbol": [value: string];
  "update:timeframe": [value: string];
  "update:drawing-tool": [value: string | null];
  "open-indicators": [];
}>();

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

// Drawing tools
const drawingTools = [
  { name: "segment", icon: "i-heroicons-minus", label: "Trend Line" },
  {
    name: "horizontalStraightLine",
    icon: "i-heroicons-bars-2",
    label: "Horizontal",
  },
  {
    name: "rayLine",
    icon: "i-heroicons-arrow-long-right",
    label: "Ray",
  },
  {
    name: "fibonacciLine",
    icon: "i-heroicons-chart-bar",
    label: "Fibonacci",
  },
  {
    name: "parallelStraightLine",
    icon: "i-heroicons-arrows-up-down",
    label: "Channel",
  },
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

    <!-- Timeframe buttons -->
    <div class="flex gap-0.5">
      <UButton
        v-for="tf in availableTimeframes"
        :key="tf"
        :variant="timeframe === tf ? 'soft' : 'ghost'"
        size="xs"
        @click="emit('update:timeframe', tf)"
      >
        {{ TIMEFRAME_LABELS[tf] ?? tf }}
      </UButton>
    </div>

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
  </div>
</template>
