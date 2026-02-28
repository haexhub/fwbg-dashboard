<script setup lang="ts">
const { config } = storeToRefs(useStrategyConfigStore());

// Tag management
const newTag = ref("");

function addTag() {
  const tag = newTag.value.trim();
  if (!tag || !config.value) return;
  if (!config.value.tags) config.value.tags = [];
  if (!config.value.tags.includes(tag)) {
    config.value.tags.push(tag);
  }
  newTag.value = "";
}

function removeTag(tag: string) {
  if (!config.value?.tags) return;
  config.value.tags = config.value.tags.filter((t) => t !== tag);
}

// Quick stats
const pipelineStats = computed(() => {
  if (!config.value) return null;
  const p = config.value.pipeline;
  return {
    indicators: p.indicators?.length ?? 0,
    preprocessing: p.preprocessing?.length ?? 0,
    featureSelection: p.feature_selection?.length ?? 0,
    dataLoading: p.data_loading?.length ?? 0,
  };
});

const gridCount = computed(() => {
  const ep = config.value?.exit_params ?? {};
  return Object.values(ep).reduce<number>((sum, v) => sum + (Array.isArray(v) ? v.length : 1), 0);
});
</script>

<template>
  <div v-if="config" class="overflow-y-auto h-full p-1">
    <div class="space-y-6">
      <!-- Metadata -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Metadata</h3>
        </template>
        <div class="space-y-4">
          <UFormField label="Name">
            <UInput v-model="config.name" class="w-full" />
          </UFormField>
          <UFormField label="Beschreibung">
            <UTextarea v-model="config.description" :rows="2" class="w-full" />
          </UFormField>
          <UFormField label="Tags">
            <div class="flex flex-wrap gap-2 mb-2">
              <UBadge
                v-for="tag in config.tags"
                :key="tag"
                variant="subtle"
                size="md"
                class="cursor-pointer"
                @click="removeTag(tag)"
              >
                {{ tag }}
                <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <span v-if="!config.tags?.length" class="text-sm text-gray-500">Keine Tags</span>
            </div>
            <div class="flex gap-2">
              <UInput
                v-model="newTag"
                placeholder="Neuer Tag..."
                                class="w-48"
                @keydown.enter="addTag"
              />
              <UButton variant="soft" :disabled="!newTag.trim()" @click="addTag">
                Hinzufügen
              </UButton>
            </div>
          </UFormField>
          <UFormField label="Hypothese">
            <UTextarea v-model="config.hypothesis" :rows="3" class="w-full" />
          </UFormField>
          <UFormField label="Erwartetes Ergebnis">
            <UTextarea v-model="config.expected_outcome" :rows="2" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <!-- Quick Stats -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-white">
              {{ pipelineStats?.indicators ?? 0 }}
            </p>
            <p class="text-xs text-gray-400">Indikatoren</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-white">
              {{ pipelineStats?.preprocessing ?? 0 }}
            </p>
            <p class="text-xs text-gray-400">Preprocessing</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-white">
              {{ config.exit_strategy || '-' }}
            </p>
            <p class="text-xs text-gray-400">Exit-Strategie</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-white">
              {{ config.model?.type ?? '-' }}
            </p>
            <p class="text-xs text-gray-400">Model</p>
          </div>
        </UCard>
        <UCard>
          <div class="text-center">
            <p class="text-2xl font-bold text-white">{{ gridCount }}</p>
            <p class="text-xs text-gray-400">Grid-Klassen</p>
          </div>
        </UCard>
      </div>

    </div>
  </div>
</template>
