<script setup lang="ts">
import { makeDraggable } from "@vue-dnd-kit/core";
import type { DataSourceBase } from "~/types/datasource";

const props = defineProps<{
  datasource: DataSourceBase;
  isSelected: boolean;
}>();

const emit = defineEmits<{
  select: [];
}>();

const itemRef = ref<HTMLElement | null>(null);

const { isDragging } = makeDraggable(
  itemRef,
  {
    groups: ["datasource"],
    data: () => ({ source: "palette-datasource" as const }),
  },
  () => [0, [props.datasource]],
);
</script>

<template>
  <div
    ref="itemRef"
    class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all text-sm cursor-grab"
    :class="{
      'opacity-40': isDragging,
      'border-blue-500/50 bg-blue-500/10 text-blue-300': isSelected && !isDragging,
      'border-gray-700/50 bg-gray-800/30 text-gray-300 hover:border-gray-600 hover:bg-gray-800/60 hover:text-white': !isSelected && !isDragging,
    }"
    @click="emit('select')"
  >
    <UIcon
      name="i-heroicons-circle-stack"
      class="text-xs shrink-0"
      :class="isSelected ? 'text-blue-400' : 'text-gray-500'"
    />
    <span class="truncate flex-1">{{ datasource.name }}</span>
    <UIcon v-if="isSelected" name="i-heroicons-check" class="text-blue-400 text-xs shrink-0" />
  </div>
</template>
