<script setup lang="ts">
import { TIMEFRAME_LABELS } from "~/types/chart";
import type { ChartSource, ChartSymbol, ActiveIndicator } from "~/types/chart";
import { TRADING_SESSIONS } from "~/composables/useChartIndicators";

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
  hasActiveIndicators: boolean;
  rangeInterval: string;
  rangeStartTime: string;
  rangeEndTime: string;
  rangeWeekdays: number[];
  rangeUseOpenClose: boolean;
  sessionEnabledIds: string[];
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
  "update:session-enabled-ids": [value: string[]];
  "open-indicators": [];
  "create-signal": [];
  "save-strategy": [];
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
  { name: "rayLine", icon: "i-lucide-move-diagonal-2", label: "Ray" },
  { name: "fibonacciLine", icon: "i-lucide-align-justify", label: "Fibonacci" },
  { name: "filledChannel", icon: "i-lucide-equal", label: "Channel" },
  { name: "priceLine", icon: "i-lucide-dollar-sign", label: "Price Line" },
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

function toggleSession(id: string) {
  const current = new Set(props.sessionEnabledIds);
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  emit("update:session-enabled-ids", [...current]);
}

function toggleDrawingTool(tool: string) {
  if (props.activeDrawingTool === tool) {
    emit("update:drawing-tool", null);
  } else {
    emit("update:drawing-tool", tool);
  }
}

// Horizontal / Vertical line dropdown
const lineTools = [
  { label: "Horizontale Linie", name: "horizontalStraightLine", icon: "i-lucide-minus" },
  { label: "Vertikale Linie", name: "verticalStraightLine", icon: "i-lucide-separator-vertical" },
];

const isLineToolActive = computed(() =>
  lineTools.some((t) => t.name === props.activeDrawingTool),
);

const lineToolItems = computed(() =>
  lineTools.map((t) => [{
    label: t.label,
    icon: t.icon,
    onSelect: () => toggleDrawingTool(t.name),
  }]),
);
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

      <!-- Horizontal / Vertical line dropdown -->
      <UDropdownMenu :items="lineToolItems">
        <UButton
          icon="i-lucide-ruler"
          :variant="isLineToolActive ? 'soft' : 'ghost'"
        />
      </UDropdownMenu>
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

    <!-- Signal Config button -->
    <UTooltip text="Entry-Signale aus Indikator-Spalten konfigurieren">
      <UButton
        icon="i-heroicons-bolt"
        variant="ghost"
        :disabled="!hasActiveIndicators"
        @click="emit('create-signal')"
      >
        Signale
      </UButton>
    </UTooltip>

    <USeparator orientation="vertical" class="h-6" />

    <!-- Save strategy button -->
    <UTooltip text="Aktuelle Indikatoren als Strategie speichern">
      <UButton
        icon="i-lucide-save"
        variant="ghost"
        :disabled="!hasActiveIndicators"
        @click="emit('save-strategy')"
      >
        Strategie speichern
      </UButton>
    </UTooltip>

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

    <!-- Trading Sessions -->
    <UPopover>
      <UButton
        icon="i-lucide-clock"
        :variant="sessionEnabledIds.length > 0 ? 'soft' : 'ghost'"
      >
        Sessions
        <UBadge
          v-if="sessionEnabledIds.length > 0"
          :label="String(sessionEnabledIds.length)"
          color="primary"
          variant="subtle"
          class="ml-1"
        />
      </UButton>

      <template #content>
        <div class="p-4 space-y-1 w-72">
          <div class="text-sm text-gray-400 mb-3">Trading Sessions</div>
          <div
            v-for="session in TRADING_SESSIONS"
            :key="session.id"
            class="flex items-center gap-2 cursor-pointer hover:bg-gray-800/50 rounded px-2 py-1"
            @click="toggleSession(session.id)"
          >
            <div
              class="w-3 h-3 rounded-sm shrink-0"
              :style="{ backgroundColor: session.color.replace(/[\d.]+\)$/, '0.4)') }"
            />
            <span
              class="text-sm flex-1"
              :class="sessionEnabledIds.includes(session.id) ? 'text-white' : 'text-gray-500'"
            >
              {{ session.name }}
            </span>
            <USwitch
              :model-value="sessionEnabledIds.includes(session.id)"
              size="sm"
              @click.stop
              @update:model-value="toggleSession(session.id)"
            />
          </div>
          <USeparator class="my-2" />
          <div class="flex gap-2">
            <UButton size="xs" variant="ghost" @click="emit('update:session-enabled-ids', TRADING_SESSIONS.map((s) => s.id))">
              All
            </UButton>
            <UButton size="xs" variant="ghost" @click="emit('update:session-enabled-ids', [])">
              None
            </UButton>
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
