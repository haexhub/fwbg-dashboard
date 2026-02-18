<script setup lang="ts">
import { PIPELINE_PHASES } from "~/types/strategy";
import type { PluginInfo, PluginInstance, PipelinePhase } from "~/types/strategy";

defineProps<{
  lanes: Record<PipelinePhase, PluginInstance[]>;
  plugins: PluginInfo[];
}>();

const emit = defineEmits<{
  addPlugin: [phase: PipelinePhase, plugin: PluginInfo];
  removePlugin: [phase: PipelinePhase, instanceId: string];
  configurePlugin: [instance: PluginInstance];
}>();
</script>

<template>
  <div class="flex gap-3 overflow-x-auto h-full">
    <StrategyKanbanLane
      v-for="phase in PIPELINE_PHASES"
      :key="phase"
      :phase="phase"
      :items="lanes[phase]"
      :available-count="plugins.filter((p) => p.phase === phase).length"
      @add-plugin="(plugin: PluginInfo) => emit('addPlugin', phase, plugin)"
      @remove-plugin="(id: string) => emit('removePlugin', phase, id)"
      @configure-plugin="(inst: PluginInstance) => emit('configurePlugin', inst)"
    />
  </div>
</template>
