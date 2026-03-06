<script setup lang="ts">
import type { SignalCondition, SignalRuleSet } from "~/types/strategy";

const props = defineProps<{
  modelValue: SignalRuleSet;
  label: string;
  columnItems: { label: string; items: { label: string; value: string }[] }[];
  signalColumnItems: { label: string; items: { label: string; value: string }[] }[];
  depth?: number;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SignalRuleSet];
}>();

const rules = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const currentDepth = computed(() => props.depth ?? 0);

function toggleOperator() {
  emit("update:modelValue", {
    ...rules.value,
    operator: rules.value.operator === "AND" ? "OR" : "AND",
  });
}

function updateCondition(index: number, cond: SignalCondition) {
  const updated = [...rules.value.conditions];
  updated[index] = cond;
  emit("update:modelValue", { ...rules.value, conditions: updated });
}

function removeCondition(index: number) {
  const updated = rules.value.conditions.filter((_, i) => i !== index);
  emit("update:modelValue", { ...rules.value, conditions: updated });
}

function addCondition() {
  const newCond: SignalCondition = { type: "signal_active", column: "" };
  emit("update:modelValue", {
    ...rules.value,
    conditions: [...rules.value.conditions, newCond],
  });
}

function addGroup() {
  const newGroup: SignalCondition = {
    type: "group",
    operator: "OR",
    conditions: [{ type: "signal_active", column: "" }],
  };
  emit("update:modelValue", {
    ...rules.value,
    conditions: [...rules.value.conditions, newGroup],
  });
}

function updateNestedGroup(index: number, nested: SignalRuleSet) {
  const updated = [...rules.value.conditions];
  updated[index] = { type: "group", ...nested };
  emit("update:modelValue", { ...rules.value, conditions: updated });
}

function removeGroup(index: number) {
  removeCondition(index);
}
</script>

<template>
  <div
    class="rounded-lg border p-3 space-y-2"
    :class="currentDepth === 0 ? 'border-gray-700 bg-gray-900/50' : 'border-gray-700/50 bg-gray-800/30'"
  >
    <!-- Header: label + AND/OR toggle -->
    <div class="flex items-center gap-2">
      <span v-if="currentDepth === 0" class="text-sm font-medium text-gray-300">{{ label }}</span>
      <UButton
        size="xs"
        :variant="rules.operator === 'AND' ? 'solid' : 'outline'"
        @click="toggleOperator"
      >
        {{ rules.operator === "AND" ? "ALLE (AND)" : "EINE (OR)" }}
      </UButton>
    </div>

    <!-- Conditions -->
    <div class="space-y-2 pl-2">
      <template v-for="(cond, i) in rules.conditions" :key="i">
        <!-- Nested group -->
        <template v-if="cond.type === 'group'">
          <div class="relative">
            <StrategySignalRuleGroup
              :model-value="{ operator: cond.operator ?? 'AND', conditions: cond.conditions ?? [] }"
              label=""
              :column-items="columnItems"
              :signal-column-items="signalColumnItems"
              :depth="currentDepth + 1"
              @update:model-value="updateNestedGroup(i, $event)"
            />
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="error"
              size="xs"
              class="absolute top-2 right-2"
              @click="removeGroup(i)"
            />
          </div>
        </template>

        <!-- Regular condition -->
        <template v-else>
          <div class="flex items-center gap-1">
            <span
              v-if="i > 0"
              class="text-xs text-gray-500 w-10 text-center shrink-0"
            >
              {{ rules.operator }}
            </span>
            <span v-else class="w-10 shrink-0" />
            <StrategySignalCondition
              :model-value="cond"
              :column-items="columnItems"
              :signal-column-items="signalColumnItems"
              @update:model-value="updateCondition(i, $event)"
              @remove="removeCondition(i)"
            />
          </div>
        </template>
      </template>
    </div>

    <!-- Add buttons -->
    <div class="flex gap-2 pl-12">
      <UButton variant="soft" size="xs" icon="i-heroicons-plus" @click="addCondition">
        Bedingung
      </UButton>
      <UButton
        v-if="currentDepth < 2"
        variant="soft"
        size="xs"
        icon="i-heroicons-folder-plus"
        @click="addGroup"
      >
        Gruppe
      </UButton>
    </div>
  </div>
</template>
