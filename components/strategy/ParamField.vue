<script setup lang="ts">
import type { ParamSchema } from "~/types/strategy";

const props = defineProps<{
  name: string;
  schema: ParamSchema;
  modelValue: unknown;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
}>();

const value = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

// For list types, manage as comma-separated string
const listString = computed({
  get: () => {
    if (Array.isArray(value.value)) return value.value.join(", ");
    return "";
  },
  set: (s: string) => {
    const parts = s
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    if (props.schema.type === "list[int]") {
      emit(
        "update:modelValue",
        parts.map((p) => parseInt(p, 10)).filter((n) => !isNaN(n))
      );
    } else if (props.schema.type === "list[float]") {
      emit(
        "update:modelValue",
        parts.map((p) => parseFloat(p)).filter((n) => !isNaN(n))
      );
    } else {
      emit("update:modelValue", parts);
    }
  },
});

// Choices for select fields
const choiceItems = computed(() =>
  (props.schema.choices ?? []).map((c) => ({ label: c, value: c }))
);
</script>

<template>
  <div class="space-y-1">
    <!-- Name -->
    <div class="text-sm font-medium text-gray-200">{{ name }}</div>

    <!-- Description -->
    <p v-if="schema.description" class="text-xs text-gray-500 leading-relaxed">
      {{ schema.description }}
    </p>

    <!-- Input + range hint -->
    <div class="flex items-center gap-2 pt-0.5">
      <!-- Boolean -->
      <USwitch
        v-if="schema.type === 'bool'"
        :model-value="!!value"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <!-- Choice / Select -->
      <USelect
        v-else-if="schema.type === 'choice'"
        :model-value="String(value ?? '')"
        :items="choiceItems"
        value-key="value"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <!-- Integer -->
      <UInput
        v-else-if="schema.type === 'int'"
        type="number"
        :model-value="value as number"
        :min="schema.min"
        :max="schema.max"
        :step="schema.step ?? 1"
        @update:model-value="emit('update:modelValue', parseInt(String($event), 10) || 0)"
      />

      <!-- Float -->
      <UInput
        v-else-if="schema.type === 'float'"
        type="number"
        :model-value="value as number"
        :min="schema.min"
        :max="schema.max"
        :step="schema.step ?? 0.01"
        @update:model-value="emit('update:modelValue', parseFloat(String($event)) || 0)"
      />

      <!-- List types (comma separated input) -->
      <UInput
        v-else-if="schema.type.startsWith('list[')"
        v-model="listString"
        :placeholder="`e.g. ${Array.isArray(schema.default) ? schema.default.join(', ') : ''}`"
      />

      <!-- String (default) -->
      <UInput
        v-else
        :model-value="String(value ?? '')"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <!-- Range hint inline -->
      <span v-if="schema.min != null || schema.max != null" class="text-[11px] text-gray-600 whitespace-nowrap shrink-0">
        {{ schema.min ?? '…' }}–{{ schema.max ?? '…' }}
        <template v-if="schema.step">({{ schema.step }})</template>
      </span>
    </div>
  </div>
</template>
