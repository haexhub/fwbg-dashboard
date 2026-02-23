<script setup lang="ts">
import { makeDroppable } from "@vue-dnd-kit/core";
import {
  PIPELINE_PHASES,
  PHASE_LABELS,
  PHASE_ICONS,
} from "~/types/strategy";
import type { PluginInfo, PipelinePhase } from "~/types/strategy";
import type { DataSourceBase } from "~/types/datasource";

const props = defineProps<{
  plugins: PluginInfo[];
  datasources?: DataSourceBase[];
  currentDatasource?: string;
}>();

const emit = defineEmits<{
  selectPlugin: [plugin: PluginInfo];
  addPlugin: [plugin: PluginInfo];
  removeLanePlugin: [phase: PipelinePhase, instanceId: string];
  selectDatasource: [name: string];
}>();

const paletteRef = ref<HTMLElement | null>(null);

const { isDragOver } = makeDroppable(
  paletteRef,
  {
    groups: ["lane-reorder"],
    events: {
      onDrop: (event) => {
        const dropData = event.payload?.dropData as
          | { source: "lane"; instanceId: string; phase: PipelinePhase }
          | undefined;
        if (dropData?.source === "lane") {
          emit("removeLanePlugin", dropData.phase, dropData.instanceId);
        }
      },
    },
  },
  () => [props.plugins]
);

const searchQuery = ref("");
const selectedPhases = ref<PipelinePhase[]>([]);

const filteredPlugins = computed(() => {
  let list = props.plugins;

  if (selectedPhases.value.length > 0) {
    list = list.filter((p) => selectedPhases.value.includes(p.phase));
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.fqn.toLowerCase().includes(q)
    );
  }

  return list;
});

// Group filtered plugins by phase
const groupedPlugins = computed(() => {
  const groups: { phase: PipelinePhase; plugins: PluginInfo[] }[] = [];
  for (const phase of PIPELINE_PHASES) {
    const phasePlugins = filteredPlugins.value.filter((p) => p.phase === phase);
    if (phasePlugins.length > 0) {
      groups.push({ phase, plugins: phasePlugins });
    }
  }
  return groups;
});

const phaseOptions = PIPELINE_PHASES.map((phase) => ({
  label: PHASE_LABELS[phase],
  value: phase,
}));
</script>

<template>
  <div
    ref="paletteRef"
    class="flex flex-col h-full transition-colors"
    :class="{ 'bg-red-950/30 border-red-500/40': isDragOver }"
  >
    <div class="space-y-2 p-3 border-b border-gray-800">
      <UInput
        v-model="searchQuery"
        icon="i-heroicons-magnifying-glass"
        placeholder="Search plugins..."
        class="w-full"
      />
      <USelectMenu
        v-model="selectedPhases"
        :items="phaseOptions"
        value-key="value"
        multiple
        placeholder="All phases"
        class="w-full"
      />
    </div>

    <div class="flex-1 overflow-y-auto p-2">
      <!-- Datasource section (always shown, not filtered by search) -->
      <div v-if="datasources?.length" class="mb-3">
        <div class="flex items-center gap-1.5 px-1 py-1.5">
          <UIcon name="i-heroicons-circle-stack" class="text-gray-500 text-xs" />
          <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">Datasource</span>
          <span class="text-xs text-gray-600">({{ datasources.length }})</span>
        </div>
        <div class="space-y-0.5">
          <StrategyPaletteDatasourceItem
            v-for="ds in datasources"
            :key="ds.name"
            :datasource="ds"
            :is-selected="currentDatasource === ds.name"
            @select="emit('selectDatasource', ds.name)"
          />
        </div>
      </div>

      <div v-if="!groupedPlugins.length" class="text-center text-gray-500 text-sm py-4">
        No plugins found
      </div>

      <div v-for="group in groupedPlugins" :key="group.phase" class="mb-3">
        <div class="flex items-center gap-1.5 px-1 py-1.5">
          <UIcon :name="PHASE_ICONS[group.phase]" class="text-gray-500 text-xs" />
          <span class="text-xs font-medium text-gray-500 uppercase tracking-wider">
            {{ PHASE_LABELS[group.phase] }}
          </span>
          <span class="text-xs text-gray-600">({{ group.plugins.length }})</span>
        </div>
        <div class="space-y-0.5">
          <StrategyPaletteDragItem
            v-for="plugin in group.plugins"
            :key="plugin.fqn"
            :plugin="plugin"
            @click="emit('selectPlugin', plugin)"
            @add="emit('addPlugin', plugin)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
