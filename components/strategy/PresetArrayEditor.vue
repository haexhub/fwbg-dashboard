<script setup lang="ts">
import PresetFormEditor from "./PresetFormEditor.vue";

const props = defineProps<{
  modelValue: Record<string, unknown>[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: Record<string, unknown>[]];
}>();

function itemLabel(item: Record<string, unknown>, index: number): string {
  if (typeof item.name === "string") return item.name;
  if (typeof item.type === "string") return item.type;
  return `[${index}]`;
}

function updateItem(index: number, value: Record<string, unknown>) {
  const arr = [...props.modelValue];
  arr[index] = value;
  emit("update:modelValue", arr);
}

function removeItem(index: number) {
  emit("update:modelValue", props.modelValue.filter((_, i) => i !== index));
}

function addItem() {
  emit("update:modelValue", [...props.modelValue, {}]);
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="(item, index) in modelValue"
      :key="index"
      class="border border-gray-700 rounded-md p-3"
    >
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs font-semibold text-gray-300 font-mono">{{ itemLabel(item, index) }}</span>
        <UButton
          icon="i-heroicons-trash"
          variant="ghost"
          size="2xs"
          color="error"
          @click="removeItem(index)"
        />
      </div>
      <PresetFormEditor
        :model-value="item"
        :depth="1"
        @update:model-value="updateItem(index, $event)"
      />
    </div>
    <UButton
      icon="i-heroicons-plus"
      variant="ghost"
      color="neutral"
      @click="addItem"
    >
      Hinzufügen
    </UButton>
  </div>
</template>
