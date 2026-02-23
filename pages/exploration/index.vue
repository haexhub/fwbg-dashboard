<script setup lang="ts">
import type { ChartSource, ChartSymbol } from "~/types/chart";
import { TIMEFRAME_LABELS } from "~/types/chart";

const {
  exitOptimizations,
  exitOptimizationsStatus,
  refreshExitOptimizations,
  runExitOptimization,
  running,
} = useExploration();

// ── Data sources (same as chart view) ──
const { data: sources } = useFetch<ChartSource[]>("/api/chart/sources", {
  default: () => [],
});

const selectedSource = ref("");
const selectedSymbol = ref("");
const selectedTimeframe = ref("");

// Auto-select first source
watch(sources, (list) => {
  if (list?.length && !selectedSource.value) {
    selectedSource.value = list[0]!.name;
  }
}, { immediate: true });

const currentSource = computed(
  () => sources.value?.find((s) => s.name === selectedSource.value)
);

const availableSymbols = computed<ChartSymbol[]>(
  () => currentSource.value?.symbols ?? []
);

const currentSymbol = computed(
  () => availableSymbols.value.find((s) => s.symbol === selectedSymbol.value)
);

const availableTimeframes = computed<string[]>(
  () => currentSymbol.value?.timeframes ?? []
);

// Source options
const sourceOptions = computed(() =>
  (sources.value ?? []).map((s) => ({ label: s.name, value: s.name }))
);

// Symbol options
const symbolOptions = computed(() =>
  availableSymbols.value.map((s) => ({ label: s.symbol, value: s.symbol }))
);

// Timeframe options
const timeframeOptions = computed(() =>
  availableTimeframes.value.map((tf) => ({
    label: TIMEFRAME_LABELS[tf] ?? tf,
    value: tf,
  }))
);

// Auto-select first symbol when source changes
watch(selectedSource, () => {
  const syms = availableSymbols.value;
  if (syms.length && !syms.find((s) => s.symbol === selectedSymbol.value)) {
    selectedSymbol.value = syms[0]!.symbol;
  }
});

// Auto-select first timeframe when symbol changes
watch(selectedSymbol, () => {
  const tfs = availableTimeframes.value;
  if (tfs.length && !tfs.includes(selectedTimeframe.value)) {
    selectedTimeframe.value = tfs[0]!;
  }
});

// Construct asset filename from selection
const assetFilename = computed(() => {
  if (!selectedSymbol.value || !selectedTimeframe.value) return "";
  return `${selectedSymbol.value}_${selectedTimeframe.value}.csv`;
});

// ── New Exit Optimization form ──
const showForm = ref(false);
const exitStrategy = ref("atr_based");
const maxBars = ref(48);
const error = ref("");

async function submit() {
  if (!selectedSymbol.value || !selectedTimeframe.value) return;
  error.value = "";
  try {
    const result = await runExitOptimization({
      source: selectedSource.value,
      symbol: selectedSymbol.value,
      timeframe: selectedTimeframe.value,
      exit_strategy: exitStrategy.value,
      max_bars: maxBars.value,
    });
    showForm.value = false;
    navigateTo(`/exploration/asset/${result.symbol}`);
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || "Exit-Optimization fehlgeschlagen";
  }
}

function formatDate(ts?: string): string {
  if (!ts) return "-";
  return new Date(ts).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-white">Exploration</h2>
      <UButton
        icon="i-heroicons-arrow-path"
        variant="ghost"
        @click="refreshExitOptimizations()"
      >
        Refresh
      </UButton>
    </div>

    <!-- Exit Optimization Section -->
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-medium text-white">Exit-Optimization</h3>
          <UButton
            :icon="showForm ? 'i-heroicons-x-mark' : 'i-heroicons-plus'"
            size="sm"
            variant="soft"
            @click="showForm = !showForm"
          >
            {{ showForm ? "Abbrechen" : "Neue Analyse" }}
          </UButton>
        </div>
      </template>

      <!-- New analysis form -->
      <div v-if="showForm" class="mb-6 space-y-4 border-b border-gray-800 pb-6">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_2fr_1fr]">
          <UFormField label="Datenquelle">
            <USelect
              v-model="selectedSource"
              :items="sourceOptions"
              value-key="value"
              class="w-full"
              :disabled="running"
            />
          </UFormField>
          <UFormField label="Symbol">
            <USelect
              v-model="selectedSymbol"
              :items="symbolOptions"
              value-key="value"
              class="w-full"
              :disabled="running"
            />
          </UFormField>
          <UFormField label="Timeframe">
            <USelect
              v-model="selectedTimeframe"
              :items="timeframeOptions"
              value-key="value"
              class="w-full"
              :disabled="running"
            />
          </UFormField>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr_auto]">
          <UFormField label="Exit-Strategie">
            <UInput
              v-model="exitStrategy"
              placeholder="atr_based"
              class="w-full"
              :disabled="running"
            />
          </UFormField>
          <UFormField label="Max. Bars forward">
            <UInput
              v-model.number="maxBars"
              type="number"
              class="w-full"
              :min="10"
              :max="200"
              :disabled="running"
            />
          </UFormField>
          <UFormField label="&nbsp;">
            <UButton
              icon="i-heroicons-play"
              :loading="running"
              :disabled="!selectedSymbol || !selectedTimeframe"
              class="w-full"
              @click="submit"
            >
              Analyse starten
            </UButton>
          </UFormField>
        </div>

        <div v-if="assetFilename" class="text-sm text-gray-500 font-mono">
          {{ assetFilename }}
        </div>
        <div v-if="error" class="text-sm text-red-400">{{ error }}</div>
      </div>

      <!-- Results list -->
      <div
        v-if="exitOptimizationsStatus === 'pending'"
        class="py-8 text-center text-gray-400"
      >
        Lade Ergebnisse...
      </div>
      <div
        v-else-if="!exitOptimizations?.length"
        class="py-8 text-center text-gray-400"
      >
        Keine Exit-Optimierungen vorhanden.
      </div>
      <div v-else class="divide-y divide-gray-800">
        <NuxtLink
          v-for="item in exitOptimizations"
          :key="item.symbol"
          :to="`/exploration/asset/${item.symbol}`"
          class="flex items-center justify-between px-4 py-3 hover:bg-gray-900/50 transition-colors"
        >
          <div class="flex items-center gap-4 min-w-0 flex-1">
            <UBadge variant="subtle" size="xs" color="primary">
              {{ item.exit_strategy }}
            </UBadge>
            <div class="min-w-0">
              <span class="text-white font-mono text-sm">
                {{ item.symbol }}
              </span>
              <p class="text-sm text-gray-400">
                {{ item.timeframe }} &middot; {{ item.bars_analyzed }} Bars
              </p>
            </div>
          </div>
          <div class="flex items-center gap-4 text-sm text-gray-400 shrink-0">
            <span v-if="item.suggested_grid" class="hidden sm:inline">
              TP {{ item.suggested_grid.tp.join(", ") }} &middot;
              SL {{ item.suggested_grid.sl.join(", ") }}
            </span>
            <span>{{ formatDate(item.analyzed_at) }}</span>
            <UIcon name="i-heroicons-chevron-right" class="text-gray-600" />
          </div>
        </NuxtLink>
      </div>
    </UCard>
  </div>
</template>
