<script setup lang="ts">
import type { PluginInstance } from "~/types/strategy";

const props = defineProps<{
  instance: PluginInstance;
}>();

const emit = defineEmits<{
  configure: [];
  remove: [];
}>();

// Show first 3 non-default params as preview
const paramPreview = computed(() => {
  const entries = Object.entries(props.instance.params);
  if (entries.length === 0) return "";
  return entries
    .slice(0, 3)
    .map(([k, v]) => {
      const val =
        Array.isArray(v) ? `[${v.length}]` : String(v);
      return `${k}=${val}`;
    })
    .join(", ");
});
</script>

<template>
  <div
    class="group px-2.5 py-2 rounded border border-gray-700 bg-gray-800 hover:border-gray-600 transition-colors"
  >
    <div class="flex items-center justify-between">
      <span
        class="text-sm text-white truncate cursor-pointer"
        @click="emit('configure')"
      >
        {{ instance.name }}
      </span>
      <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <UButton
          icon="i-heroicons-cog-6-tooth"
          variant="ghost"
          size="xs"
          class="!p-0.5"
          @click="emit('configure')"
        />
        <UButton
          icon="i-heroicons-x-mark"
          variant="ghost"
          color="error"
          size="xs"
          class="!p-0.5"
          @click="emit('remove')"
        />
      </div>
    </div>
    <p v-if="paramPreview" class="text-xs text-gray-500 truncate mt-0.5">
      {{ paramPreview }}
    </p>
  </div>
</template>
