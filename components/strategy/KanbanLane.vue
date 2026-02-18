<script setup lang="ts">
import { makeDroppable } from "@vue-dnd-kit/core";
import { PHASE_LABELS, PHASE_ICONS, PHASE_COLORS } from "~/types/strategy";
import type { PluginInfo, PluginInstance, PipelinePhase } from "~/types/strategy";

const props = defineProps<{
  phase: PipelinePhase;
  items: PluginInstance[];
  availableCount: number;
}>();

const emit = defineEmits<{
  addPlugin: [plugin: PluginInfo];
  removePlugin: [instanceId: string];
  configurePlugin: [instance: PluginInstance];
}>();

const collapsed = ref(false);
const laneRef = ref<HTMLElement | null>(null);

const { isDragOver } = makeDroppable(
  laneRef,
  {
    groups: [props.phase],
    events: {
      onDrop: (event) => {
        const payload = event.payload;
        if (!payload) return;

        const item = payload.items[payload.index];
        const dropData = payload.dropData as { source: string } | undefined;

        if (dropData?.source === "palette" && item) {
          emit("addPlugin", item as PluginInfo);
        }
      },
    },
  },
  () => [props.items, { phase: props.phase }]
);
</script>

<template>
  <!-- Collapsed: narrow vertical strip -->
  <div
    v-if="collapsed"
    class="shrink-0 w-10 rounded-lg border border-gray-700 bg-gray-900/50 flex flex-col items-center cursor-pointer select-none transition-all"
    @click="collapsed = false"
  >
    <div class="py-3">
      <UIcon name="i-heroicons-chevron-right" class="text-gray-400" />
    </div>
    <div class="flex-1 flex items-center">
      <span
        class="text-xs font-medium text-gray-500 whitespace-nowrap"
        style="writing-mode: vertical-lr; transform: rotate(180deg)"
      >
        {{ PHASE_LABELS[phase] }}
      </span>
    </div>
    <div class="py-2">
      <UBadge
        v-if="items.length > 0"
        :color="(PHASE_COLORS[phase] as any)"
        variant="subtle"
        size="xs"
      >
        {{ items.length }}
      </UBadge>
    </div>
  </div>

  <!-- Expanded -->
  <div
    v-else
    ref="laneRef"
    class="shrink-0 w-56 rounded-lg border transition-all flex flex-col"
    :class="{
      'border-blue-500/50 bg-blue-500/5': isDragOver,
      'border-gray-700 bg-gray-900/50': !isDragOver,
    }"
  >
    <!-- Lane Header (fixed) -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
      <div class="flex items-center gap-2">
        <UIcon :name="PHASE_ICONS[phase]" class="text-gray-400" />
        <span class="text-sm font-medium text-white">
          {{ PHASE_LABELS[phase] }}
        </span>
        <UBadge
          :color="items.length > 0 ? (PHASE_COLORS[phase] as any) : 'neutral'"
          variant="subtle"
          size="xs"
        >
          {{ items.length }}
        </UBadge>
      </div>
      <UIcon
        name="i-heroicons-chevron-left"
        class="text-gray-500 text-xs cursor-pointer select-none"
        @click="collapsed = true"
      />
    </div>

    <!-- Lane Content (scrollable) -->
    <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
      <StrategyLanePluginCard
        v-for="instance in items"
        :key="instance.id"
        :instance="instance"
        @configure="emit('configurePlugin', instance)"
        @remove="emit('removePlugin', instance.id)"
      />
      <div
        v-if="!items.length"
        class="text-center text-gray-600 text-xs py-4"
      >
        Drop plugins here
      </div>
    </div>
  </div>
</template>
