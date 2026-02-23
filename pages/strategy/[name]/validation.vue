<script setup lang="ts">
const store = useStrategyConfigStore();
const { config } = storeToRefs(store);
const validationRef = computed(() => config.value?._refs?.validation);

const validationMethods = [
  { label: "Walk Forward", value: "walk_forward" },
  { label: "K-Fold", value: "k_fold" },
  { label: "Time Series Split", value: "time_series_split" },
];

const calibrationMethods = [
  { label: "Isotonic", value: "isotonic" },
  { label: "Platt", value: "platt" },
];

// Typed access helpers
const v = computed(() => config.value?.validation as Record<string, unknown> | undefined);

function getVal<T>(key: string, fallback: T): T {
  return (v.value?.[key] as T) ?? fallback;
}

function setVal(key: string, value: unknown) {
  if (!config.value) return;
  config.value.validation[key] = value;
}

const earlyPruning = computed(() =>
  (v.value?.early_pruning as Record<string, unknown>) ?? {}
);

function setPruningVal(key: string, value: unknown) {
  if (!config.value) return;
  if (!config.value.validation.early_pruning) {
    config.value.validation.early_pruning = {};
  }
  (config.value.validation.early_pruning as Record<string, unknown>)[key] = value;
}
</script>

<template>
  <div v-if="v" class="overflow-y-auto h-full p-1">
    <div class="space-y-6">
      <StrategyPresetSelectorBar
        section="validations"
        label="Validation"
        :current-ref="validationRef"
        :model-value="v"
        @apply="(name, content) => store.applyPreset('validation', name, content)"
        @detach="store.detachPreset('validation')"
      />
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Validation</h3>
        </template>
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Methode">
              <USelect
                :model-value="getVal('method', 'walk_forward')"
                :items="validationMethods"
                value-key="value"
                class="w-full"
                @update:model-value="setVal('method', $event)"
              />
            </UFormField>
            <UFormField label="Folds">
              <UInput
                :model-value="getVal('folds', 8)"
                type="number"
                class="w-full"
                @update:model-value="setVal('folds', Number($event))"
              />
            </UFormField>
            <UFormField label="OOS Size">
              <UInput
                :model-value="getVal('oos_size', 4000)"
                type="number"
                class="w-full"
                @update:model-value="setVal('oos_size', Number($event))"
              />
            </UFormField>
            <UFormField label="Min. Trades">
              <UInput
                :model-value="getVal('min_trades', 50)"
                type="number"
                class="w-full"
                @update:model-value="setVal('min_trades', Number($event))"
              />
            </UFormField>
            <UFormField label="Inner Folds">
              <UInput
                :model-value="getVal('n_inner_folds', 5)"
                type="number"
                class="w-full"
                @update:model-value="setVal('n_inner_folds', Number($event))"
              />
            </UFormField>
            <UFormField label="Embargo Bars">
              <UInput
                :model-value="getVal('embargo_bars', 100)"
                type="number"
                class="w-full"
                @update:model-value="setVal('embargo_bars', Number($event))"
              />
            </UFormField>
          </div>

          <div class="flex items-center gap-6">
            <label class="flex items-center gap-2 text-sm text-gray-300">
              <UCheckbox
                :model-value="getVal('sample_weights', false)"
                @update:model-value="setVal('sample_weights', $event)"
              />
              Sample Weights
            </label>
            <label class="flex items-center gap-2 text-sm text-gray-300">
              <UCheckbox
                :model-value="getVal('probability_calibration', false)"
                @update:model-value="setVal('probability_calibration', $event)"
              />
              Probability Calibration
            </label>
          </div>

          <UFormField
            v-if="getVal('probability_calibration', false)"
            label="Calibration-Methode"
          >
            <USelect
              :model-value="getVal('calibration_method', 'isotonic')"
              :items="calibrationMethods"
              value-key="value"
              class="w-48"
              @update:model-value="setVal('calibration_method', $event)"
            />
          </UFormField>
        </div>
      </UCard>

      <!-- Early Pruning -->
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium text-white">Early Pruning</h3>
            <UCheckbox
              :model-value="earlyPruning.enabled as boolean ?? false"
              @update:model-value="setPruningVal('enabled', $event)"
            />
          </div>
        </template>
        <div v-if="earlyPruning.enabled" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <UFormField label="Keep Ratio">
            <UInput
              :model-value="earlyPruning.keep_ratio as number ?? 0.5"
              type="number"
              step="0.05"
              :min="0"
              :max="1"
              class="w-full"
              @update:model-value="setPruningVal('keep_ratio', Number($event))"
            />
          </UFormField>
          <UFormField label="Min. Survivors">
            <UInput
              :model-value="earlyPruning.min_survivors as number ?? 10"
              type="number"
              class="w-full"
              @update:model-value="setPruningVal('min_survivors', Number($event))"
            />
          </UFormField>
        </div>
        <p v-else class="text-sm text-gray-500">Early Pruning ist deaktiviert.</p>
      </UCard>
    </div>
  </div>
</template>
