<script setup lang="ts">
const { config } = useStrategyConfig();

const r = computed(() => config.value?.resources as Record<string, unknown> | undefined);

function getVal<T>(key: string, fallback: T): T {
  return (r.value?.[key] as T) ?? fallback;
}

function setVal(key: string, value: unknown) {
  if (!config.value) return;
  config.value.resources[key] = value;
}
</script>

<template>
  <div v-if="r" class="overflow-y-auto h-full p-1">
    <div class="space-y-6">
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Ressourcen</h3>
        </template>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="RAM pro Worker (GB)">
            <UInput
              :model-value="getVal('ram_per_worker_gb', 4.0)"
              type="number"
              step="0.5"
              :min="0.5"
              class="w-full"
              @update:model-value="setVal('ram_per_worker_gb', Number($event))"
            />
          </UFormField>
          <UFormField label="Min. Free RAM (%)">
            <UInput
              :model-value="getVal('min_free_ram_percent', 0.15)"
              type="number"
              step="0.05"
              :min="0"
              :max="1"
              class="w-full"
              @update:model-value="setVal('min_free_ram_percent', Number($event))"
            />
          </UFormField>
          <UFormField label="Max. CPU (%)">
            <UInput
              :model-value="getVal('max_cpu_percent', 0.8)"
              type="number"
              step="0.05"
              :min="0"
              :max="1"
              class="w-full"
              @update:model-value="setVal('max_cpu_percent', Number($event))"
            />
          </UFormField>
          <UFormField label="Max. Concurrent Assets">
            <UInput
              :model-value="getVal('max_concurrent_assets', 1)"
              type="number"
              :min="1"
              class="w-full"
              @update:model-value="setVal('max_concurrent_assets', Number($event))"
            />
          </UFormField>
          <UFormField label="XGBoost n_jobs">
            <UInput
              :model-value="getVal('xgboost_n_jobs', 0)"
              type="number"
              class="w-full"
              @update:model-value="setVal('xgboost_n_jobs', Number($event))"
            />
          </UFormField>
        </div>
        <p class="mt-4 text-xs text-gray-500">
          n_jobs = 0 bedeutet alle verfügbaren Kerne. -1 nutzt alle Kerne explizit.
        </p>
      </UCard>
    </div>
  </div>
</template>
