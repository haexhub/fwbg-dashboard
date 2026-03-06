<script setup lang="ts">
import type { ChartSource } from "~/types/chart";
import { TIMEFRAME_LABELS } from "~/types/chart";
import type { DataSourceBase } from "~/types/datasource";

const store = useStrategyConfigStore();
const { config } = storeToRefs(store);

// ── Datasource & Asset selection ──
const { data: datasources } = useFetch<DataSourceBase[]>("/api/datasources", {
  default: () => [],
});
const { data: chartSources } = useFetch<ChartSource[]>("/api/chart/sources", {
  default: () => [],
});

const datasourceItems = computed(() =>
  datasources.value.map((ds: DataSourceBase) => ({ label: ds.name, value: ds.name })),
);

const availableTimeframes = computed(() => {
  const ds = config.value?.datasource;
  if (!ds) return [];
  const src = chartSources.value.find((s: ChartSource) => s.name === ds);
  if (!src) return [];
  const tfs = new Set<string>();
  for (const sym of src.symbols) {
    for (const tf of sym.timeframes) tfs.add(tf);
  }
  const order = Object.keys(TIMEFRAME_LABELS);
  return [...tfs].sort((a, b) => order.indexOf(a) - order.indexOf(b));
});

const timeframeItems = computed(() =>
  availableTimeframes.value.map((tf: string) => ({
    label: TIMEFRAME_LABELS[tf] ?? tf,
    value: tf,
  })),
);

const availableSymbols = computed(() => {
  const ds = config.value?.datasource;
  if (!ds) return [];
  const src = chartSources.value.find((s: ChartSource) => s.name === ds);
  return src?.symbols ?? [];
});

const symbolItems = computed(() =>
  availableSymbols.value.map((s: { symbol: string }) => ({ label: s.symbol, value: s.symbol })),
);

const assetFilter = computed({
  get: () => config.value?.assets?.filter ?? [],
  set: (val: string[]) => {
    if (!config.value) return;
    if (!config.value.assets) config.value.assets = {};
    config.value.assets.filter = val.length > 0 ? val : undefined;
  },
});

const assetExclude = computed({
  get: () => config.value?.assets?.exclude ?? [],
  set: (val: string[]) => {
    if (!config.value) return;
    if (!config.value.assets) config.value.assets = {};
    config.value.assets.exclude = val.length > 0 ? val : undefined;
  },
});

const dropFlatBars = computed({
  get: () => config.value?.assets?.drop_flat_bars ?? false,
  set: (val: boolean) => {
    if (!config.value) return;
    if (!config.value.assets) config.value.assets = {};
    config.value.assets.drop_flat_bars = val || undefined;
  },
});
</script>

<template>
  <div v-if="config" class="overflow-y-auto h-full p-1">
    <div class="space-y-6">

      <!-- Datasource & Assets -->
      <UCard>
        <template #header>
          <div class="space-y-1">
            <h3 class="text-lg font-medium text-white">Datasource & Assets</h3>
            <p class="text-xs text-gray-500">Datenquelle auswählen und Assets filtern.</p>
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UFormField label="Datasource">
            <USelect
              :model-value="config.datasource ?? ''"
              :items="datasourceItems"
              value-key="value"
              placeholder="Datasource auswählen..."
              class="w-full"
              @update:model-value="(v) => { if (config) config.datasource = v || undefined }"
            />
          </UFormField>

          <UFormField v-if="timeframeItems.length > 0" label="Timeframe">
            <USelect
              :model-value="config.timeframe ?? ''"
              :items="timeframeItems"
              value-key="value"
              placeholder="Default (HOUR)"
              class="w-full"
              @update:model-value="(v) => { if (config) config.timeframe = v || undefined }"
            />
          </UFormField>

          <template v-if="availableSymbols.length > 0">
            <UFormField label="Asset-Filter (nur diese handeln)">
              <USelectMenu
                v-model="assetFilter"
                :items="symbolItems"
                value-key="value"
                multiple
                placeholder="Alle Assets"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Ausgeschlossene Assets">
              <USelectMenu
                v-model="assetExclude"
                :items="symbolItems"
                value-key="value"
                multiple
                placeholder="Keine"
                class="w-full"
              />
            </UFormField>
          </template>
          <p v-else-if="config.datasource" class="text-xs text-gray-500 md:col-span-2 self-center">
            Keine Symbole für diese Datasource verfügbar.
          </p>
        </div>

        <!-- Data options -->
        <div class="mt-4 pt-4 border-t border-gray-800/50">
          <label class="flex items-center gap-2 cursor-pointer">
            <UCheckbox v-model="dropFlatBars" />
            <span class="text-sm text-gray-300">Flat Bars entfernen</span>
          </label>
          <p class="text-xs text-gray-500 mt-1 ml-6">
            Bars ohne Kursbewegung (O=H=L=C, z.B. Wochenenden/Feiertage) vor der Berechnung filtern.
            Verhindert Verzerrung bei SMA/EMA und anderen Rolling-Indikatoren.
          </p>
        </div>
      </UCard>

    </div>
  </div>
</template>
