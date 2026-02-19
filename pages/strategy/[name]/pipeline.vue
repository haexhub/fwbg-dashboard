<script setup lang="ts">
import { DnDProvider } from "@vue-dnd-kit/core";
import type { PluginInfo, PipelinePhase } from "~/types/strategy";

const { plugins } = usePlugins();
const { config } = useStrategyConfig();

const {
  lanes,
  isDirty: kanbanDirty,
  canUndo,
  selectedPlugin,
  configPanelOpen,
  loadFromJson,
  toJson,
  addPlugin,
  removePlugin,
  movePlugin,
  updatePluginParams,
  openConfig,
  closeConfig,
  undo,
  resetToSaved: resetKanban,
} = useStrategy();

// Load kanban from shared config when plugins are available
watch(
  [() => config.value, plugins] as const,
  ([cfg, pluginList]) => {
    if (cfg && pluginList?.length) {
      loadFromJson(cfg, pluginList);
    }
  },
  { immediate: true }
);

// Auto-sync kanban changes back to shared config
watch(
  [lanes, kanbanDirty] as const,
  () => {
    if (!config.value || !kanbanDirty.value) return;
    try {
      const json = toJson();
      config.value.pipeline = json.pipeline;
      config.value.exit_strategy = json.exit_strategy;
      config.value.exit_params = json.exit_params;
    } catch {
      // toJson() throws if no strategy loaded — ignore during init
    }
  },
  { deep: true }
);

function handleAddPlugin(phase: PipelinePhase, plugin: PluginInfo, index?: number) {
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
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Kanban toolbar -->
    <div class="flex items-center gap-2 pb-3 shrink-0">
      <UButton
        v-if="canUndo"
        icon="i-heroicons-arrow-uturn-left"
        variant="ghost"
        size="sm"
        @click="undo"
      >
        Undo
      </UButton>
      <UButton
        v-if="kanbanDirty"
        icon="i-heroicons-x-mark"
        variant="ghost"
        size="sm"
        color="warning"
        @click="resetKanban"
      >
        Reset Pipeline
      </UButton>
    </div>

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
