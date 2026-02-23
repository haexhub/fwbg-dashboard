<script setup lang="ts">
const store = useStrategyConfigStore();
const { config } = storeToRefs(store);

// ── Grid preset refs ──
function gridRefForClass(assetClass: string) {
  return config.value?._refs?.grids?.[assetClass]?.name;
}

const regimeFilterRef = computed(() => config.value?._refs?.grids_regime_filter ?? undefined);

const assetClasses = computed(() =>
  Object.keys(config.value?.grids ?? {})
);

const selectedClass = ref("");

watch(assetClasses, (classes) => {
  if (classes.length && !classes.includes(selectedClass.value)) {
    selectedClass.value = classes[0]!;
  }
}, { immediate: true });

type ConditionGrid = {
  column: string;
  operator: string;
  values: (number | null)[];
  directions: number;
  else_directions: number;
};

type GridEntry = {
  tp?: number[];
  sl?: number[];
  ct?: number[];
  timeout_bars?: (number | null)[];
  regime_filter_grid?: { condition_grids: ConditionGrid[] };
  long_tp?: number[];
  long_sl?: number[];
  long_ct?: number[];
  short_tp?: number[];
  short_sl?: number[];
  short_ct?: number[];
};

const currentGrid = computed<GridEntry | null>(() => {
  if (!config.value?.grids || !selectedClass.value) return null;
  return (config.value.grids[selectedClass.value] as GridEntry) ?? null;
});

// ── Number list editing ──
function addValue(list: number[], value: number) {
  if (!isNaN(value) && !list.includes(value)) {
    list.push(value);
    list.sort((a, b) => a - b);
  }
}

function removeValue(list: number[], index: number) {
  list.splice(index, 1);
}

function addTimeoutBar(value: string) {
  if (!currentGrid.value?.timeout_bars) return;
  const parsed = value === "null" || value === "" ? null : Number(value);
  if (parsed !== null && isNaN(parsed)) return;
  currentGrid.value.timeout_bars.push(parsed);
}

function removeTimeoutBar(index: number) {
  currentGrid.value?.timeout_bars?.splice(index, 1);
}

// ── Add / Remove asset class ──
const newClassName = ref("");

function addClass() {
  const name = newClassName.value.trim().toUpperCase();
  if (!name || !config.value) return;
  if (config.value.grids[name]) return;
  config.value.grids[name] = { tp: [], sl: [], ct: [] };
  selectedClass.value = name;
  newClassName.value = "";
}

function removeClass(name: string) {
  if (!config.value) return;
  delete config.value.grids[name];
  if (selectedClass.value === name) {
    selectedClass.value = assetClasses.value[0] ?? "";
  }
}

// ── Add / Remove individual sections ──
function addTpSection() { if (currentGrid.value) currentGrid.value.tp = []; }
function removeTpSection() { if (currentGrid.value) delete currentGrid.value.tp; }

function addSlSection() { if (currentGrid.value) currentGrid.value.sl = []; }
function removeSlSection() { if (currentGrid.value) delete currentGrid.value.sl; }

function addCtSection() { if (currentGrid.value) currentGrid.value.ct = []; }
function removeCtSection() { if (currentGrid.value) delete currentGrid.value.ct; }

function addTimeoutBarsSection() { if (currentGrid.value) currentGrid.value.timeout_bars = []; }
function removeTimeoutBarsSection() { if (currentGrid.value) delete currentGrid.value.timeout_bars; }

// ── Inline add inputs ──
const newTp = ref("");
const newSl = ref("");
const newCt = ref("");
const newTimeout = ref("");
const newLongTp = ref("");
const newLongSl = ref("");
const newLongCt = ref("");
const newShortTp = ref("");
const newShortSl = ref("");
const newShortCt = ref("");

function handleAddTp() {
  if (!currentGrid.value?.tp || !newTp.value) return;
  addValue(currentGrid.value.tp, Number(newTp.value));
  newTp.value = "";
}

function handleAddSl() {
  if (!currentGrid.value?.sl || !newSl.value) return;
  addValue(currentGrid.value.sl, Number(newSl.value));
  newSl.value = "";
}

function handleAddCt() {
  if (!currentGrid.value?.ct || !newCt.value) return;
  addValue(currentGrid.value.ct, Number(newCt.value));
  newCt.value = "";
}

function handleAddTimeout() {
  if (!currentGrid.value?.timeout_bars) return;
  addTimeoutBar(newTimeout.value);
  newTimeout.value = "";
}

// ── Long direction ──
function addLongSection() {
  if (!currentGrid.value) return;
  currentGrid.value.long_tp = [];
  currentGrid.value.long_sl = [];
  currentGrid.value.long_ct = [];
}

function removeLongSection() {
  if (!currentGrid.value) return;
  delete currentGrid.value.long_tp;
  delete currentGrid.value.long_sl;
  delete currentGrid.value.long_ct;
}

function handleAddLongTp() {
  if (!currentGrid.value?.long_tp || !newLongTp.value) return;
  addValue(currentGrid.value.long_tp, Number(newLongTp.value));
  newLongTp.value = "";
}

function handleAddLongSl() {
  if (!currentGrid.value?.long_sl || !newLongSl.value) return;
  addValue(currentGrid.value.long_sl, Number(newLongSl.value));
  newLongSl.value = "";
}

function handleAddLongCt() {
  if (!currentGrid.value?.long_ct || !newLongCt.value) return;
  addValue(currentGrid.value.long_ct, Number(newLongCt.value));
  newLongCt.value = "";
}

// ── Short direction ──
function addShortSection() {
  if (!currentGrid.value) return;
  currentGrid.value.short_tp = [];
  currentGrid.value.short_sl = [];
  currentGrid.value.short_ct = [];
}

function removeShortSection() {
  if (!currentGrid.value) return;
  delete currentGrid.value.short_tp;
  delete currentGrid.value.short_sl;
  delete currentGrid.value.short_ct;
}

function handleAddShortTp() {
  if (!currentGrid.value?.short_tp || !newShortTp.value) return;
  addValue(currentGrid.value.short_tp, Number(newShortTp.value));
  newShortTp.value = "";
}

function handleAddShortSl() {
  if (!currentGrid.value?.short_sl || !newShortSl.value) return;
  addValue(currentGrid.value.short_sl, Number(newShortSl.value));
  newShortSl.value = "";
}

function handleAddShortCt() {
  if (!currentGrid.value?.short_ct || !newShortCt.value) return;
  addValue(currentGrid.value.short_ct, Number(newShortCt.value));
  newShortCt.value = "";
}

// ── Regime filter grid ──
function addRegimeFilterGrid() {
  if (!currentGrid.value) return;
  currentGrid.value.regime_filter_grid = { condition_grids: [] };
}

function removeRegimeFilterGrid() {
  if (!currentGrid.value) return;
  delete currentGrid.value.regime_filter_grid;
}

const OPERATORS = [">=", "<=", ">", "<", "==", "!="];

function addCondition() {
  if (!currentGrid.value?.regime_filter_grid) return;
  currentGrid.value.regime_filter_grid.condition_grids.push({
    column: "",
    operator: ">=",
    values: [],
    directions: 6,
    else_directions: 0,
  });
}

function removeCondition(idx: number) {
  currentGrid.value?.regime_filter_grid?.condition_grids.splice(idx, 1);
}

const newConditionValue = ref<Record<number, string>>({});

function addConditionValue(condIdx: number) {
  const raw = newConditionValue.value[condIdx] ?? "";
  const cond = currentGrid.value?.regime_filter_grid?.condition_grids[condIdx];
  if (!cond) return;
  const parsed = raw === "null" || raw === "" ? null : Number(raw);
  if (parsed !== null && isNaN(parsed)) return;
  cond.values.push(parsed);
  newConditionValue.value[condIdx] = "";
}

function removeConditionValue(condIdx: number, valIdx: number) {
  currentGrid.value?.regime_filter_grid?.condition_grids[condIdx]?.values.splice(valIdx, 1);
}
</script>

<template>
  <div v-if="config" class="overflow-y-auto h-full p-1">
    <div class="space-y-6">

      <!-- Grid Preset Selector (per asset class) — always first -->
      <StrategyPresetSelectorBar
        v-if="currentGrid"
        section="grids"
        :label="`Grid — ${selectedClass}`"
        :current-ref="gridRefForClass(selectedClass)"
        :model-value="currentGrid as unknown as Record<string, unknown>"
        @apply="(name, content) => store.applyGridPreset(selectedClass, name, content)"
        @detach="store.detachGridPreset(selectedClass)"
      />

      <!-- Datasource & Assets -->
      <!-- Handelsparameter per Asset-Klasse -->
      <UCard>
        <template #header>
          <div class="space-y-1">
            <h3 class="text-lg font-medium text-white">Handelsparameter per Asset-Klasse</h3>
            <p class="text-xs text-gray-500">Jede Klasse (z.B. DAX, NAS100) definiert eigene TP/SL/CT- und Regime-Filter-Parameter für die zugehörigen Symbole.</p>
          </div>
        </template>

        <!-- Asset class selector -->
        <div class="flex items-center gap-2 flex-wrap mb-6">
        <div v-for="ac in assetClasses" :key="ac" class="flex items-center">
          <UButton
            :variant="selectedClass === ac ? 'solid' : 'outline'"
                        :class="selectedClass === ac ? 'rounded-r-none' : ''"
            @click="selectedClass = ac"
          >
            {{ ac }}
          </UButton>
          <UButton
            v-if="selectedClass === ac"
            icon="i-heroicons-trash"
            variant="outline"
                        color="error"
            class="rounded-l-none border-l-0"
            @click="removeClass(ac)"
          />
        </div>

        <div class="flex gap-2 ml-2">
          <UInput
            v-model="newClassName"
            placeholder="Neue Klasse..."
                        class="w-36"
            @keydown.enter="addClass"
          />
          <UButton variant="soft" :disabled="!newClassName.trim()" @click="addClass">
            +
          </UButton>
        </div>
      </div>

      <div v-if="currentGrid" class="space-y-4 mt-2">

        <!-- TP -->
        <template v-if="currentGrid.tp !== undefined">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-medium text-white">Take Profit (ATR)</h3>
                <UButton icon="i-heroicons-trash" variant="ghost"  color="error" @click="removeTpSection">
                  Entfernen
                </UButton>
              </div>
            </template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge
                v-for="(val, idx) in currentGrid.tp"
                :key="idx"
                variant="subtle"
                color="success"
                size="md"
                class="cursor-pointer"
                @click="removeValue(currentGrid.tp!, idx)"
              >
                {{ val }}
                <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newTp" type="number" step="0.1" placeholder="+" class="w-20" @keydown.enter="handleAddTp" />
                <UButton variant="ghost" :disabled="!newTp" @click="handleAddTp">+</UButton>
              </div>
            </div>
          </UCard>
        </template>
        <UButton v-else variant="soft" icon="i-heroicons-plus" @click="addTpSection">
          Take Profit hinzufügen
        </UButton>

        <!-- SL -->
        <template v-if="currentGrid.sl !== undefined">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-medium text-white">Stop Loss (ATR)</h3>
                <UButton icon="i-heroicons-trash" variant="ghost"  color="error" @click="removeSlSection">
                  Entfernen
                </UButton>
              </div>
            </template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge
                v-for="(val, idx) in currentGrid.sl"
                :key="idx"
                variant="subtle"
                color="error"
                size="md"
                class="cursor-pointer"
                @click="removeValue(currentGrid.sl!, idx)"
              >
                {{ val }}
                <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newSl" type="number" step="0.1" placeholder="+" class="w-20" @keydown.enter="handleAddSl" />
                <UButton variant="ghost" :disabled="!newSl" @click="handleAddSl">+</UButton>
              </div>
            </div>
          </UCard>
        </template>
        <UButton v-else variant="soft" icon="i-heroicons-plus" @click="addSlSection">
          Stop Loss hinzufügen
        </UButton>

        <!-- CT -->
        <template v-if="currentGrid.ct !== undefined">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-medium text-white">Confidence Threshold</h3>
                <UButton icon="i-heroicons-trash" variant="ghost"  color="error" @click="removeCtSection">
                  Entfernen
                </UButton>
              </div>
            </template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge
                v-for="(val, idx) in currentGrid.ct"
                :key="idx"
                variant="subtle"
                color="primary"
                size="md"
                class="cursor-pointer"
                @click="removeValue(currentGrid.ct!, idx)"
              >
                {{ val }}
                <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newCt" type="number" step="0.05" placeholder="+" class="w-20" @keydown.enter="handleAddCt" />
                <UButton variant="ghost" :disabled="!newCt" @click="handleAddCt">+</UButton>
              </div>
            </div>
          </UCard>
        </template>
        <UButton v-else variant="soft" icon="i-heroicons-plus" @click="addCtSection">
          Confidence Threshold hinzufügen
        </UButton>

        <!-- Timeout Bars -->
        <template v-if="currentGrid.timeout_bars !== undefined">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-medium text-white">Timeout Bars</h3>
                <UButton icon="i-heroicons-trash" variant="ghost"  color="error" @click="removeTimeoutBarsSection">
                  Entfernen
                </UButton>
              </div>
            </template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge
                v-for="(val, idx) in currentGrid.timeout_bars"
                :key="idx"
                variant="subtle"
                color="neutral"
                size="md"
                class="cursor-pointer"
                @click="removeTimeoutBar(idx)"
              >
                {{ val === null ? 'null' : val }}
                <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newTimeout" placeholder="+ (oder 'null')" class="w-32" @keydown.enter="handleAddTimeout" />
                <UButton variant="ghost" :disabled="!newTimeout && newTimeout !== 'null'" @click="handleAddTimeout">+</UButton>
              </div>
            </div>
            <p class="text-xs text-gray-500 mt-2">"null" bedeutet kein Timeout.</p>
          </UCard>
        </template>
        <UButton v-else variant="soft" icon="i-heroicons-plus" @click="addTimeoutBarsSection">
          Timeout Bars hinzufügen
        </UButton>

        <!-- Long Direction -->
        <template v-if="currentGrid.long_tp !== undefined">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-medium text-white">Long TP (ATR)</h3>
                <UButton icon="i-heroicons-trash" variant="ghost"  color="error" @click="removeLongSection">
                  Long-Richtung entfernen
                </UButton>
              </div>
            </template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge v-for="(val, idx) in currentGrid.long_tp ?? []" :key="idx" variant="subtle" color="success" size="md" class="cursor-pointer" @click="removeValue(currentGrid.long_tp!, idx)">
                {{ val }}<UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newLongTp" type="number" step="0.1" placeholder="+" class="w-20" @keydown.enter="handleAddLongTp" />
                <UButton variant="ghost" :disabled="!newLongTp" @click="handleAddLongTp">+</UButton>
              </div>
            </div>
          </UCard>
          <UCard>
            <template #header><h3 class="text-lg font-medium text-white">Long SL (ATR)</h3></template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge v-for="(val, idx) in currentGrid.long_sl ?? []" :key="idx" variant="subtle" color="error" size="md" class="cursor-pointer" @click="removeValue(currentGrid.long_sl!, idx)">
                {{ val }}<UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newLongSl" type="number" step="0.1" placeholder="+" class="w-20" @keydown.enter="handleAddLongSl" />
                <UButton variant="ghost" :disabled="!newLongSl" @click="handleAddLongSl">+</UButton>
              </div>
            </div>
          </UCard>
          <UCard>
            <template #header><h3 class="text-lg font-medium text-white">Long CT</h3></template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge v-for="(val, idx) in currentGrid.long_ct ?? []" :key="idx" variant="subtle" color="primary" size="md" class="cursor-pointer" @click="removeValue(currentGrid.long_ct!, idx)">
                {{ val }}<UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newLongCt" type="number" step="0.05" placeholder="+" class="w-20" @keydown.enter="handleAddLongCt" />
                <UButton variant="ghost" :disabled="!newLongCt" @click="handleAddLongCt">+</UButton>
              </div>
            </div>
          </UCard>
        </template>
        <UButton v-else variant="soft" icon="i-heroicons-plus" @click="addLongSection">
          Long-Richtung hinzufügen
        </UButton>

        <!-- Short Direction -->
        <template v-if="currentGrid.short_tp !== undefined">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-lg font-medium text-white">Short TP (ATR)</h3>
                <UButton icon="i-heroicons-trash" variant="ghost"  color="error" @click="removeShortSection">
                  Short-Richtung entfernen
                </UButton>
              </div>
            </template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge v-for="(val, idx) in currentGrid.short_tp ?? []" :key="idx" variant="subtle" color="success" size="md" class="cursor-pointer" @click="removeValue(currentGrid.short_tp!, idx)">
                {{ val }}<UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newShortTp" type="number" step="0.1" placeholder="+" class="w-20" @keydown.enter="handleAddShortTp" />
                <UButton variant="ghost" :disabled="!newShortTp" @click="handleAddShortTp">+</UButton>
              </div>
            </div>
          </UCard>
          <UCard>
            <template #header><h3 class="text-lg font-medium text-white">Short SL (ATR)</h3></template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge v-for="(val, idx) in currentGrid.short_sl ?? []" :key="idx" variant="subtle" color="error" size="md" class="cursor-pointer" @click="removeValue(currentGrid.short_sl!, idx)">
                {{ val }}<UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newShortSl" type="number" step="0.1" placeholder="+" class="w-20" @keydown.enter="handleAddShortSl" />
                <UButton variant="ghost" :disabled="!newShortSl" @click="handleAddShortSl">+</UButton>
              </div>
            </div>
          </UCard>
          <UCard>
            <template #header><h3 class="text-lg font-medium text-white">Short CT</h3></template>
            <div class="flex flex-wrap gap-2 items-center">
              <UBadge v-for="(val, idx) in currentGrid.short_ct ?? []" :key="idx" variant="subtle" color="primary" size="md" class="cursor-pointer" @click="removeValue(currentGrid.short_ct!, idx)">
                {{ val }}<UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
              </UBadge>
              <div class="flex gap-1">
                <UInput v-model="newShortCt" type="number" step="0.05" placeholder="+" class="w-20" @keydown.enter="handleAddShortCt" />
                <UButton variant="ghost" :disabled="!newShortCt" @click="handleAddShortCt">+</UButton>
              </div>
            </div>
          </UCard>
        </template>
        <UButton v-else variant="soft" icon="i-heroicons-plus" @click="addShortSection">
          Short-Richtung hinzufügen
        </UButton>

        <!-- Regime Filter Grid -->
        <UCard v-if="currentGrid.regime_filter_grid !== undefined">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium text-white">Regime Filter Grid</h3>
              <UButton icon="i-heroicons-trash" variant="ghost"  color="error" @click="removeRegimeFilterGrid">
                Entfernen
              </UButton>
            </div>
          </template>

          <StrategyPresetSelectorBar
            section="regime_filters"
            label="Regime Filter"
            :current-ref="regimeFilterRef"
            :model-value="currentGrid.regime_filter_grid as unknown as Record<string, unknown>"
            @apply="(name, content) => { store.applyRegimeFilterPreset(name); if (currentGrid) currentGrid.regime_filter_grid = content as { condition_grids: ConditionGrid[] }; }"
            @detach="store.applyRegimeFilterPreset(null)"
          />

          <div class="space-y-3 mt-2">
            <div
              v-for="(cond, ci) in currentGrid.regime_filter_grid.condition_grids"
              :key="ci"
              class="border border-gray-700 rounded-lg p-3 space-y-3"
            >
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-gray-400">Bedingung {{ ci + 1 }}</span>
                <div class="flex-1" />
                <UButton icon="i-heroicons-trash" variant="ghost"  color="error" @click="removeCondition(ci)" />
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
        <UButton v-else variant="soft" icon="i-heroicons-plus" @click="addRegimeFilterGrid">
          Regime Filter Grid hinzufügen
        </UButton>

      </div>

      <div v-else-if="assetClasses.length === 0" class="py-8 text-center text-gray-500">
        Noch keine Asset-Klassen konfiguriert.
      </div>

      </UCard>

    </div>
  </div>
</template>
