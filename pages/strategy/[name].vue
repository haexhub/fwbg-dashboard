<script setup lang="ts">
import { DnDProvider } from "@vue-dnd-kit/core";
import type { PluginInfo, StrategyConfig, PipelinePhase } from "~/types/strategy";

definePageMeta({ layout: "builder" });

const route = useRoute();
const strategyName = computed(() => route.params.name as string);

const { plugins } = usePlugins();

// Load strategy via useFetch — await ensures SSR waits for data + stores in payload
const { data: strategyConfig, status } = await useFetch<StrategyConfig>(
  `/api/strategy/strategies/${strategyName.value}`
);

const loading = computed(() => status.value === "pending");

const {
  strategy,
  lanes,
  isDirty,
  selectedPlugin,
  configPanelOpen,
  loadFromJson,
  toJson,
  addPlugin,
  removePlugin,
  updatePluginParams,
  openConfig,
  closeConfig,
  updateMetadata,
} = useStrategy();

// Populate kanban when both strategy config and plugins are available
watch(
  [strategyConfig, plugins] as const,
  ([config, pluginList]) => {
    if (config && pluginList?.length) {
      loadFromJson(config, pluginList);
    }
  },
  { immediate: true }
);

const saving = ref(false);

async function handleSave() {
  saving.value = true;
  try {
    const json = toJson();
    await $fetch(`/api/strategy/strategies/${strategyName.value}`, {
      method: "PUT",
      body: json,
    });
    strategyConfig.value = json;
  } finally {
    saving.value = false;
  }
}

function handleAddPlugin(phase: PipelinePhase, plugin: PluginInfo) {
  addPlugin(phase, plugin);
}

function handleRemovePlugin(phase: PipelinePhase, instanceId: string) {
  removePlugin(phase, instanceId);
}

function handleConfigSave(params: Record<string, unknown>) {
  if (!selectedPlugin.value) return;
  updatePluginParams(
    selectedPlugin.value.phase,
    selectedPlugin.value.id,
    params
  );
}

// Find the PluginInfo for the selected instance
const selectedPluginInfo = computed(() => {
  if (!selectedPlugin.value) return undefined;
  return plugins.value?.find((p) => p.fqn === selectedPlugin.value!.fqn);
});

// Plugin detail panel (palette click)
const detailPlugin = ref<PluginInfo | null>(null);
const detailPanelOpen = ref(false);

function handleSelectPlugin(plugin: PluginInfo) {
  detailPlugin.value = plugin;
  detailPanelOpen.value = true;
}

// Run modal
const runModalOpen = ref(false);

function handleRunStarted(jobId: string) {
  navigateTo(`/runs`);
}
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Strategy Header Bar -->
    <div class="flex items-center justify-between pb-4 shrink-0">
      <div class="flex items-center gap-4">
        <NuxtLink to="/strategy">
          <UButton icon="i-heroicons-arrow-left" variant="ghost" size="sm" />
        </NuxtLink>
        <h2 class="text-xl font-semibold text-white">
          {{ strategyConfig?.name ?? strategyName }}
        </h2>
        <UBadge v-if="isDirty" color="warning" variant="subtle" size="xs">
          unsaved
        </UBadge>
      </div>
      <div class="flex gap-3">
        <UButton
          icon="i-heroicons-check"
          :loading="saving"
          :disabled="loading || !strategyConfig"
          @click="handleSave"
        >
          Save
        </UButton>
        <UButton
          icon="i-heroicons-play"
          color="success"
          variant="soft"
          :disabled="loading || !strategyConfig"
          @click="runModalOpen = true"
        >
          Run
        </UButton>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex-1 flex items-center justify-center text-gray-400">
      Loading strategy...
    </div>

    <!-- Not found -->
    <div
      v-else-if="!strategyConfig"
      class="flex-1 flex items-center justify-center text-gray-400"
    >
      Strategy "{{ strategyName }}" not found.
    </div>

    <!-- Strategy Builder: fills remaining viewport -->
    <template v-else>
      <ClientOnly>
        <DnDProvider :auto-scroll-viewport="true">
          <div class="flex gap-4 flex-1 min-h-0">
            <!-- Plugin Palette (left sidebar, scrollable) -->
            <div
              class="w-64 shrink-0 border border-gray-700 rounded-lg bg-gray-900/50 overflow-hidden flex flex-col"
            >
              <StrategyPluginPalette
                :plugins="plugins ?? []"
                @select-plugin="handleSelectPlugin"
              />
            </div>

            <!-- Kanban Board (main area, fills remaining space) -->
            <div class="flex-1 overflow-x-auto min-h-0">
              <StrategyKanbanBoard
                :lanes="lanes"
                :plugins="plugins ?? []"
                @add-plugin="handleAddPlugin"
                @remove-plugin="handleRemovePlugin"
                @configure-plugin="openConfig"
              />
            </div>
          </div>
        </DnDProvider>
      </ClientOnly>

      <!-- Plugin Detail Panel (palette click) -->
      <StrategyPluginDetailPanel
        :plugin="detailPlugin"
        :open="detailPanelOpen"
        @update:open="detailPanelOpen = $event"
      />

      <!-- Plugin Config Panel (configured instance edit) -->
      <StrategyPluginConfigPanel
        :instance="selectedPlugin"
        :plugin-info="selectedPluginInfo"
        :open="configPanelOpen"
        @update:open="configPanelOpen = $event"
        @save="handleConfigSave"
      />

      <!-- Run Start Modal -->
      <RunsRunStartModal
        :open="runModalOpen"
        :strategy-name="strategyName"
        @update:open="runModalOpen = $event"
        @started="handleRunStarted"
      />
    </template>
  </div>
</template>
