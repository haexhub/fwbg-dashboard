<script setup lang="ts">
import { makeDroppable } from "@vue-dnd-kit/core";
import type { DataSourceBase } from "~/types/datasource";

defineProps<{
  assetFilter: string[];
  assetExclude: string[];
}>();

const emit = defineEmits<{
  configure: [];
}>();

const datasource = defineModel<string | undefined>("datasource");

const collapsed = ref(false);
const laneRef = ref<HTMLElement | null>(null);

const { isDragOver } = makeDroppable(
  laneRef,
  {
    groups: ["datasource"],
    events: {
      onDrop: (event) => {
        const ds = event.draggedItems[0]?.item as DataSourceBase | undefined;
        if (ds) datasource.value = ds.name;
      },
    },
  },
  (() => [datasource.value]) as any,
);
</script>

<template>
  <!-- Collapsed: narrow vertical strip -->
  <div
    v-if="collapsed"
    class="shrink-0 w-10 rounded-lg border border-gray-700 bg-gray-900/50 flex flex-col items-center cursor-pointer select-none"
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
        Datasource
      </span>
    </div>
    <div class="py-2">
      <UBadge v-if="datasource" color="info" variant="subtle" size="xs">1</UBadge>
    </div>
  </div>

  <!-- Expanded -->
  <div
    v-else
    ref="laneRef"
    class="shrink-0 w-56 rounded-lg border flex flex-col transition-all"
    :class="{
      'border-blue-500/50 bg-blue-500/5': isDragOver,
      'border-gray-700 bg-gray-900/50': !isDragOver,
    }"
  >
    <!-- Header (identical to KanbanLane) -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-gray-800 shrink-0">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-circle-stack" class="text-gray-400" />
        <span class="text-sm font-medium text-white">Datasource</span>
        <UBadge :color="datasource ? 'info' : 'neutral'" variant="subtle" size="xs">
          {{ datasource ? 1 : 0 }}
        </UBadge>
      </div>
      <UIcon
        name="i-heroicons-chevron-left"
        class="text-gray-500 text-xs cursor-pointer select-none"
        @click="collapsed = true"
      />
    </div>

    <!-- Lane content -->
    <div class="flex-1 overflow-y-auto p-2 flex flex-col gap-2">
      <!-- Selected datasource card -->
      <div
        v-if="datasource"
        class="group px-2.5 py-2 rounded border border-gray-700 bg-gray-800 transition-all hover:border-gray-600 cursor-pointer"
        @click="emit('configure')"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 min-w-0">
            <UIcon name="i-heroicons-circle-stack" class="text-blue-400 shrink-0 text-xs" />
            <span class="text-sm text-white truncate">{{ datasource }}</span>
          </div>
          <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <UButton
              icon="i-heroicons-cog-6-tooth"
              variant="ghost"
              @click.stop="emit('configure')"
            />
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="error"
              @click.stop="datasource = undefined"
            />
          </div>
        </div>
        <p v-if="assetFilter.length || assetExclude.length" class="text-xs text-gray-500 truncate mt-0.5">
          <template v-if="assetFilter.length">Filter: {{ assetFilter.join(', ') }}</template>
          <template v-if="assetFilter.length && assetExclude.length"> · </template>
          <template v-if="assetExclude.length">Exkl.: {{ assetExclude.join(', ') }}</template>
        </p>
      </div>

      <!-- Empty / drag-target state -->
      <div v-else class="text-center text-gray-600 text-xs py-4">
        {{ isDragOver ? 'Loslassen zum Auswählen' : 'Datasource aus Palette ziehen' }}
      </div>
    </div>
  </div>
</template>
