<script setup lang="ts">
import type { ChartSource } from "~/types/chart";
import { TIMEFRAME_LABELS } from "~/types/chart";
import type { DataSourceBase } from "~/types/datasource";

const store = useStrategyConfigStore();
const { config } = storeToRefs(store);

// ── Datasource & Asset selection ──
const { data: datasources } = useFetch<DataSourceBase[]>("/api/datasources", {
  default: () => [],
});
const { data: chartSources } = useFetch<ChartSource[]>("/api/chart/sources", {
  default: () => [],
});

const datasourceItems = computed(() =>
  datasources.value.map((ds: DataSourceBase) => ({ label: ds.name, value: ds.name })),
);

const availableTimeframes = computed(() => {
  const ds = config.value?.datasource;
  if (!ds) return [];
  const src = chartSources.value.find((s: ChartSource) => s.name === ds);
  if (!src) return [];
  const tfs = new Set<string>();
  for (const sym of src.symbols) {
    for (const tf of sym.timeframes) tfs.add(tf);
  }
  const order = Object.keys(TIMEFRAME_LABELS);
  return [...tfs].sort((a, b) => order.indexOf(a) - order.indexOf(b));
});

const timeframeItems = computed(() =>
  availableTimeframes.value.map((tf: string) => ({
    label: TIMEFRAME_LABELS[tf] ?? tf,
    value: tf,
  })),
);

const availableSymbols = computed(() => {
  const ds = config.value?.datasource;
  if (!ds) return [];
  const src = chartSources.value.find((s: ChartSource) => s.name === ds);
  return src?.symbols ?? [];
});

const symbolItems = computed(() =>
  availableSymbols.value.map((s: { symbol: string }) => ({ label: s.symbol, value: s.symbol })),
);

const assetFilter = computed({
  get: () => config.value?.assets?.filter ?? [],
  set: (val: string[]) => {
    if (!config.value) return;
    if (!config.value.assets) config.value.assets = {};
    config.value.assets.filter = val.length > 0 ? val : undefined;
  },
});

const assetExclude = computed({
  get: () => config.value?.assets?.exclude ?? [],
  set: (val: string[]) => {
    if (!config.value) return;
    if (!config.value.assets) config.value.assets = {};
    config.value.assets.exclude = val.length > 0 ? val : undefined;
  },
});

// ── Grid preset refs (legacy — grid presets removed) ──
function gridRefForClass(_assetClass: string) {
  return undefined;
}

const regimeFilterRef = computed(() => undefined);

const assetClasses = computed(() =>
  Object.keys(config.value?.grids ?? {})
);

const selectedClass = ref("");

watch(assetClasses, (classes: string[]) => {
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
const effectiveSymbols = computed(() => {
  const filterSet = assetFilter.value.length > 0 ? new Set(assetFilter.value) : null;
  const excludeSet = assetExclude.value.length > 0 ? new Set(assetExclude.value) : null;
  return availableSymbols.value.filter((s: { symbol: string }) => {
    if (filterSet && !filterSet.has(s.symbol)) return false;
    if (excludeSet && excludeSet.has(s.symbol)) return false;
    return true;
  });
});

const availableGridEntries = computed(() => {
  const existing = new Set(assetClasses.value);
  const classes: { label: string; value: string }[] = [];
  const symbols: { label: string; value: string }[] = [];

  const seenClasses = new Set<string>();
  for (const s of effectiveSymbols.value) {
    const cls = (s as { asset_class?: string }).asset_class;
    if (cls && !existing.has(cls) && !seenClasses.has(cls)) {
      seenClasses.add(cls);
      classes.push({ label: `${cls} (Klasse)`, value: cls });
    }
    const sym = (s as { symbol: string }).symbol;
    if (!existing.has(sym)) {
      symbols.push({ label: sym, value: sym });
    }
  }

  classes.sort((a, b) => a.value.localeCompare(b.value));
  symbols.sort((a, b) => a.label.localeCompare(b.label));

  const groups: { label: string; value: string }[][] = [];
  if (classes.length) groups.push(classes);
  if (symbols.length) groups.push(symbols);
  return groups;
});

const newClassName = ref("");

function addClass(name?: string) {
  const val = (name ?? newClassName.value).trim();
  if (!val || !config.value) return;
  if (config.value.grids[val]) return;
  config.value.grids[val] = { tp: [], sl: [], ct: [] };
  selectedClass.value = val;
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

      <!-- Datasource & Assets -->
      <UCard>
        <template #header>
          <div class="space-y-1">
            <h3 class="text-lg font-medium text-white">Datasource & Assets</h3>
            <p class="text-xs text-gray-500">Datenquelle auswählen und Assets filtern.</p>
          </div>
        </template>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UFormField label="Datasource">
            <USelect
              :model-value="config.datasource ?? ''"
              :items="datasourceItems"
              value-key="value"
              placeholder="Datasource auswählen..."
              class="w-full"
              @update:model-value="(v) => { if (config) config.datasource = v || undefined }"
            />
          </UFormField>

          <UFormField v-if="timeframeItems.length > 0" label="Timeframe">
            <USelect
              :model-value="config.timeframe ?? ''"
              :items="timeframeItems"
              value-key="value"
              placeholder="Default (HOUR)"
              class="w-full"
              @update:model-value="(v) => { if (config) config.timeframe = v || undefined }"
            />
          </UFormField>

          <template v-if="availableSymbols.length > 0">
            <UFormField label="Asset-Filter (nur diese handeln)">
              <USelectMenu
                v-model="assetFilter"
                :items="symbolItems"
                value-key="value"
                multiple
                placeholder="Alle Assets"
                class="w-full"
              />
            </UFormField>

            <UFormField label="Ausgeschlossene Assets">
              <USelectMenu
                v-model="assetExclude"
                :items="symbolItems"
                value-key="value"
                multiple
                placeholder="Keine"
                class="w-full"
              />
            </UFormField>
          </template>
          <p v-else-if="config.datasource" class="text-xs text-gray-500 md:col-span-2 self-center">
            Keine Symbole für diese Datasource verfügbar.
          </p>
        </div>
      </UCard>

      <!-- Grid Preset Selector (per asset class) — always first -->
      <StrategyPresetSelectorBar
        v-if="currentGrid"
        section="grids"
        :label="`Grid — ${selectedClass}`"
        :current-ref="gridRefForClass(selectedClass)"
        :model-value="currentGrid as unknown as Record<string, unknown>"
        @apply="(name, content) => { store.applyPreset('grids', name, content); }"
        @detach="store.detachPreset('grids')"
      />

      <!-- Handelsparameter per Asset-Klasse / Symbol -->
      <UCard>
        <template #header>
          <div class="space-y-1">
            <h3 class="text-lg font-medium text-white">Handelsparameter</h3>
            <p class="text-xs text-gray-500">Parameter pro Asset-Klasse oder individuellem Symbol. Symbol-spezifische Einträge überschreiben die Klassen-Defaults.</p>
          </div>
        </template>

        <!-- Asset class / symbol selector -->
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

        <USelectMenu
          v-if="availableGridEntries.length > 0"
          :model-value="undefined"
          :items="availableGridEntries"
          value-key="value"
          placeholder="Hinzufügen..."
          class="w-52 ml-2"
          @update:model-value="(v) => addClass(v)"
        />
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
            @apply="(_name, content) => { if (currentGrid) currentGrid.regime_filter_grid = content; }"
            @detach="() => { if (currentGrid) delete currentGrid.regime_filter_grid; }"
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
