<script setup lang="ts">
import { DnDProvider } from "@vue-dnd-kit/core";
import type { PluginInfo, PipelinePhase } from "~/types/strategy";
import type { DataSourceBase } from "~/types/datasource";

const { plugins } = usePlugins();
const store = useStrategyConfigStore();
const { config, isRestoring } = storeToRefs(store);

// ── Datasource & Assets ──
const { data: datasources } = useFetch<DataSourceBase[]>("/api/datasources", {
  default: () => [],
});

const assetClasses = computed(() => Object.keys(config.value?.grids ?? {}));
const datasourceConfigOpen = ref(false);

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
const pipelineRef = computed(() => config.value?._refs?.pipeline);

const pipelineModelValue = computed(() => {
  if (!config.value) return undefined;
  return {
    pipeline: config.value.pipeline,
    exit_strategy: config.value.exit_strategy,
    exit_params: config.value.exit_params,
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
  closeConfig,
} = useStrategy();

// Sync lanes FROM config on load and on external changes (undo/redo)
watch(
  [
    () => config.value?.pipeline,
    () => config.value?.exit_strategy,
    () => config.value?.exit_params,
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
      config.value.exit_strategy = json.exit_strategy;
      config.value.exit_params = json.exit_params;
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

// Preview panel
const previewPanelOpen = ref(false);

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
    <div class="flex items-center gap-2">
      <StrategyPresetSelectorBar
        section="pipelines"
        label="Pipeline"
        :current-ref="pipelineRef"
        :model-value="pipelineModelValue"
        class="flex-1"
        @apply="(name, content) => store.applyPreset('pipeline', name, content)"
        @detach="store.detachPreset('pipeline')"
      />
      <UButton
        icon="i-lucide-eye"
        variant="ghost"
        size="sm"
        @click="previewPanelOpen = true"
      >
        Vorschau
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
              :datasources="datasources"
              :current-datasource="config?.datasource"
              @select-plugin="handleSelectPlugin"
              @add-plugin="(plugin) => handleAddPlugin(plugin.phase, plugin, undefined)"
              @remove-lane-plugin="removePlugin"
              @select-datasource="(name) => { if (config) config.datasource = name }"
            />
          </div>

          <!-- Kanban Board -->
          <div class="flex-1 overflow-x-auto min-h-0">
            <StrategyKanbanBoard
              :lanes="lanes"
              :plugins="plugins ?? []"
              :datasource="config?.datasource"
              :asset-filter="assetFilter"
              :asset-exclude="assetExclude"
              :asset-classes="assetClasses"
              @add-plugin="handleAddPlugin"
              @move-plugin="movePlugin"
              @remove-plugin="handleRemovePlugin"
              @configure-plugin="openConfig"
              @update:datasource="(v) => { if (config) config.datasource = v }"
              @configure-datasource="datasourceConfigOpen = true"
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

    <!-- Preview Panel -->
    <StrategyPreviewPanel
      v-if="config"
      v-model:open="previewPanelOpen"
      :strategy-name="config.name"
      :datasource="config.datasource"
      :available-assets="assetFilter"
    />

    <!-- Datasource Config Panel -->
    <StrategyDatasourceConfigPanel
      v-if="config?.datasource"
      :open="datasourceConfigOpen"
      :datasource="config.datasource"
      :asset-classes="assetClasses"
      v-model:asset-filter="assetFilter"
      v-model:asset-exclude="assetExclude"
      @update:open="datasourceConfigOpen = $event"
    />
  </div>
</template>
