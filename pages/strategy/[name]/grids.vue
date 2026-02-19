<script setup lang="ts">
const { config } = useStrategyConfig();

const assetClasses = computed(() =>
  Object.keys(config.value?.grids ?? {})
);

const selectedClass = ref("");

// Auto-select first asset class
watch(assetClasses, (classes) => {
  if (classes.length && !classes.includes(selectedClass.value)) {
    selectedClass.value = classes[0]!;
  }
}, { immediate: true });

type GridEntry = {
  tp: number[];
  sl: number[];
  ct: number[];
  timeout_bars?: (number | null)[];
  regime_filter_grid?: unknown;
};

const currentGrid = computed<GridEntry | null>(() => {
  if (!config.value?.grids || !selectedClass.value) return null;
  return config.value.grids[selectedClass.value] ?? null;
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

// Timeout bars can be null
function addTimeoutBar(value: string) {
  if (!currentGrid.value) return;
  if (!currentGrid.value.timeout_bars) {
    currentGrid.value.timeout_bars = [];
  }
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

// ── Inline add inputs ──
const newTp = ref("");
const newSl = ref("");
const newCt = ref("");
const newTimeout = ref("");

function handleAddTp() {
  if (!currentGrid.value || !newTp.value) return;
  addValue(currentGrid.value.tp, Number(newTp.value));
  newTp.value = "";
}

function handleAddSl() {
  if (!currentGrid.value || !newSl.value) return;
  addValue(currentGrid.value.sl, Number(newSl.value));
  newSl.value = "";
}

function handleAddCt() {
  if (!currentGrid.value || !newCt.value) return;
  addValue(currentGrid.value.ct, Number(newCt.value));
  newCt.value = "";
}

function handleAddTimeout() {
  if (!currentGrid.value) return;
  addTimeoutBar(newTimeout.value);
  newTimeout.value = "";
}

// ── Regime filter grid as raw JSON ──
const regimeJsonStr = computed({
  get() {
    if (!currentGrid.value?.regime_filter_grid) return "";
    return JSON.stringify(currentGrid.value.regime_filter_grid, null, 2);
  },
  set(val: string) {
    if (!currentGrid.value) return;
    try {
      currentGrid.value.regime_filter_grid = JSON.parse(val);
    } catch {
      // ignore invalid JSON while typing
    }
  },
});
</script>

<template>
  <div v-if="config" class="overflow-y-auto h-full p-1">
    <div class="space-y-6">
      <!-- Asset class selector -->
      <div class="flex items-center gap-2 flex-wrap">
        <UButton
          v-for="ac in assetClasses"
          :key="ac"
          :variant="selectedClass === ac ? 'solid' : 'outline'"
          size="sm"
          @click="selectedClass = ac"
        >
          {{ ac }}
        </UButton>

        <div class="flex gap-2 ml-4">
          <UInput
            v-model="newClassName"
            placeholder="Neue Klasse..."
            size="sm"
            class="w-36"
            @keydown.enter="addClass"
          />
          <UButton
            size="sm"
            variant="soft"
            :disabled="!newClassName.trim()"
            @click="addClass"
          >
            +
          </UButton>
        </div>
      </div>

      <template v-if="currentGrid">
        <!-- TP -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium text-white">
                Take Profit (ATR) — {{ selectedClass }}
              </h3>
              <UButton
                v-if="selectedClass"
                icon="i-heroicons-trash"
                variant="ghost"
                size="xs"
                color="error"
                @click="removeClass(selectedClass)"
              >
                Klasse entfernen
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
              @click="removeValue(currentGrid.tp, idx)"
            >
              {{ val }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
            </UBadge>
            <div class="flex gap-1">
              <UInput
                v-model="newTp"
                type="number"
                step="0.1"
                placeholder="+"
                size="sm"
                class="w-20"
                @keydown.enter="handleAddTp"
              />
              <UButton size="sm" variant="ghost" :disabled="!newTp" @click="handleAddTp">
                +
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- SL -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-medium text-white">Stop Loss (ATR)</h3>
          </template>
          <div class="flex flex-wrap gap-2 items-center">
            <UBadge
              v-for="(val, idx) in currentGrid.sl"
              :key="idx"
              variant="subtle"
              color="error"
              size="md"
              class="cursor-pointer"
              @click="removeValue(currentGrid.sl, idx)"
            >
              {{ val }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
            </UBadge>
            <div class="flex gap-1">
              <UInput
                v-model="newSl"
                type="number"
                step="0.1"
                placeholder="+"
                size="sm"
                class="w-20"
                @keydown.enter="handleAddSl"
              />
              <UButton size="sm" variant="ghost" :disabled="!newSl" @click="handleAddSl">
                +
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- CT -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-medium text-white">Confidence Threshold</h3>
          </template>
          <div class="flex flex-wrap gap-2 items-center">
            <UBadge
              v-for="(val, idx) in currentGrid.ct"
              :key="idx"
              variant="subtle"
              color="primary"
              size="md"
              class="cursor-pointer"
              @click="removeValue(currentGrid.ct, idx)"
            >
              {{ val }}
              <UIcon name="i-heroicons-x-mark" class="ml-1 w-3 h-3" />
            </UBadge>
            <div class="flex gap-1">
              <UInput
                v-model="newCt"
                type="number"
                step="0.05"
                placeholder="+"
                size="sm"
                class="w-20"
                @keydown.enter="handleAddCt"
              />
              <UButton size="sm" variant="ghost" :disabled="!newCt" @click="handleAddCt">
                +
              </UButton>
            </div>
          </div>
        </UCard>

        <!-- Timeout Bars -->
        <UCard>
          <template #header>
            <h3 class="text-lg font-medium text-white">Timeout Bars</h3>
          </template>
          <div class="flex flex-wrap gap-2 items-center">
            <UBadge
              v-for="(val, idx) in currentGrid.timeout_bars ?? []"
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
              <UInput
                v-model="newTimeout"
                placeholder="+ (oder 'null')"
                size="sm"
                class="w-32"
                @keydown.enter="handleAddTimeout"
              />
              <UButton size="sm" variant="ghost" :disabled="!newTimeout && newTimeout !== 'null'" @click="handleAddTimeout">
                +
              </UButton>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-2">
            "null" bedeutet kein Timeout.
          </p>
        </UCard>

        <!-- Regime Filter Grid (JSON) -->
        <UCard v-if="currentGrid.regime_filter_grid !== undefined">
          <template #header>
            <h3 class="text-lg font-medium text-white">Regime Filter Grid</h3>
          </template>
          <UTextarea
            v-model="regimeJsonStr"
            :rows="12"
            class="w-full font-mono text-xs"
          />
        </UCard>
      </template>

      <div v-else class="py-8 text-center text-gray-500">
        Keine Asset-Klasse ausgewählt.
      </div>
    </div>
  </div>
</template>
