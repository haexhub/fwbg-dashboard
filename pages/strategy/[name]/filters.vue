<script setup lang="ts">
const store = useStrategyConfigStore();
const { config } = storeToRefs(store);
const filtersRef = computed(() => config.value?._refs?.filters);

const f = computed(() => config.value?.filters as Record<string, unknown> | undefined);

function getVal<T>(key: string, fallback: T): T {
  return (f.value?.[key] as T) ?? fallback;
}

function setVal(key: string, value: unknown) {
  if (!config.value) return;
  config.value.filters[key] = value;
}

// Hour options (0-23)
const hourOptions = Array.from({ length: 24 }, (_, i) => ({
  label: `${String(i).padStart(2, "0")}:00`,
  value: i,
}));

// Day options (0=Mon, 6=Sun)
const dayLabels = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const dayOptions = dayLabels.map((label, i) => ({ label, value: i }));

const selectedHours = computed({
  get: () => (getVal<number[] | null>("allowed_hours", null) ?? []),
  set: (v) => setVal("allowed_hours", v.length ? v : null),
});

const selectedDays = computed({
  get: () => (getVal<number[] | null>("allowed_days", null) ?? []),
  set: (v) => setVal("allowed_days", v.length ? v : null),
});

function toggleHour(hour: number) {
  const current = [...selectedHours.value];
  const idx = current.indexOf(hour);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(hour);
  selectedHours.value = current.sort((a, b) => a - b);
}

function toggleDay(day: number) {
  const current = [...selectedDays.value];
  const idx = current.indexOf(day);
  if (idx >= 0) current.splice(idx, 1);
  else current.push(day);
  selectedDays.value = current.sort((a, b) => a - b);
}
</script>

<template>
  <div v-if="f" class="overflow-y-auto h-full p-1">
    <div class="space-y-6">
      <StrategyPresetSelectorBar
        section="filters"
        label="Filter"
        :current-ref="filtersRef"
        :model-value="f"
        @apply="(name, content) => store.applyPreset('filters', name, content)"
        @detach="store.detachPreset('filters')"
      />
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Performance-Filter</h3>
        </template>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Min. RRR">
            <UInput
              :model-value="getVal('min_rrr', 0)"
              type="number"
              step="0.1"
              class="w-full"
              @update:model-value="setVal('min_rrr', Number($event))"
            />
          </UFormField>
          <UFormField label="Min. Trades">
            <UInput
              :model-value="getVal('min_trades', 30)"
              type="number"
              class="w-full"
              @update:model-value="setVal('min_trades', Number($event))"
            />
          </UFormField>
          <UFormField label="Min. Annual Return">
            <UInput
              :model-value="getVal('min_annual_return', 0)"
              type="number"
              step="0.1"
              class="w-full"
              @update:model-value="setVal('min_annual_return', Number($event))"
            />
          </UFormField>
          <UFormField label="Min. Sharpe">
            <UInput
              :model-value="getVal('min_sharpe', 0)"
              type="number"
              step="0.1"
              class="w-full"
              @update:model-value="setVal('min_sharpe', Number($event))"
            />
          </UFormField>
          <UFormField label="Max. Drawdown">
            <UInput
              :model-value="getVal('max_drawdown', 1.0)"
              type="number"
              step="0.05"
              :min="0"
              :max="1"
              class="w-full"
              @update:model-value="setVal('max_drawdown', Number($event))"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Time-based Entry Filters -->
      <UCard>
        <template #header>
          <div>
            <h3 class="text-lg font-medium text-white">Entry-Zeitfilter</h3>
            <p class="text-sm text-gray-400 mt-1">Trades werden nur in den ausgewählten Stunden/Tagen eröffnet. Leere Auswahl = kein Filter.</p>
          </div>
        </template>
        <div class="space-y-5">
          <!-- Allowed Hours -->
          <UFormField label="Erlaubte Stunden (UTC)">
            <div class="flex flex-wrap gap-1">
              <button
                v-for="h in hourOptions"
                :key="h.value"
                type="button"
                class="px-2 py-1 text-xs font-mono rounded border transition-colors"
                :class="selectedHours.includes(h.value)
                  ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'"
                @click="toggleHour(h.value)"
              >
                {{ h.label }}
              </button>
            </div>
          </UFormField>

          <!-- Allowed Days -->
          <UFormField label="Erlaubte Wochentage">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="d in dayOptions"
                :key="d.value"
                type="button"
                class="px-3 py-1.5 text-sm rounded border transition-colors"
                :class="selectedDays.includes(d.value)
                  ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                  : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'"
                @click="toggleDay(d.value)"
              >
                {{ d.label }}
              </button>
            </div>
          </UFormField>
        </div>
      </UCard>
    </div>
  </div>
</template>
