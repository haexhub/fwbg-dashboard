<script setup lang="ts">
import type { ActiveIndicator } from "~/types/chart";

const props = defineProps<{
  indicators: ActiveIndicator[];
  collapsedIds: Record<string, boolean>;
  signalTimestamps: number[];
  currentSignalIndex: number;
  selectedSignalIds: string[];
}>();

const emit = defineEmits<{
  "toggle-collapse": [id: string];
  "collapse-all": [];
  "expand-all": [];
  "remove": [id: string];
  "signal-prev": [];
  "signal-next": [];
  "signal-goto": [index: number];
  "update:selected-signals": [ids: string[]];
}>();

const signalIndicators = computed(() =>
  props.indicators.filter((i) => i.isSignal)
);

const hasSignals = computed(() => signalIndicators.value.length > 0);

const signalSelectOptions = computed(() =>
  signalIndicators.value.map((s) => ({ label: s.name, value: s.id }))
);

// Manual signal number input
const signalInput = ref("");

function handleSignalInput() {
  const num = parseInt(signalInput.value, 10);
  if (!isNaN(num) && num >= 1 && num <= props.signalTimestamps.length) {
    emit("signal-goto", num - 1); // 0-indexed
  }
  signalInput.value = "";
}
</script>

<template>
  <div
    v-if="indicators.length > 0"
    class="shrink-0 flex items-center gap-1.5 px-2 py-1 border-b border-gray-800/50 text-xs overflow-x-auto"
  >
    <!-- Collapse/Expand All -->
    <div class="flex gap-0.5 shrink-0">
      <UTooltip text="Alle minimieren">
        <UButton
          icon="i-lucide-chevrons-down-up"
          variant="ghost"
          size="xs"
          @click="emit('collapse-all')"
        />
      </UTooltip>
      <UTooltip text="Alle erweitern">
        <UButton
          icon="i-lucide-chevrons-up-down"
          variant="ghost"
          size="xs"
          @click="emit('expand-all')"
        />
      </UTooltip>
    </div>

    <USeparator orientation="vertical" class="h-4" />

    <!-- Indicator badges -->
    <div
      v-for="ind in indicators"
      :key="ind.id"
      class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-800/60 shrink-0 transition-opacity"
      :class="{ 'opacity-40': collapsedIds[ind.id] }"
    >
      <span class="text-gray-300 truncate max-w-28" :title="ind.name">
        {{ ind.name }}
      </span>
      <UButton
        :icon="collapsedIds[ind.id] ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        variant="ghost"
        color="neutral"
        size="xs"
        class="p-0"
        :title="collapsedIds[ind.id] ? 'Erweitern' : 'Minimieren'"
        @click="emit('toggle-collapse', ind.id)"
      />
      <UButton
        icon="i-lucide-x"
        variant="ghost"
        color="neutral"
        size="xs"
        class="p-0 hover:text-red-400"
        title="Entfernen"
        @click="emit('remove', ind.id)"
      />
    </div>

    <!-- Signal navigation -->
    <template v-if="hasSignals">
      <div class="flex-1" />
      <USeparator orientation="vertical" class="h-4" />
      <div class="flex items-center gap-1.5 shrink-0">
        <!-- Signal selector (multiselect) -->
        <USelectMenu
          :model-value="selectedSignalIds"
          :items="signalSelectOptions"
          value-key="value"
          multiple
          placeholder="Alle Signale"
          size="xs"
          class="w-40"
          @update:model-value="emit('update:selected-signals', $event as string[])"
        />

        <!-- Prev / Index / Next -->
        <UButton
          icon="i-lucide-chevron-left"
          variant="ghost"
          size="xs"
          :disabled="currentSignalIndex <= 0"
          @click="emit('signal-prev')"
        />
        <input
          v-model="signalInput"
          type="text"
          inputmode="numeric"
          class="w-14 text-center bg-gray-800/60 border border-gray-700/50 rounded px-1 py-0.5 text-gray-300 tabular-nums text-xs focus:outline-none focus:border-primary-500"
          :placeholder="
            currentSignalIndex >= 0
              ? String(currentSignalIndex + 1)
              : '–'
          "
          @keydown.enter="handleSignalInput"
        />
        <span class="text-gray-500">/{{ signalTimestamps.length }}</span>
        <UButton
          icon="i-lucide-chevron-right"
          variant="ghost"
          size="xs"
          :disabled="currentSignalIndex >= signalTimestamps.length - 1"
          @click="emit('signal-next')"
        />
      </div>
    </template>
  </div>
</template>
