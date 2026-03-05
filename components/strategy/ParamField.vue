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

// Choices for select/choice fields
const choiceItems = computed(() =>
  (props.schema.choices ?? []).map((c: string) => ({ label: c, value: c }))
);

// Multi-select for list[int] with choices
const isMultiSelect = computed(() =>
  props.schema.type === "list[int]" && (props.schema.choices?.length ?? 0) > 0
);

const selectedSet = computed(() => new Set((value.value as number[] | null) ?? []));

function toggleOption(strVal: string) {
  const num = parseInt(strVal, 10);
  const current = new Set(selectedSet.value);
  if (current.has(num)) {
    current.delete(num);
  } else {
    current.add(num);
  }
  // Preserve order from choices array
  const ordered = (props.schema.choices ?? [])
    .map((c) => parseInt(c, 10))
    .filter((n) => current.has(n));
  emit("update:modelValue", ordered);
}

function selectAll() {
  const ordered = (props.schema.choices ?? []).map((c) => parseInt(c, 10));
  emit("update:modelValue", ordered);
}

function selectNone() {
  emit("update:modelValue", []);
}

const selectedCount = computed(() => ((value.value as number[]) ?? []).length);

function optionLabel(strVal: string): string {
  return props.schema.choice_labels?.[strVal] ?? strVal;
}
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
        class="w-full"
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

      <!-- List[int] with choices: multi-select popover -->
      <UPopover v-else-if="isMultiSelect">
        <UButton variant="outline" class="w-full justify-between">
          <span v-if="selectedCount > 0" class="text-sm">{{ selectedCount }} ausgewählt</span>
          <span v-else class="text-sm text-gray-500">Keine Auswahl</span>
          <UBadge v-if="selectedCount > 0" :label="String(selectedCount)" color="primary" variant="subtle" class="ml-1" />
        </UButton>
        <template #content>
          <div class="p-3 space-y-1 w-64">
            <div
              v-for="choice in schema.choices"
              :key="choice"
              class="flex items-center gap-2 cursor-pointer hover:bg-gray-800/50 rounded px-2 py-1"
              @click="toggleOption(choice)"
            >
              <span
                class="text-sm flex-1"
                :class="selectedSet.has(parseInt(choice, 10)) ? 'text-white' : 'text-gray-500'"
              >
                {{ optionLabel(choice) }}
              </span>
              <USwitch
                :model-value="selectedSet.has(parseInt(choice, 10))"
                size="sm"
                @click.stop
                @update:model-value="toggleOption(choice)"
              />
            </div>
            <USeparator class="my-2" />
            <div class="flex gap-2">
              <UButton size="xs" variant="ghost" @click="selectAll">All</UButton>
              <UButton size="xs" variant="ghost" @click="selectNone">None</UButton>
            </div>
          </div>
        </template>
      </UPopover>

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
