<script setup lang="ts">
const store = useStrategyConfigStore();
const { config } = storeToRefs(store);
const resourcesRef = computed(() => config.value?._refs?.resources);

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
      <StrategyPresetSelectorBar
        section="resources"
        label="Ressourcen"
        :current-ref="resourcesRef"
        :model-value="r"
        @apply="(name, content) => store.applyPreset('resources', name, content)"
        @detach="store.detachPreset('resources')"
      />
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Ressourcen</h3>
        </template>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Max. Concurrent Assets">
            <UInput
              :model-value="getVal('max_concurrent_assets', 1)"
              type="number"
              :min="1"
              class="w-full"
              @update:model-value="setVal('max_concurrent_assets', Number($event))"
            />
          </UFormField>
        </div>
        <p class="mt-4 text-xs text-gray-500">
          Anzahl der Assets, die gleichzeitig optimiert werden. Jedes Model-Plugin verwaltet seine Thread-Nutzung selbst.
        </p>
      </UCard>
    </div>
  </div>
</template>
