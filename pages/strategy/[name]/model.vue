<script setup lang="ts">
const store = useStrategyConfigStore();
const { config } = storeToRefs(store);
const modelRef = computed(() => config.value?._refs?.model);

const architectures = [
  { label: "Unified", value: "unified" },
  { label: "Long/Short Separate", value: "long_short_separate" },
];

const directionOptions = [
  { label: "Long", value: "long" },
  { label: "Short", value: "short" },
];

// Hyperparameter editing
const newParamKey = ref("");
const newParamValue = ref("");

function addHyperparameter() {
  if (!config.value?.model || !newParamKey.value.trim()) return;
  const val = Number(newParamValue.value);
  config.value.model.hyperparameters[newParamKey.value.trim()] =
    isNaN(val) ? newParamValue.value : val;
  newParamKey.value = "";
  newParamValue.value = "";
}

function removeHyperparameter(key: string) {
  if (!config.value?.model) return;
  delete config.value.model.hyperparameters[key];
}

function updateHyperparameterValue(key: string, rawValue: string) {
  if (!config.value?.model) return;
  const num = Number(rawValue);
  config.value.model.hyperparameters[key] = isNaN(num) ? rawValue : num;
}

function toggleDirection(dir: string) {
  if (!config.value?.model) return;
  const dirs = config.value.model.trade_directions;
  const idx = dirs.indexOf(dir);
  if (idx >= 0) {
    dirs.splice(idx, 1);
  } else {
    dirs.push(dir);
  }
}
</script>

<template>
  <div v-if="config?.model" class="overflow-y-auto h-full p-1">
    <div class="space-y-6">
      <StrategyPresetSelectorBar
        section="models"
        label="Model"
        :current-ref="modelRef"
        :model-value="config.model as Record<string, unknown>"
        @apply="(name, content) => store.applyPreset('model', name, content)"
        @detach="store.detachPreset('model')"
      />
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Model-Konfiguration</h3>
        </template>
        <div class="space-y-4">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <UFormField label="Typ">
              <UInput v-model="config.model.type" class="w-full" />
            </UFormField>
            <UFormField label="Architektur">
              <USelect
                v-model="config.model.architecture"
                :items="architectures"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>

          <UFormField label="Trade-Richtungen">
            <div class="flex gap-2">
              <UButton
                v-for="opt in directionOptions"
                :key="opt.value"
                :variant="config.model.trade_directions.includes(opt.value) ? 'solid' : 'outline'"
                                @click="toggleDirection(opt.value)"
              >
                {{ opt.label }}
              </UButton>
            </div>
          </UFormField>
        </div>
      </UCard>

      <!-- Hyperparameters -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Hyperparameter</h3>
        </template>
        <div class="space-y-3">
          <div
            v-for="(value, key) in config.model.hyperparameters"
            :key="key"
            class="flex items-center gap-3"
          >
            <span class="text-sm text-gray-400 font-mono w-44 shrink-0">{{ key }}</span>
            <UInput
              :model-value="String(value)"
              class="flex-1"
                            @update:model-value="updateHyperparameterValue(String(key), $event)"
            />
            <UButton
              icon="i-heroicons-trash"
              variant="ghost"
                            color="error"
              @click="removeHyperparameter(String(key))"
            />
          </div>

          <div v-if="!Object.keys(config.model.hyperparameters).length" class="text-sm text-gray-500">
            Keine Hyperparameter konfiguriert.
          </div>

          <div class="flex gap-2 pt-2 border-t border-gray-800">
            <UInput
              v-model="newParamKey"
              placeholder="Key"
                            class="w-44"
              @keydown.enter="addHyperparameter"
            />
            <UInput
              v-model="newParamValue"
              placeholder="Value"
                            class="flex-1"
              @keydown.enter="addHyperparameter"
            />
            <UButton
                            variant="soft"
              :disabled="!newParamKey.trim()"
              @click="addHyperparameter"
            >
              Hinzufügen
            </UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
