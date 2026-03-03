<script setup lang="ts">
import type { RunLogEntry, LogLevel } from "~/types/run-progress";

const props = defineProps<{
  logs: RunLogEntry[];
  availableSymbols: string[];
}>();

const levelFilter = defineModel<LogLevel | undefined>("levelFilter");
const symbolFilter = defineModel<string | undefined>("symbolFilter");

const levelOptions = [
  { label: "Alle", value: "" },
  { label: "Info", value: "info" },
  { label: "Debug", value: "debug" },
  { label: "Warning", value: "warning" },
  { label: "Error", value: "error" },
];

const symbolOptions = computed(() => {
  const opts = [{ label: "Alle Symbole", value: "" }];
  for (const s of props.availableSymbols) {
    opts.push({ label: s, value: s });
  }
  return opts;
});

// Proxy for USelect (converts "" ↔ undefined)
const selectedLevel = computed({
  get: () => levelFilter.value ?? "",
  set: (v: string) => { levelFilter.value = (v || undefined) as LogLevel | undefined; },
});

const selectedSymbol = computed({
  get: () => symbolFilter.value ?? "",
  set: (v: string) => { symbolFilter.value = v || undefined; },
});

// ── Auto-scroll ──
const scrollContainer = ref<HTMLElement | null>(null);
const isNearBottom = ref(true);

function onScroll() {
  if (!scrollContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;
  isNearBottom.value = scrollHeight - scrollTop - clientHeight < 100;
}

watch(
  () => props.logs.length,
  async () => {
    if (!isNearBottom.value) return;
    await nextTick();
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  },
);

// ── Formatting ──
function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function levelClass(level: LogLevel): string {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warning":
      return "text-yellow-400";
    case "debug":
      return "text-gray-500";
    default:
      return "text-gray-300";
  }
}

function levelBadgeClass(level: LogLevel): string {
  switch (level) {
    case "error":
      return "text-red-500";
    case "warning":
      return "text-yellow-500";
    case "debug":
      return "text-gray-600";
    default:
      return "text-blue-400";
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-white">Logs</h2>
        <div class="flex items-center gap-2">
          <USelect
            v-model="selectedLevel"
            :items="levelOptions"
            size="xs"
            class="w-28"
          />
          <USelect
            v-if="availableSymbols.length > 1"
            v-model="selectedSymbol"
            :items="symbolOptions"
            size="xs"
            class="w-36"
          />
        </div>
      </div>
    </template>

    <div
      ref="scrollContainer"
      class="h-[32rem] overflow-y-auto bg-gray-950 rounded p-3 font-mono text-xs leading-relaxed"
      @scroll="onScroll"
    >
      <div
        v-for="(entry, i) in logs"
        :key="i"
        class="py-0.5 flex gap-2"
        :class="levelClass(entry.level)"
      >
        <span class="text-gray-600 shrink-0">{{ formatTime(entry.timestamp) }}</span>
        <span class="shrink-0 w-[4.5rem]" :class="levelBadgeClass(entry.level)">
          {{ entry.level.toUpperCase().padEnd(7) }}
        </span>
        <span class="text-gray-500 shrink-0 w-20 truncate">{{ entry.symbol }}</span>
        <span>{{ entry.message }}</span>
      </div>

      <div
        v-if="!logs.length"
        class="py-8 text-center text-gray-600"
      >
        Keine Logs vorhanden
      </div>
    </div>
  </UCard>
</template>
