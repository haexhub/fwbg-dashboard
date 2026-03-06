<script setup lang="ts">
import { TRADING_SESSIONS } from "~/composables/useChartIndicators";
import type { ActiveIndicator } from "~/types/chart";

const props = defineProps<{
  activeDrawingTool: string | null;
  activeIndicators: ActiveIndicator[];
  hasActiveIndicators: boolean;
  rangeInterval: string;
  rangeStartTime: string;
  rangeEndTime: string;
  rangeWeekdays: number[];
  rangeUseOpenClose: boolean;
  sessionEnabledIds: string[];
}>();

const emit = defineEmits<{
  "update:drawing-tool": [value: string | null];
  "open-indicators": [];
  "create-signal": [];
  "save-strategy": [];
  "update:range-interval": [value: string];
  "update:range-start-time": [value: string];
  "update:range-end-time": [value: string];
  "update:range-weekdays": [value: number[]];
  "update:range-use-open-close": [value: boolean];
  "update:session-enabled-ids": [value: string[]];
}>();

const drawingTools = [
  { name: "segment", icon: "i-lucide-minus", label: "Segment" },
  { name: "rayLine", icon: "i-lucide-move-diagonal-2", label: "Ray" },
  { name: "fibonacciLine", icon: "i-lucide-align-justify", label: "Fibonacci" },
  { name: "filledChannel", icon: "i-lucide-equal", label: "Channel" },
  { name: "priceLine", icon: "i-lucide-dollar-sign", label: "Price Line" },
  { name: "rect", icon: "i-lucide-square", label: "Rectangle" },
];

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

function toggleDrawingTool(tool: string) {
  if (props.activeDrawingTool === tool) {
    emit("update:drawing-tool", null);
  } else {
    emit("update:drawing-tool", tool);
  }
}

const rangeIntervalOptions = [
  { label: "Off", value: "" },
  { label: "1D", value: "1d" },
  { label: "1W", value: "1w" },
  { label: "1M", value: "1m" },
];

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
  if (current.has(day)) current.delete(day);
  else current.add(day);
  emit("update:range-weekdays", [...current]);
}

function toggleSession(id: string) {
  const current = new Set(props.sessionEnabledIds);
  if (current.has(id)) current.delete(id);
  else current.add(id);
  emit("update:session-enabled-ids", [...current]);
}
</script>

<template>
  <div class="shrink-0 flex flex-col items-center gap-0.5 px-1 py-2 border-r border-gray-800/50">
    <!-- Drawing tools -->
    <UTooltip
      v-for="tool in drawingTools"
      :key="tool.name"
      :text="tool.label"
      :popper="{ placement: 'right' }"
    >
      <UButton
        :icon="tool.icon"
        :variant="activeDrawingTool === tool.name ? 'soft' : 'ghost'"
        @click="toggleDrawingTool(tool.name)"
      />
    </UTooltip>

    <!-- Horizontal / Vertical line dropdown -->
    <UTooltip text="Linien" :popper="{ placement: 'right' }">
      <UDropdownMenu :items="lineToolItems">
        <UButton
          icon="i-lucide-ruler"
          :variant="isLineToolActive ? 'soft' : 'ghost'"
        />
      </UDropdownMenu>
    </UTooltip>

    <USeparator class="w-5 my-1" />

    <!-- Indicators -->
    <UTooltip text="Indicators" :popper="{ placement: 'right' }">
      <UButton
        icon="i-heroicons-chart-bar-square"
        variant="ghost"
        class="relative"
        @click="emit('open-indicators')"
      >
        <UBadge
          v-if="activeIndicators.length > 0"
          :label="String(activeIndicators.length)"
          color="primary"
          variant="subtle"
          class="absolute -top-1 -right-1 min-w-4 h-4 text-[10px] px-1"
        />
      </UButton>
    </UTooltip>

    <!-- Signale -->
    <UTooltip text="Entry-Signale konfigurieren" :popper="{ placement: 'right' }">
      <UButton
        icon="i-heroicons-bolt"
        variant="ghost"
        :disabled="!hasActiveIndicators"
        @click="emit('create-signal')"
      />
    </UTooltip>

    <!-- Strategie speichern -->
    <UTooltip text="Strategie speichern" :popper="{ placement: 'right' }">
      <UButton
        icon="i-lucide-save"
        variant="ghost"
        :disabled="!hasActiveIndicators"
        @click="emit('save-strategy')"
      />
    </UTooltip>

    <USeparator class="w-5 my-1" />

    <!-- Ranges -->
    <UPopover :popper="{ placement: 'right' }">
      <UTooltip text="Ranges" :popper="{ placement: 'right' }">
        <UButton
          icon="i-lucide-grid-2x2"
          :variant="rangeInterval ? 'soft' : 'ghost'"
          class="relative"
        >
          <UBadge
            v-if="rangeInterval"
            color="primary"
            variant="subtle"
            class="absolute -top-1 -right-1 min-w-4 h-4 text-[10px] px-1"
            label="●"
          />
        </UButton>
      </UTooltip>

      <template #content>
        <div class="p-4 space-y-4 w-96">
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

          <div v-if="rangeInterval" class="flex items-center justify-between">
            <span class="text-sm text-gray-400">Open/Close only</span>
            <USwitch
              :model-value="rangeUseOpenClose"
              @update:model-value="emit('update:range-use-open-close', $event)"
            />
          </div>

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

    <!-- Sessions -->
    <UPopover :popper="{ placement: 'right' }">
      <UTooltip text="Trading Sessions" :popper="{ placement: 'right' }">
        <UButton
          icon="i-lucide-clock"
          :variant="sessionEnabledIds.length > 0 ? 'soft' : 'ghost'"
          class="relative"
        >
          <UBadge
            v-if="sessionEnabledIds.length > 0"
            :label="String(sessionEnabledIds.length)"
            color="primary"
            variant="subtle"
            class="absolute -top-1 -right-1 min-w-4 h-4 text-[10px] px-1"
          />
        </UButton>
      </UTooltip>

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
  </div>
</template>
