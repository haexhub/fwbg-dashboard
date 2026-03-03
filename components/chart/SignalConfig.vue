<script setup lang="ts">
import type { ActiveIndicator } from "~/types/chart";
import type { SignalRules, SignalRuleSet } from "~/types/strategy";

const props = defineProps<{
  open: boolean;
  activeIndicators: ActiveIndicator[];
  modelValue?: SignalRules;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:modelValue": [value: SignalRules];
}>();

const rules = computed({
  get: () => props.modelValue ?? {},
  set: (v) => emit("update:modelValue", v),
});

const emptyRuleSet = (): SignalRuleSet => ({
  operator: "AND",
  conditions: [],
});

const longRules = computed({
  get: () => rules.value.long ?? emptyRuleSet(),
  set: (v) => emit("update:modelValue", { ...rules.value, long: v }),
});

const shortRules = computed({
  get: () => rules.value.short ?? emptyRuleSet(),
  set: (v) => emit("update:modelValue", { ...rules.value, short: v }),
});

// Build column items directly from active indicators (no backend call needed)
const columnItems = computed(() => {
  const groups: { label: string; items: { label: string; value: string }[] }[] = [];

  // De-duplicate by FQN, merge columns
  const byFqn = new Map<string, { name: string; columns: Set<string> }>();
  for (const ind of props.activeIndicators) {
    const existing = byFqn.get(ind.fqn);
    if (existing) {
      for (const col of ind.columns) existing.columns.add(col);
    } else {
      byFqn.set(ind.fqn, {
        name: ind.name.replace(/ \(signal\)$/, ""),
        columns: new Set(ind.columns),
      });
    }
  }

  for (const [, info] of byFqn) {
    const items = [...info.columns].map((col) => ({
      label: col,
      value: col,
    }));
    if (items.length > 0) {
      groups.push({ label: info.name, items });
    }
  }
  return groups;
});

const signalColumnItems = computed(() => {
  const groups: { label: string; items: { label: string; value: string }[] }[] = [];

  const byFqn = new Map<string, { name: string; columns: string[] }>();
  for (const ind of props.activeIndicators) {
    if (!ind.isSignal) continue;
    const existing = byFqn.get(ind.fqn);
    if (existing) {
      for (const col of ind.columns) {
        if (!existing.columns.includes(col)) existing.columns.push(col);
      }
    } else {
      byFqn.set(ind.fqn, {
        name: ind.name.replace(/ \(signal\)$/, ""),
        columns: [...ind.columns],
      });
    }
  }

  for (const [, info] of byFqn) {
    const items = info.columns.map((col) => ({
      label: col,
      value: col,
    }));
    if (items.length > 0) {
      groups.push({ label: info.name, items });
    }
  }
  return groups;
});

const hasRules = computed(() => {
  const sr = rules.value;
  return sr.long?.conditions?.length || sr.short?.conditions?.length;
});

function clearRules() {
  emit("update:modelValue", {
    long: emptyRuleSet(),
    short: emptyRuleSet(),
  });
}
</script>

<template>
  <USlideover
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div>
        <h3 class="text-lg font-semibold text-white">
          Signal-Konfiguration
        </h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Entry-Signale aus Indikator-Spalten zusammenstellen
        </p>
      </div>
    </template>

    <template #body>
      <div class="space-y-4 p-1">
        <div v-if="activeIndicators.length === 0" class="text-sm text-gray-500">
          Keine Indikatoren aktiv. Füge zuerst Indikatoren hinzu.
        </div>

        <template v-else>
          <StrategySignalRuleGroup
            v-model="longRules"
            label="LONG"
            :column-items="columnItems"
            :signal-column-items="signalColumnItems"
          />

          <StrategySignalRuleGroup
            v-model="shortRules"
            label="SHORT"
            :column-items="columnItems"
            :signal-column-items="signalColumnItems"
          />
        </template>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center gap-2 w-full">
        <UButton
          v-if="hasRules"
          variant="outline"
          color="error"
          size="sm"
          icon="i-heroicons-trash"
          @click="clearRules"
        >
          Zurücksetzen
        </UButton>
        <div class="flex-1" />
        <UButton
          variant="soft"
          @click="emit('update:open', false)"
        >
          Schließen
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
