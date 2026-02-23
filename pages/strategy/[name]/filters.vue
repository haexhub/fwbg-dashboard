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
    </div>
  </div>
</template>
