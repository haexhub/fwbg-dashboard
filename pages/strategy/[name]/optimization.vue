<script setup lang="ts">
const store = useStrategyConfigStore();
const { config } = storeToRefs(store);

const pluginStore = usePluginStore();
const { plugins } = storeToRefs(pluginStore);
pluginStore.load();

// Ensure optimization exists
watch(config, (c) => {
  if (c && !c.optimization) {
    c.optimization = { ct: [0.5] };
  }
}, { immediate: true });

// Exit strategy plugin info (for param schema)
const exitPluginInfo = computed(() => {
  if (!config.value?.exit_strategy || !plugins.value) return null;
  return plugins.value.find(
    (p) => p.name === config.value!.exit_strategy || p.fqn.endsWith(`:${config.value!.exit_strategy}`)
  ) ?? null;
});

// Parameter schema for exit strategy
const exitParamSchema = computed(() => exitPluginInfo.value?.param_schema ?? {});

// Editable exit param keys (from schema)
const exitParamKeys = computed(() => Object.keys(exitParamSchema.value));

// ── Value list helpers ──────────────────────────────────────────────────────
const newValues = ref<Record<string, string>>({});

function addValue(key: string, target: Record<string, unknown[]>) {
  const raw = newValues.value[key]?.trim();
  if (!raw) return;
  const parsed = raw === "null" ? null : Number(raw);
  if (parsed !== null && isNaN(parsed)) return;
  if (!target[key]) target[key] = [];
  target[key].push(parsed);
  newValues.value[key] = "";
}

function removeValue(key: string, index: number, target: Record<string, unknown[]>) {
  target[key]?.splice(index, 1);
}

// ── Long/Short prefix helpers ───────────────────────────────────────────────
const showLongShort = computed(() =>
  config.value?.model?.architecture === "long_short_separate"
);

// ── Regime Filter Grid ──────────────────────────────────────────────────────
type ConditionGrid = {
  column: string;
  operator: string;
  values: (number | null)[];
  directions: number;
  else_directions: number;
};

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

// ── Exit Modifier Params Grid ───────────────────────────────────────────────
function addExitModifierEntry() {
  if (!config.value?.optimization) return;
  if (!config.value.optimization.exit_modifier_params_grid) {
    config.value.optimization.exit_modifier_params_grid = [];
  }
  config.value.optimization.exit_modifier_params_grid.push({});
}

function removeExitModifierEntry(index: number) {
  config.value?.optimization?.exit_modifier_params_grid?.splice(index, 1);
}

// ── Grid Combinations Count ─────────────────────────────────────────────────
const gridCombinations = computed(() => {
  if (!config.value) return 0;
  const ep = config.value.exit_params ?? {};
  const opt = config.value.optimization ?? {};

  let combos = 1;
  for (const values of Object.values(ep)) {
    if (Array.isArray(values) && values.length > 0) combos *= values.length;
  }
  if (Array.isArray(opt.ct) && opt.ct.length > 0) combos *= opt.ct.length;
  if (opt.exit_modifier_params_grid?.length) combos *= opt.exit_modifier_params_grid.length;
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

      <!-- Preset Selector -->
      <StrategyPresetSelectorBar
        section="exit_params"
        label="Exit-Parameter"
        :current-ref="config._refs?.exit_params"
        :model-value="config.exit_params as Record<string, unknown>"
        @apply="(name, content) => store.applyPreset('exit_params', name, content)"
        @detach="store.detachPreset('exit_params')"
      />

      <!-- Grid Combinations Summary -->
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-medium text-white">Optimization</h2>
        <UBadge variant="subtle" color="info" size="lg">
          {{ gridCombinations.toLocaleString() }} Kombinationen
        </UBadge>
      </div>

      <!-- Exit Strategy Grid -->
      <UCard>
        <template #header>
          <div class="space-y-1">
            <h3 class="text-lg font-medium text-white">
              Exit-Strategie: {{ config.exit_strategy || '\u2014' }}
            </h3>
            <p class="text-xs text-gray-500">
              Parameter als Wertelisten. Ein Eintrag = fester Wert, mehrere = Grid-Search.
            </p>
          </div>
        </template>

        <div class="space-y-4">
          <div v-for="key in exitParamKeys" :key="key">
            <label class="block text-sm font-medium text-gray-300 mb-1">
              {{ key }}
              <span v-if="exitParamSchema[key]?.description" class="text-gray-500 font-normal">
                — {{ exitParamSchema[key].description }}
              </span>
            </label>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge
                v-for="(val, vi) in ((config.exit_params[key] as unknown[]) ?? [])"
                :key="vi"
                variant="subtle"
                color="neutral"
                size="md"
                class="cursor-pointer"
                @click="removeValue(key, vi as number, config.exit_params as Record<string, unknown[]>)"
              >
                {{ val === null ? 'null' : val }}
                <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput
                  v-model="newValues[key]"
                  :placeholder="exitParamSchema[key]?.step ? `Step: ${exitParamSchema[key].step}` : '+'"
                  class="w-28"
                  @keydown.enter="addValue(key, config.exit_params as Record<string, unknown[]>)"
                />
                <UButton variant="ghost" @click="addValue(key, config.exit_params as Record<string, unknown[]>)">+</UButton>
              </div>
            </div>
          </div>

          <!-- Long/Short overrides -->
          <template v-if="showLongShort">
            <UDivider label="Long/Short Overrides" />
            <p class="text-xs text-gray-500">
              Optional: Richtungsspezifische Werte überschreiben den Basis-Wert.
            </p>
            <div v-for="key in exitParamKeys" :key="`ls-${key}`" class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-green-400 mb-1">long_{{ key }}</label>
                <div class="flex flex-wrap gap-1 items-center">
                  <UBadge
                    v-for="(val, vi) in ((config.exit_params[`long_${key}`] as unknown[]) ?? [])"
                    :key="vi"
                    variant="subtle"
                    color="success"
                    size="sm"
                    class="cursor-pointer"
                    @click="removeValue(`long_${key}`, vi as number, config.exit_params as Record<string, unknown[]>)"
                  >
                    {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                  </UBadge>
                  <div class="flex gap-1">
                    <UInput
                      v-model="newValues[`long_${key}`]"
                      placeholder="+"
                      class="w-20"
                      @keydown.enter="addValue(`long_${key}`, config.exit_params as Record<string, unknown[]>)"
                    />
                    <UButton size="xs" variant="ghost" @click="addValue(`long_${key}`, config.exit_params as Record<string, unknown[]>)">+</UButton>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-red-400 mb-1">short_{{ key }}</label>
                <div class="flex flex-wrap gap-1 items-center">
                  <UBadge
                    v-for="(val, vi) in ((config.exit_params[`short_${key}`] as unknown[]) ?? [])"
                    :key="vi"
                    variant="subtle"
                    color="error"
                    size="sm"
                    class="cursor-pointer"
                    @click="removeValue(`short_${key}`, vi as number, config.exit_params as Record<string, unknown[]>)"
                  >
                    {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                  </UBadge>
                  <div class="flex gap-1">
                    <UInput
                      v-model="newValues[`short_${key}`]"
                      placeholder="+"
                      class="w-20"
                      @keydown.enter="addValue(`short_${key}`, config.exit_params as Record<string, unknown[]>)"
                    />
                    <UButton size="xs" variant="ghost" @click="addValue(`short_${key}`, config.exit_params as Record<string, unknown[]>)">+</UButton>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </UCard>

      <!-- Confidence Threshold -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Confidence Threshold</h3>
        </template>

        <div class="space-y-3">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-1">CT</label>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge
                v-for="(val, vi) in (config.optimization?.ct ?? [])"
                :key="vi"
                variant="subtle"
                color="primary"
                size="md"
                class="cursor-pointer"
                @click="config.optimization!.ct?.splice(vi, 1)"
              >
                {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput
                  v-model="newValues['ct']"
                  placeholder="0.50"
                  class="w-28"
                  @keydown.enter="() => { if (config!.optimization) addValue('ct', config!.optimization as any) }"
                />
                <UButton variant="ghost" @click="() => { if (config!.optimization) addValue('ct', config!.optimization as any) }">+</UButton>
              </div>
            </div>
          </div>

          <!-- Separate Long/Short CT -->
          <template v-if="showLongShort">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-medium text-green-400 mb-1">Long CT</label>
                <div class="flex flex-wrap gap-1 items-center">
                  <UBadge
                    v-for="(val, vi) in (config.optimization?.long_ct ?? [])"
                    :key="vi"
                    variant="subtle"
                    color="success"
                    size="sm"
                    class="cursor-pointer"
                    @click="config.optimization!.long_ct?.splice(vi, 1)"
                  >
                    {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                  </UBadge>
                  <div class="flex gap-1">
                    <UInput
                      v-model="newValues['long_ct']"
                      placeholder="+"
                      class="w-20"
                      @keydown.enter="() => { if (config!.optimization) addValue('long_ct', config!.optimization as any) }"
                    />
                    <UButton size="xs" variant="ghost" @click="() => { if (config!.optimization) addValue('long_ct', config!.optimization as any) }">+</UButton>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-xs font-medium text-red-400 mb-1">Short CT</label>
                <div class="flex flex-wrap gap-1 items-center">
                  <UBadge
                    v-for="(val, vi) in (config.optimization?.short_ct ?? [])"
                    :key="vi"
                    variant="subtle"
                    color="error"
                    size="sm"
                    class="cursor-pointer"
                    @click="config.optimization!.short_ct?.splice(vi, 1)"
                  >
                    {{ val }} <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
                  </UBadge>
                  <div class="flex gap-1">
                    <UInput
                      v-model="newValues['short_ct']"
                      placeholder="+"
                      class="w-20"
                      @keydown.enter="() => { if (config!.optimization) addValue('short_ct', config!.optimization as any) }"
                    />
                    <UButton size="xs" variant="ghost" @click="() => { if (config!.optimization) addValue('short_ct', config!.optimization as any) }">+</UButton>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </UCard>

      <!-- Constraints -->
      <UCard>
        <template #header>
          <h3 class="text-lg font-medium text-white">Constraints</h3>
        </template>

        <UFormField label="Minimum Risk-Reward-Ratio" description="Filtert Grid-Kombinationen mit TP/SL < Schwelle">
          <UInput
            :model-value="config.optimization?.min_rrr ?? ''"
            type="number"
            step="0.1"
            placeholder="z.B. 1.0"
            class="w-40"
            @update:model-value="(v) => { if (config!.optimization) config!.optimization.min_rrr = v ? Number(v) : undefined }"
          />
        </UFormField>
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

      <!-- Exit Modifier Params Grid -->
      <UCard v-if="(config as any).exit_modifier">
        <template #header>
          <h3 class="text-lg font-medium text-white">Exit Modifier Grid ({{ (config as any).exit_modifier }})</h3>
        </template>

        <div class="space-y-3">
          <div
            v-for="(entry, ei) in (config.optimization?.exit_modifier_params_grid ?? [])"
            :key="ei"
            class="border border-gray-700 rounded-lg p-3"
          >
            <div class="flex items-center gap-2 mb-2">
              <span class="text-xs font-medium text-gray-400">Variante {{ ei + 1 }}</span>
              <div class="flex-1" />
              <UButton icon="i-heroicons-trash" variant="ghost" color="error" size="xs" @click="removeExitModifierEntry(ei)" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <UFormField v-for="(val, key) in entry" :key="key" :label="String(key)">
                <UInput
                  :model-value="val"
                  type="number"
                  step="0.1"
                  class="w-full"
                  @update:model-value="(v) => (entry as any)[key] = Number(v)"
                />
              </UFormField>
            </div>
          </div>

          <UButton variant="soft" icon="i-heroicons-plus" @click="addExitModifierEntry">
            Variante hinzufügen
          </UButton>
        </div>
      </UCard>

    </div>
  </div>
</template>
