<script setup lang="ts">
const store = useStrategyConfigStore();
const { config } = storeToRefs(store);
const modelRef = computed(() => config.value?._refs?.model);

const route = useRoute();
const strategyName = computed(() => String(route.params.name));

const hasSignalRules = computed(() => {
  const sr = config.value?.signal_rules;
  return sr && (sr.long?.conditions?.length || sr.short?.conditions?.length);
});

const showRuleEditor = computed(() =>
  config.value?.model?.type === "signal" || hasSignalRules.value
);

watch(() => config.value?.model?.type, (newType) => {
  if (newType === "signal" && !config.value?.signal_rules) {
    config.value!.signal_rules = {
      long: { operator: "AND", conditions: [] },
      short: { operator: "AND", conditions: [] },
    };
  }
});

const pluginStore = usePluginStore();
const { plugins } = storeToRefs(pluginStore);
pluginStore.load();
const modelPlugins = computed(() =>
  plugins.value?.filter((p) => p.phase === "model") ?? []
);
const modelTypeItems = computed(() =>
  modelPlugins.value.map((p) => ({ label: p.name, value: p.name, description: p.description }))
);

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
              <USelect
                v-model="config.model.type"
                :items="modelTypeItems"
                value-key="value"
                class="w-full"
              />
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

      <!-- Signal Rule Editor (when signal model or signal_rules exist) -->
      <UCard v-if="showRuleEditor">
        <template #header>
          <h3 class="text-lg font-medium text-white">Signal Rules</h3>
          <p v-if="config.model.type !== 'signal'" class="text-sm text-neutral-400 mt-1">
            Regeln werden als Features für das ML-Modell verwendet.
          </p>
        </template>
        <StrategySignalRuleEditor
          :model-value="config.signal_rules"
          :strategy-name="strategyName"
          @update:model-value="config.signal_rules = $event"
        />
      </UCard>

      <!-- Standard Hyperparameters (when NOT using signal rules) -->
      <UCard v-else>
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
