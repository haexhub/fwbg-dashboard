<script setup lang="ts">
import type { ExitOptimizationResult } from "~/types/exploration";
import type { StrategyConfig } from "~/types/strategy";

const props = defineProps<{
  open: boolean;
  result: ExitOptimizationResult;
  symbol: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { strategies, loadStrategy, saveStrategy } = useStrategies();

// ── Form State ──
const selectedStrategy = ref("");
const selectedAssetClass = ref("");
const loadedConfig = ref<StrategyConfig | null>(null);
const loading = ref(false);
const saving = ref(false);
const saved = ref(false);
const error = ref("");

// Strategy options for USelect
const strategyOptions = computed(() =>
  (strategies.value ?? []).map((s) => ({
    label: s.name,
    value: s.filename,
  }))
);

// Load full strategy config when selection changes
watch(selectedStrategy, async (filename) => {
  if (!filename) {
    loadedConfig.value = null;
    selectedAssetClass.value = "";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    loadedConfig.value = await loadStrategy(filename);
    const classes = Object.keys(loadedConfig.value.grids ?? {});
    selectedAssetClass.value = classes[0] ?? "";
  } catch (e: any) {
    error.value = e?.message || "Strategie konnte nicht geladen werden";
    loadedConfig.value = null;
  } finally {
    loading.value = false;
  }
});

// Asset class buttons from loaded strategy's grids
const assetClassOptions = computed(() =>
  Object.keys(loadedConfig.value?.grids ?? {})
);

// Current grid values for selected asset class
const currentGrid = computed(() => {
  if (!loadedConfig.value?.grids || !selectedAssetClass.value) return null;
  return loadedConfig.value.grids[selectedAssetClass.value] ?? null;
});

const canApply = computed(() =>
  !!selectedStrategy.value &&
  !!selectedAssetClass.value &&
  !!loadedConfig.value &&
  !saving.value
);

// ── Apply ──
async function apply() {
  if (!loadedConfig.value || !selectedAssetClass.value) return;
  saving.value = true;
  error.value = "";
  try {
    const updated = JSON.parse(JSON.stringify(loadedConfig.value)) as StrategyConfig;

    // Update exit strategy + params
    updated.exit_strategy = props.result.exit_strategy;
    updated.exit_params = { ...props.result.exit_params };

    // Update grid TP/SL for selected asset class
    const ac = selectedAssetClass.value;
    if (!updated.grids[ac]) {
      updated.grids[ac] = { tp: [], sl: [], ct: [] };
    }
    updated.grids[ac]!.tp = [...props.result.suggested_grid.tp];
    updated.grids[ac]!.sl = [...props.result.suggested_grid.sl];

    await saveStrategy(selectedStrategy.value, updated);
    saved.value = true;
    setTimeout(() => {
      emit("update:open", false);
    }, 1200);
  } catch (e: any) {
    error.value = e?.message || "Speichern fehlgeschlagen";
  } finally {
    saving.value = false;
  }
}

// Reset state when modal closes
watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    selectedStrategy.value = "";
    selectedAssetClass.value = "";
    loadedConfig.value = null;
    error.value = "";
    saved.value = false;
  }
});
</script>

<template>
  <UModal :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <h3 class="text-lg font-semibold text-white">Grid in Strategie übernehmen</h3>
    </template>

    <template #body>
      <div class="space-y-5">
        <!-- Source info -->
        <div class="text-sm text-gray-400">
          Quelle: <span class="text-white font-mono">{{ symbol }}</span>
        </div>

        <!-- Strategy selection -->
        <UFormField label="Strategie">
          <USelect
            v-model="selectedStrategy"
            :items="strategyOptions"
            value-key="value"
            placeholder="Strategie wählen..."
            class="w-full"
            :disabled="saving"
          />
        </UFormField>

        <!-- Loading -->
        <div v-if="loading" class="text-sm text-gray-400">Lade Strategie...</div>

        <!-- Asset class selection -->
        <UFormField v-if="loadedConfig && assetClassOptions.length" label="Asset-Klasse">
          <div class="flex gap-2 flex-wrap">
            <UButton
              v-for="ac in assetClassOptions"
              :key="ac"
              :variant="selectedAssetClass === ac ? 'solid' : 'outline'"
              size="sm"
              @click="selectedAssetClass = ac"
            >
              {{ ac }}
            </UButton>
          </div>
        </UFormField>

        <!-- Diff preview -->
        <div v-if="loadedConfig && selectedAssetClass" class="space-y-4">
          <!-- Exit Strategy -->
          <div class="text-sm">
            <span class="text-gray-400">Exit-Strategie</span>
            <div class="flex items-center gap-2 mt-1">
              <UBadge variant="subtle" color="neutral" size="sm">
                {{ loadedConfig.exit_strategy || '–' }}
              </UBadge>
              <UIcon name="i-heroicons-arrow-right" class="text-gray-500 shrink-0" />
              <UBadge variant="subtle" color="primary" size="sm">
                {{ result.exit_strategy }}
              </UBadge>
            </div>
          </div>

          <!-- Exit Params -->
          <div class="text-sm">
            <span class="text-gray-400">Exit-Params</span>
            <div class="flex items-center gap-2 mt-1">
              <code class="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                {{ JSON.stringify(loadedConfig.exit_params) }}
              </code>
              <UIcon name="i-heroicons-arrow-right" class="text-gray-500 shrink-0" />
              <code class="text-xs text-white bg-gray-800 px-2 py-0.5 rounded">
                {{ JSON.stringify(result.exit_params) }}
              </code>
            </div>
          </div>

          <!-- TP diff -->
          <div class="text-sm">
            <span class="text-gray-400">Take Profit (ATR)</span>
            <div class="flex items-center gap-2 mt-1">
              <div class="flex gap-1">
                <UBadge
                  v-for="v in (currentGrid?.tp ?? [])"
                  :key="v"
                  variant="subtle"
                  color="neutral"
                  size="sm"
                >
                  {{ v }}
                </UBadge>
                <span v-if="!currentGrid?.tp?.length" class="text-gray-600">–</span>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="text-gray-500 shrink-0" />
              <div class="flex gap-1">
                <UBadge
                  v-for="v in result.suggested_grid.tp"
                  :key="v"
                  variant="subtle"
                  color="success"
                  size="sm"
                >
                  {{ v }}
                </UBadge>
              </div>
            </div>
          </div>

          <!-- SL diff -->
          <div class="text-sm">
            <span class="text-gray-400">Stop Loss (ATR)</span>
            <div class="flex items-center gap-2 mt-1">
              <div class="flex gap-1">
                <UBadge
                  v-for="v in (currentGrid?.sl ?? [])"
                  :key="v"
                  variant="subtle"
                  color="neutral"
                  size="sm"
                >
                  {{ v }}
                </UBadge>
                <span v-if="!currentGrid?.sl?.length" class="text-gray-600">–</span>
              </div>
              <UIcon name="i-heroicons-arrow-right" class="text-gray-500 shrink-0" />
              <div class="flex gap-1">
                <UBadge
                  v-for="v in result.suggested_grid.sl"
                  :key="v"
                  variant="subtle"
                  color="error"
                  size="sm"
                >
                  {{ v }}
                </UBadge>
              </div>
            </div>
          </div>

          <p class="text-xs text-gray-500">
            ct, timeout_bars und andere Grid-Parameter bleiben unverändert.
          </p>
        </div>

        <!-- Error -->
        <div v-if="error" class="text-sm text-red-400">{{ error }}</div>

        <!-- Success -->
        <div v-if="saved" class="text-sm text-green-400">
          Erfolgreich gespeichert!
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="outline" @click="emit('update:open', false)">
          Abbrechen
        </UButton>
        <UButton
          :loading="saving"
          :disabled="!canApply"
          @click="apply"
        >
          Übernehmen
        </UButton>
      </div>
    </template>
  </UModal>
</template>
