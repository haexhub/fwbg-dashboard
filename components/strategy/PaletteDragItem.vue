<script setup lang="ts">
import { makeDraggable } from "@vue-dnd-kit/core";
import type { PluginInfo } from "~/types/strategy";

const props = defineProps<{
  plugin: PluginInfo;
}>();

const emit = defineEmits<{
  add: [];
}>();

const itemRef = ref<HTMLElement | null>(null);

const { isDragging } = makeDraggable(
  itemRef,
  {
    groups: [props.plugin.phase],
    data: () => ({ source: "palette" as const }),
  },
  () => [0, [props.plugin]]
);
</script>

<template>
  <div
    ref="itemRef"
    class="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-gray-700/50 bg-gray-800/30 cursor-grab transition-all text-sm text-gray-300"
    :class="{
      'opacity-40': isDragging,
      'hover:border-gray-600 hover:bg-gray-800/60 hover:text-white': !isDragging,
    }"
  >
    <span class="truncate flex-1">{{ plugin.name }}</span>
    <span
      v-if="plugin.signal_columns?.length"
      class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0"
    >
      SIG
    </span>
    <UButton
      icon="i-heroicons-plus"
      variant="ghost"
      class="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
      @click.stop="emit('add')"
    />
  </div>
</template>
