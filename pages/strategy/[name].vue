<script setup lang="ts">
definePageMeta({ layout: "builder" });

const route = useRoute();
const strategyName = computed(() => route.params.name as string);

const { config, isDirty, load, save, resetToSaved } = useStrategyConfig();

// Load strategy — blocks SSR so children have data
await load(strategyName.value);

const saving = ref(false);

async function handleSave() {
  saving.value = true;
  try {
    await save();
  } finally {
    saving.value = false;
  }
}

// Run modal
const runModalOpen = ref(false);

function handleRunStarted(_jobId: string) {
  navigateTo("/runs");
}

// Tab navigation
const tabs = [
  { label: "Übersicht", to: `/strategy/${strategyName.value}` },
  { label: "Pipeline", to: `/strategy/${strategyName.value}/pipeline` },
  { label: "Model", to: `/strategy/${strategyName.value}/model` },
  { label: "Grids", to: `/strategy/${strategyName.value}/grids` },
  { label: "Validation", to: `/strategy/${strategyName.value}/validation` },
  { label: "Filters", to: `/strategy/${strategyName.value}/filters` },
  { label: "Resources", to: `/strategy/${strategyName.value}/resources` },
];
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header Bar -->
    <div class="flex items-center justify-between pb-3 shrink-0">
      <div class="flex items-center gap-4">
        <NuxtLink to="/strategy">
          <UButton icon="i-heroicons-arrow-left" variant="ghost" size="sm" />
        </NuxtLink>
        <h2 class="text-xl font-semibold text-white">
          {{ config?.name ?? strategyName }}
        </h2>
        <UBadge v-if="isDirty" color="warning" variant="subtle" size="xs">
          unsaved
        </UBadge>
      </div>
      <div class="flex gap-3">
        <UButton
          v-if="isDirty"
          icon="i-heroicons-x-mark"
          variant="ghost"
          size="sm"
          color="warning"
          @click="resetToSaved"
        >
          Reset
        </UButton>
        <UButton
          icon="i-heroicons-check"
          :loading="saving"
          :disabled="!isDirty || saving"
          @click="handleSave"
        >
          Save
        </UButton>
        <UButton
          icon="i-heroicons-play"
          color="success"
          variant="soft"
          :disabled="!config"
          @click="runModalOpen = true"
        >
          Run
        </UButton>
      </div>
    </div>

    <!-- Tab Navigation -->
    <nav class="flex border-b border-gray-800 pb-2 mb-0 shrink-0">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        :class="[
          'flex-1 text-center py-1.5 text-sm rounded-md transition-colors whitespace-nowrap',
          route.path === tab.to
            ? 'bg-gray-700 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-800',
        ]"
      >
        {{ tab.label }}
      </NuxtLink>
    </nav>

    <!-- Loading state -->
    <div v-if="!config" class="flex-1 flex items-center justify-center text-gray-400">
      Loading strategy...
    </div>

    <!-- Child pages -->
    <div v-else class="flex-1 min-h-0">
      <NuxtPage />
    </div>

    <!-- Run Start Modal -->
    <RunsRunStartModal
      :open="runModalOpen"
      :strategy-name="strategyName"
      @update:open="runModalOpen = $event"
      @started="handleRunStarted"
    />
  </div>
</template>
