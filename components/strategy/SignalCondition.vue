<script setup lang="ts">
import type { SignalCondition } from "~/types/strategy";

interface ColumnGroupItem {
  label: string;
  items: { label: string; value: string }[];
}

const props = defineProps<{
  modelValue: SignalCondition;
  columnItems: ColumnGroupItem[];
  signalColumnItems: ColumnGroupItem[];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: SignalCondition];
  remove: [];
}>();

const condition = computed({
  get: () => props.modelValue,
  set: (v) => emit("update:modelValue", v),
});

const conditionTypes = [
  { label: "Signal aktiv", value: "signal_active" },
  { label: "Wert-Check", value: "value_check" },
  { label: "Spalten-Vergleich", value: "col_compare" },
  { label: "Crossing", value: "crossing" },
];

const operators = [
  { label: "==", value: "==" },
  { label: "!=", value: "!=" },
  { label: "<", value: "<" },
  { label: "<=", value: "<=" },
  { label: ">", value: ">" },
  { label: ">=", value: ">=" },
];

const crossDirections = [
  { label: "kreuzt \u00fcber", value: "above" },
  { label: "kreuzt unter", value: "below" },
];

/** Convert { label, items }[] grouped format to USelectMenu's T[][] format */
function toSelectMenuGroups(groups: ColumnGroupItem[]) {
  return groups.map((g) => [
    { label: g.label, type: "label" as const, disabled: true },
    ...g.items,
  ]);
}

const columnMenuItems = computed(() => toSelectMenuGroups(props.columnItems));
const signalMenuItems = computed(() => toSelectMenuGroups(props.signalColumnItems));

function updateField(field: string, value: unknown) {
  emit("update:modelValue", { ...condition.value, [field]: value });
}

function changeType(type: string) {
  const base: SignalCondition = { type: type as SignalCondition["type"] };
  if (type === "signal_active") base.column = "";
  if (type === "value_check") {
    base.column = "";
    base.op = "==";
    base.value = 1;
  }
  if (type === "col_compare") {
    base.column_a = "";
    base.op = ">";
    base.column_b = "";
  }
  if (type === "crossing") {
    base.column_a = "";
    base.direction = "above";
    base.column_b = "";
  }
  emit("update:modelValue", base);
}
</script>

<template>
  <div class="flex items-center gap-2 flex-wrap">
    <!-- Condition Type -->
    <USelect
      :model-value="condition.type"
      :items="conditionTypes"
      value-key="value"
      class="w-40"
      @update:model-value="changeType"
    />

    <!-- Signal Active: just a column picker -->
    <template v-if="condition.type === 'signal_active'">
      <USelectMenu
        :model-value="condition.column"
        :items="signalMenuItems"
        value-key="value"
        placeholder="Signal w\u00e4hlen..."
        class="w-52"
        @update:model-value="updateField('column', $event)"
      />
      <span class="text-sm text-gray-400">ist aktiv</span>
    </template>

    <!-- Value Check: column op value -->
    <template v-if="condition.type === 'value_check'">
      <USelectMenu
        :model-value="condition.column"
        :items="columnMenuItems"
        value-key="value"
        placeholder="Spalte..."
        class="w-44"
        @update:model-value="updateField('column', $event)"
      />
      <USelect
        :model-value="condition.op"
        :items="operators"
        value-key="value"
        class="w-20"
        @update:model-value="updateField('op', $event)"
      />
      <UInput
        :model-value="String(condition.value ?? '')"
        type="number"
        step="any"
        class="w-24"
        @update:model-value="updateField('value', Number($event))"
      />
    </template>

    <!-- Column Compare: column_a op column_b -->
    <template v-if="condition.type === 'col_compare'">
      <USelectMenu
        :model-value="condition.column_a"
        :items="columnMenuItems"
        value-key="value"
        placeholder="Spalte A..."
        class="w-44"
        @update:model-value="updateField('column_a', $event)"
      />
      <USelect
        :model-value="condition.op"
        :items="operators"
        value-key="value"
        class="w-20"
        @update:model-value="updateField('op', $event)"
      />
      <USelectMenu
        :model-value="condition.column_b"
        :items="columnMenuItems"
        value-key="value"
        placeholder="Spalte B..."
        class="w-44"
        @update:model-value="updateField('column_b', $event)"
      />
    </template>

    <!-- Crossing: column_a crosses above/below column_b -->
    <template v-if="condition.type === 'crossing'">
      <USelectMenu
        :model-value="condition.column_a"
        :items="columnMenuItems"
        value-key="value"
        placeholder="Spalte A..."
        class="w-44"
        @update:model-value="updateField('column_a', $event)"
      />
      <USelect
        :model-value="condition.direction"
        :items="crossDirections"
        value-key="value"
        class="w-36"
        @update:model-value="updateField('direction', $event)"
      />
      <USelectMenu
        :model-value="condition.column_b"
        :items="columnMenuItems"
        value-key="value"
        placeholder="Spalte B..."
        class="w-44"
        @update:model-value="updateField('column_b', $event)"
      />
    </template>

    <!-- Delete button -->
    <UButton
      icon="i-heroicons-x-mark"
      variant="ghost"
      color="error"
      size="xs"
      @click="emit('remove')"
    />
  </div>
</template>
