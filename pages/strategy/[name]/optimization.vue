<script setup lang="ts">
const store = useStrategyConfigStore();
const { config } = storeToRefs(store);

// Ensure optimization exists
watch(config, (c) => {
  if (!c) return;
  if (!c.optimization) c.optimization = {};
}, { immediate: true });

// ── Regime Filter Grid ──────────────────────────────────────────────────────
const OPERATORS = [">=", "<=", ">", "<", "==", "!="];
const newConditionValue = ref<Record<number, string>>({});

function addCondition() {
  if (!config.value?.optimization) return;
  if (!config.value.optimization.regime_filter_grid) {
    config.value.optimization.regime_filter_grid = { condition_grids: [] };
  }
  config.value.optimization.regime_filter_grid.condition_grids.push({
    column: "",
    operator: ">=",
    values: [],
    directions: 6,
    else_directions: 0,
  });
}

function removeCondition(index: number) {
  config.value?.optimization?.regime_filter_grid?.condition_grids.splice(index, 1);
}

function addConditionValue(ci: number) {
  const raw = newConditionValue.value[ci]?.trim();
  if (!raw) return;
  const parsed = raw === "null" ? null : Number(raw);
  if (parsed !== null && isNaN(parsed)) return;
  config.value?.optimization?.regime_filter_grid?.condition_grids[ci]?.values.push(parsed);
  newConditionValue.value[ci] = "";
}

function removeConditionValue(ci: number, vi: number) {
  config.value?.optimization?.regime_filter_grid?.condition_grids[ci]?.values.splice(vi, 1);
}

function removeRegimeFilterGrid() {
  if (config.value?.optimization) {
    config.value.optimization.regime_filter_grid = undefined;
  }
}

// ── Grid Combinations Count ─────────────────────────────────────────────────
const gridCombinations = computed(() => {
  if (!config.value) return 0;
  const opt = config.value.optimization ?? {};

  // Exit strategies: sum of CT values across all instances
  let nExit = 0;
  for (const es of config.value.exit_strategies ?? []) {
    nExit += (es.ct?.length || 1);
  }
  if (nExit === 0) nExit = 1;

  let combos = nExit;
  if (opt.model_hyperparameters_grid?.length) combos *= opt.model_hyperparameters_grid.length;
  if (opt.regime_filter_grid?.condition_grids?.length) {
    for (const cond of opt.regime_filter_grid.condition_grids) {
      if (cond.values.length > 0) combos *= cond.values.length;
    }
  }
  return combos;
});
</script>

<template>
  <div v-if="config" class="overflow-y-auto h-full p-1">
    <div class="space-y-6">

      <!-- Grid Combinations Summary -->
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium text-white">Optimization</h2>
        <UBadge variant="subtle" color="info" size="lg">
          {{ gridCombinations.toLocaleString() }} Kombinationen
        </UBadge>
      </div>

      <!-- Exit Strategies Summary -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Exit Strategies</h3>
        </template>

        <div v-if="!config.exit_strategies?.length" class="text-gray-400 text-sm">
          Keine Exit-Strategien konfiguriert. Exit-Strategien werden im Pipeline-Tab hinzugefügt.
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="(es, i) in config.exit_strategies"
            :key="i"
            class="border border-gray-700 rounded-lg p-3"
          >
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium text-white">{{ es.name }}</span>
              <UBadge variant="subtle" color="neutral" size="sm">
                CT: {{ (es.ct ?? [0.5]).join(', ') }}
              </UBadge>
              <UBadge v-if="es.min_rrr" variant="subtle" color="warning" size="sm">
                min RRR: {{ es.min_rrr }}
              </UBadge>
              <UBadge v-if="es.exit_modifier" variant="subtle" color="info" size="sm">
                {{ es.exit_modifier }}
              </UBadge>
            </div>
            <p class="text-xs text-gray-500 mt-1">
              {{ Object.entries(es.params).map(([k, v]) => `${k}=${v}`).join(', ') }}
            </p>
          </div>
          <p class="text-xs text-gray-500">
            Exit-Strategien und ihre Parameter werden im Pipeline-Tab konfiguriert.
          </p>
        </div>
      </UCard>

      <!-- Regime Filter Grid -->
      <UCard v-if="config.optimization?.regime_filter_grid">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-white">Regime Filter Grid</h3>
            <UButton icon="i-heroicons-trash" variant="ghost" color="error" @click="removeRegimeFilterGrid">
              Entfernen
            </UButton>
          </div>
        </template>

        <div class="space-y-3">
          <div
            v-for="(cond, ci) in config.optimization.regime_filter_grid.condition_grids"
            :key="ci"
            class="border border-gray-700 rounded-lg p-3 space-y-3"
          >
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium text-gray-400">Bedingung {{ ci + 1 }}</span>
              <div class="flex-1" />
              <UButton icon="i-heroicons-trash" variant="ghost" color="error" @click="removeCondition(ci)" />
            </div>

            <div class="flex gap-2">
              <UInput v-model="cond.column" placeholder="Spalte (z.B. trend_adx_14)" class="flex-1" />
              <USelect v-model="cond.operator" :items="OPERATORS" class="w-24" />
            </div>

            <div>
              <p class="text-xs text-gray-500 mb-1">Werte</p>
              <div class="flex flex-wrap gap-2 items-center">
                <UBadge
                  v-for="(val, vi) in cond.values"
                  :key="vi"
                  variant="subtle"
                  color="neutral"
                  size="md"
                  class="cursor-pointer"
                  @click="removeConditionValue(ci, vi)"
                >
                  {{ val === null ? 'null' : val }}
                  <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                </UBadge>
                <div class="flex gap-1">
                  <UInput v-model="newConditionValue[ci]" placeholder="+ (oder 'null')" class="w-28" @keydown.enter="addConditionValue(ci)" />
                  <UButton variant="ghost" @click="addConditionValue(ci)">+</UButton>
                </div>
              </div>
            </div>

            <div class="flex gap-3">
              <UFormField label="Richtungen" class="flex-1">
                <UInput v-model.number="cond.directions" type="number" class="w-full" />
              </UFormField>
              <UFormField label="Else-Richtungen" class="flex-1">
                <UInput v-model.number="cond.else_directions" type="number" class="w-full" />
              </UFormField>
            </div>
          </div>

          <UButton variant="soft" icon="i-heroicons-plus" @click="addCondition">
            Bedingung hinzufügen
          </UButton>
        </div>
      </UCard>
      <UButton v-else variant="soft" icon="i-heroicons-plus" @click="addCondition">
        Regime Filter Grid hinzufügen
      </UButton>

    </div>
  </div>
</template>
