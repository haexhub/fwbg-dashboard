<script setup lang="ts">
import { PIPELINE_PHASES } from "~/types/strategy";
import type { PluginInfo, PluginInstance, PipelinePhase } from "~/types/strategy";

defineProps<{
  lanes: Record<PipelinePhase, PluginInstance[]>;
  plugins: PluginInfo[];
  datasource?: string;
  assetFilter: string[];
  assetExclude: string[];
  assetClasses: string[];
}>();

const emit = defineEmits<{
  addPlugin: [phase: PipelinePhase, plugin: PluginInfo, index: number | undefined];
  movePlugin: [phase: PipelinePhase, instanceId: string, targetIndex: number];
  removePlugin: [phase: PipelinePhase, instanceId: string];
  configurePlugin: [instance: PluginInstance];
  "update:datasource": [value: string | undefined];
  configureDatasource: [];
}>();
</script>

<template>
  <div class="flex gap-3 overflow-x-auto h-full">
    <StrategyDatasourceLane
      :datasource="datasource"
      :asset-filter="assetFilter"
      :asset-exclude="assetExclude"
      @update:datasource="emit('update:datasource', $event)"
      @configure="emit('configureDatasource')"
    />
    <StrategyKanbanLane
      v-for="phase in PIPELINE_PHASES"
      :key="phase"
      :phase="phase"
      :items="lanes[phase]"
      :available-count="plugins.filter((p) => p.phase === phase).length"
      @add-plugin="(plugin: PluginInfo, index: number | undefined) => emit('addPlugin', phase, plugin, index)"
      @move-plugin="(id: string, idx: number) => emit('movePlugin', phase, id, idx)"
      @remove-plugin="(id: string) => emit('removePlugin', phase, id)"
      @configure-plugin="(inst: PluginInstance) => emit('configurePlugin', inst)"
    />
  </div>
</template>
