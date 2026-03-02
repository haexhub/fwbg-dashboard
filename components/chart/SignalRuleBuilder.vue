<script setup lang="ts">
import type { ActiveIndicator } from "~/types/chart";

interface Condition {
  column: string;
  op: string;
  value: number;
}

interface Rule {
  output: string;
  logic: "AND" | "OR";
  conditions: Condition[];
}

interface SignalDefinition {
  name: string;
  description: string;
  version: string;
  dependencies: string[];
  rules: Rule[];
}

const props = defineProps<{
  open: boolean;
  activeIndicators: ActiveIndicator[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  saved: [];
}>();

const toast = useToast();
const saving = ref(false);

// Signal metadata
const signalName = ref("");
const signalDescription = ref("");

// Rules
const rules = ref<Rule[]>([
  { output: "", logic: "AND", conditions: [{ column: "", op: "==", value: 1 }] },
]);

// Collect all columns from active indicators (both signal and plot)
const availableColumns = computed(() => {
  const cols: { label: string; value: string }[] = [];
  for (const ind of props.activeIndicators) {
    for (const col of ind.columns) {
      cols.push({ label: col, value: col });
    }
  }
  return cols;
});

// Collect indicator FQNs as dependencies
const dependencies = computed(() => {
  const fqns = new Set<string>();
  for (const ind of props.activeIndicators) {
    fqns.add(ind.fqn);
  }
  return [...fqns];
});

const operatorOptions = [
  { label: "==", value: "==" },
  { label: "!=", value: "!=" },
  { label: ">", value: ">" },
  { label: "<", value: "<" },
  { label: ">=", value: ">=" },
  { label: "<=", value: "<=" },
  { label: "crosses above", value: "crosses_above" },
  { label: "crosses below", value: "crosses_below" },
];

const logicOptions = [
  { label: "AND", value: "AND" },
  { label: "OR", value: "OR" },
];

const canSave = computed(
  () => signalName.value.trim().length > 0
    && rules.value.length > 0
    && rules.value.every(r => r.output.trim() && r.conditions.length > 0 && r.conditions.every(c => c.column)),
);

function addRule() {
  rules.value.push({
    output: "",
    logic: "AND",
    conditions: [{ column: "", op: "==", value: 1 }],
  });
}

function removeRule(idx: number) {
  rules.value.splice(idx, 1);
}

function addCondition(ruleIdx: number) {
  rules.value[ruleIdx]!.conditions.push({ column: "", op: "==", value: 1 });
}

function removeCondition(ruleIdx: number, condIdx: number) {
  rules.value[ruleIdx]!.conditions.splice(condIdx, 1);
}

async function handleSave() {
  if (!canSave.value) return;
  saving.value = true;

  const definition: SignalDefinition = {
    name: signalName.value.trim(),
    description: signalDescription.value.trim(),
    version: "1.0.0",
    dependencies: dependencies.value,
    rules: rules.value.map(r => ({
      ...r,
      output: r.output.trim(),
    })),
  };

  try {
    await $fetch("/api/custom-signals", {
      method: "POST",
      body: definition,
    });
    toast.add({
      title: "Custom Signal erstellt",
      description: `"${definition.name}" ist jetzt in der Indikatorauswahl verfügbar.`,
      color: "success",
    });
    emit("saved");
    emit("update:open", false);
    resetForm();
  } catch (e: unknown) {
    const err = e as { data?: { detail?: string }; message?: string };
    toast.add({
      title: "Fehler",
      description: err?.data?.detail ?? err?.message ?? "Speichern fehlgeschlagen",
      color: "error",
    });
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  signalName.value = "";
  signalDescription.value = "";
  rules.value = [
    { output: "", logic: "AND", conditions: [{ column: "", op: "==", value: 1 }] },
  ];
}

// Reset form when opening
watch(() => props.open, (open) => {
  if (open) resetForm();
});
</script>

<template>
  <USlideover
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #header>
      <div>
        <h3 class="text-lg font-semibold text-white">
          Custom Signal erstellen
        </h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Kombiniere Indikator-Columns zu einem neuen Signal
        </p>
      </div>
    </template>

    <template #body>
      <div class="space-y-5 p-1">
        <!-- Signal Name -->
        <UFormField label="Signal Name" required>
          <UInput
            v-model="signalName"
            placeholder="z.B. orb_trend_combo"
          />
        </UFormField>

        <!-- Description -->
        <UFormField label="Beschreibung">
          <UInput
            v-model="signalDescription"
            placeholder="ORB Retest + Supertrend Bestätigung"
          />
        </UFormField>

        <!-- Rules -->
        <div
          v-for="(rule, ruleIdx) in rules"
          :key="ruleIdx"
          class="rounded-lg bg-gray-800/60 border border-gray-700/40 p-3 space-y-3"
        >
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-gray-300">
              Rule {{ ruleIdx + 1 }}
            </span>
            <UButton
              v-if="rules.length > 1"
              icon="i-lucide-x"
              variant="ghost"
              size="xs"
              color="error"
              @click="removeRule(ruleIdx)"
            />
          </div>

          <!-- Output Column Name -->
          <UFormField label="Output Column">
            <UInput
              v-model="rule.output"
              placeholder="z.B. my_long_signal"
              class="font-mono text-sm"
            />
          </UFormField>

          <!-- Logic -->
          <UFormField label="Verknüpfung">
            <USelect
              v-model="rule.logic"
              :items="logicOptions"
              value-key="value"
              class="w-24"
            />
          </UFormField>

          <!-- Conditions -->
          <div class="space-y-2">
            <div class="text-xs text-gray-500">Bedingungen</div>
            <div
              v-for="(cond, condIdx) in rule.conditions"
              :key="condIdx"
              class="flex items-center gap-2"
            >
              <USelect
                v-model="cond.column"
                :items="availableColumns"
                value-key="value"
                placeholder="Column"
                class="flex-1 min-w-0"
              />
              <USelect
                v-model="cond.op"
                :items="operatorOptions"
                value-key="value"
                class="w-28 shrink-0"
              />
              <UInput
                v-model.number="cond.value"
                type="number"
                step="any"
                class="w-20 shrink-0"
              />
              <UButton
                v-if="rule.conditions.length > 1"
                icon="i-lucide-minus"
                variant="ghost"
                size="xs"
                @click="removeCondition(ruleIdx, condIdx)"
              />
            </div>
          </div>

          <UButton
            icon="i-lucide-plus"
            variant="outline"
            size="xs"
            @click="addCondition(ruleIdx)"
          >
            Bedingung
          </UButton>
        </div>

        <!-- Add Rule -->
        <UButton
          icon="i-lucide-plus"
          variant="soft"
          block
          @click="addRule"
        >
          Weitere Rule
        </UButton>

        <!-- Dependencies info -->
        <div v-if="dependencies.length > 0" class="text-xs text-gray-500">
          <div class="mb-1">Abhängigkeiten:</div>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="dep in dependencies"
              :key="dep"
              :label="dep"
              variant="subtle"
              size="xs"
            />
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex items-center gap-2 w-full">
        <UButton
          :loading="saving"
          :disabled="!canSave"
          icon="i-lucide-save"
          @click="handleSave"
        >
          Signal speichern
        </UButton>
        <UButton variant="outline" @click="emit('update:open', false)">
          Abbrechen
        </UButton>
      </div>
    </template>
  </USlideover>
</template>
