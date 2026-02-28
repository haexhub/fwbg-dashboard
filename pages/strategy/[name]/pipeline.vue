<script setup lang="ts">
import { DnDProvider } from "@vue-dnd-kit/core";
import type { PluginInfo, PipelinePhase } from "~/types/strategy";

const pluginStore = usePluginStore();
const { plugins } = storeToRefs(pluginStore);
pluginStore.load();
const store = useStrategyConfigStore();
const { config, isRestoring } = storeToRefs(store);

const pipelineRef = computed(() => config.value?._refs?.pipeline);

const pipelineModelValue = computed(() => {
  if (!config.value) return undefined;
  return {
    pipeline: config.value.pipeline,
    exit_strategies: config.value.exit_strategies,
  } as Record<string, unknown>;
});

const {
  lanes,
  selectedPlugin,
  configPanelOpen,
  syncFromConfig,
  _syncingFromConfig,
  toJson,
  addPlugin,
  removePlugin,
  movePlugin,
  updatePluginParams,
  openConfig,
} = useStrategy();

// Sync lanes FROM config on load and on external changes (undo/redo)
watch(
  [
    () => config.value?.pipeline,
    () => config.value?.exit_strategies,
    () => config.value?.risk_management,
    () => config.value?.risk_params,
    plugins,
  ],
  () => {
    if (!config.value || !plugins.value?.length || _syncingFromConfig.value)
      return;
    syncFromConfig(plugins.value);
  },
  { immediate: true, deep: true },
);

// Sync lanes back TO config (write-back direction)
watch(
  lanes,
  () => {
    if (!config.value || _syncingFromConfig.value || isRestoring.value) return;
    try {
      const json = toJson();
      config.value.pipeline = json.pipeline;
      config.value.exit_strategies = json.exit_strategies;
      config.value.risk_management = json.risk_management;
      config.value.risk_params = json.risk_params;
    } catch {
      /* ignore during init */
    }
  },
  { deep: true },
);

function handleAddPlugin(
  phase: PipelinePhase,
  plugin: PluginInfo,
  index?: number,
) {
  addPlugin(phase, plugin, index);
}

function handleRemovePlugin(phase: PipelinePhase, instanceId: string) {
  removePlugin(phase, instanceId);
}

function handleConfigSave(params: Record<string, unknown>) {
  if (!selectedPlugin.value) return;
  updatePluginParams(
    selectedPlugin.value.phase,
    selectedPlugin.value.id,
    params,
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
</script>

<template>
  <div class="flex flex-col h-full p-1">
    <StrategyPresetSelectorBar
      section="pipelines"
      label="Pipeline"
      :current-ref="pipelineRef"
      :model-value="pipelineModelValue"
      @apply="(name, content) => store.applyPreset('pipeline', name, content)"
      @detach="store.detachPreset('pipeline')"
    />

    <!-- Strategy Builder -->
    <ClientOnly>
      <DnDProvider :auto-scroll-viewport="true">
        <div class="flex gap-4 flex-1 min-h-0">
          <!-- Plugin Palette (left sidebar) -->
          <div
            class="w-64 shrink-0 border border-gray-700 rounded-lg bg-gray-900/50 overflow-hidden flex flex-col"
          >
            <StrategyPluginPalette
              :plugins="plugins ?? []"
              @select-plugin="handleSelectPlugin"
              @add-plugin="(plugin) => handleAddPlugin(plugin.phase, plugin, undefined)"
              @remove-lane-plugin="removePlugin"
            />
          </div>

          <!-- Kanban Board -->
          <div class="flex-1 overflow-x-auto min-h-0">
            <StrategyKanbanBoard
              :lanes="lanes"
              :plugins="plugins ?? []"
              @add-plugin="handleAddPlugin"
              @move-plugin="movePlugin"
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

  </div>
</template>
