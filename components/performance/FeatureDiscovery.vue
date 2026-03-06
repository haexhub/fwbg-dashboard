<script setup lang="ts">
interface FeatureResult {
  feature: string;
  indicator?: string;
  effect_size: number;
  abs_effect_size: number;
  p_value: number;
  significant: boolean;
  auc: number;
  win_mean: number;
  loss_mean: number;
  win_std: number;
  loss_std: number;
  n_valid: number;
}

interface DirectionFeature {
  feature: string;
  indicator?: string;
  effect_size: number;
  abs_effect_size: number;
  p_value: number;
  significant: boolean;
  win_mean: number;
  loss_mean: number;
}

interface CombinationResult {
  feature_a: string;
  feature_b: string;
  indicator_a: string;
  indicator_b: string;
  op_a: string;
  op_b: string;
  threshold_a: number;
  threshold_b: number;
  wr_a: number;
  wr_b: number;
  wr_combined: number;
  base_wr: number;
  synergy: number;
  lift: number;
  n_trades: number;
  n_wins: number;
  p_value: number;
  significant: boolean;
}

interface DiscoveryData {
  strategy_name: string;
  total_trades: number;
  wins: number;
  losses: number;
  total_features: number;
  analyzed_features: number;
  indicators_computed: string[];
  results: FeatureResult[];
  direction: {
    long: DirectionFeature[];
    short: DirectionFeature[];
  };
  combinations: CombinationResult[];
}

interface RuleForm {
  feature: string;
  indicator: string;
  op: string;
  value: number;
  directions: ("long" | "short")[];
}

const props = defineProps<{
  runId: string;
  symbol: string;
  strategyName?: string;
}>();

const loading = ref(false);
const error = ref<string | null>(null);
const data = ref<DiscoveryData | null>(null);
const activeTab = ref("all");
const showOnlySignificant = ref(false);

// SSE streaming state
const progressStep = ref(0);
const progressTotal = ref(0);
const progressIndicator = ref("");
const completedIndicators = ref<string[]>([]);
const initInfo = ref<{ total_trades: number; wins: number; losses: number; bars: number } | null>(null);

// Add-to-strategy state
const ruleForm = ref<RuleForm | null>(null);
const saving = ref(false);
const saveSuccess = ref<string | null>(null);
const saveError = ref<string | null>(null);

const toast = useToast();

let eventSource: EventSource | null = null;

function cleanupStream() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

function runDiscovery() {
  cleanupStream();
  loading.value = true;
  error.value = null;
  data.value = null;
  progressStep.value = 0;
  progressTotal.value = 0;
  progressIndicator.value = "";
  completedIndicators.value = [];
  initInfo.value = null;

  const es = new EventSource(`/api/runs/${props.runId}/discovery/${props.symbol}`);
  eventSource = es;

  es.addEventListener("init", (e) => {
    const d = JSON.parse(e.data);
    initInfo.value = d;
    progressTotal.value = d.total_indicators;
  });

  es.addEventListener("progress", (e) => {
    const d = JSON.parse(e.data);
    progressStep.value = d.step;
    progressTotal.value = d.total;
    progressIndicator.value = d.indicator;
  });

  es.addEventListener("indicator_done", (e) => {
    const d = JSON.parse(e.data);
    completedIndicators.value.push(d.indicator);
    progressStep.value = d.step;
    progressTotal.value = d.total;
    progressIndicator.value = d.indicator;
  });

  es.addEventListener("indicator_skip", (e) => {
    const d = JSON.parse(e.data);
    progressStep.value = d.step;
    progressTotal.value = d.total;
  });

  es.addEventListener("done", (e) => {
    const d = JSON.parse(e.data);
    data.value = d;
    loading.value = false;
    cleanupStream();
  });

  es.addEventListener("error", (e) => {
    if (e instanceof MessageEvent) {
      const d = JSON.parse(e.data);
      error.value = d.message || "Discovery fehlgeschlagen";
    } else {
      error.value = "Verbindung zum Server verloren";
    }
    loading.value = false;
    cleanupStream();
  });

  es.onerror = () => {
    if (loading.value && !data.value) {
      error.value = "Verbindung zum Server verloren";
      loading.value = false;
    }
    cleanupStream();
  };
}

onUnmounted(cleanupStream);

const progressPct = computed(() => {
  if (!progressTotal.value) return 0;
  return Math.round((progressStep.value / progressTotal.value) * 100);
});

function fmt(v: number, decimals = 4): string {
  return v.toFixed(decimals);
}

function effectLabel(d: number): string {
  const a = Math.abs(d);
  if (a >= 0.8) return "Stark";
  if (a >= 0.5) return "Mittel";
  if (a >= 0.2) return "Schwach";
  return "Minimal";
}

function effectColor(d: number): string {
  const a = Math.abs(d);
  if (a >= 0.8) return "text-green-400";
  if (a >= 0.5) return "text-yellow-400";
  if (a >= 0.2) return "text-orange-400";
  return "text-gray-500";
}

function aucColor(auc: number): string {
  const dev = Math.abs(auc - 0.5);
  if (dev >= 0.15) return "text-green-400";
  if (dev >= 0.1) return "text-yellow-400";
  return "text-gray-400";
}

const filteredResults = computed(() => {
  if (!data.value) return [];
  const results = data.value.results;
  if (showOnlySignificant.value) {
    return results.filter((r) => r.significant);
  }
  return results;
});

const filteredDirectionResults = computed(() => {
  if (!data.value) return [];
  const dir = activeTab.value === "long" ? data.value.direction.long : data.value.direction.short;
  if (showOnlySignificant.value) {
    return dir.filter((r) => r.significant);
  }
  return dir;
});

const significantCount = computed(() => {
  if (!data.value) return 0;
  return data.value.results.filter((r) => r.significant).length;
});

const tabItems = computed(() => {
  const items = [
    { label: "Gesamt", value: "all" },
    { label: "Long", value: "long" },
    { label: "Short", value: "short" },
  ];
  if (data.value?.combinations?.length) {
    items.push({ label: `Kombinationen (${data.value.combinations.length})`, value: "combos" });
  }
  return items;
});

const filteredCombinations = computed(() => {
  if (!data.value?.combinations) return [];
  if (showOnlySignificant.value) {
    return data.value.combinations.filter((c) => c.significant);
  }
  return data.value.combinations;
});

const resolvedStrategyName = computed(() => {
  return props.strategyName || data.value?.strategy_name || "";
});

// ── Strategy selector for add-to-strategy ──
const strategyList = ref<string[]>([]);
const targetStrategy = ref("");

watch(resolvedStrategyName, (name) => {
  if (name && !targetStrategy.value) targetStrategy.value = name;
}, { immediate: true });

onMounted(async () => {
  try {
    const list = await $fetch<{ filename: string }[]>("/api/strategy/strategies");
    strategyList.value = list.map((s) => s.filename);
    // If current target isn't in the list, find best match or fall back to first
    if (!strategyList.value.includes(targetStrategy.value)) {
      const name = resolvedStrategyName.value;
      const match = name ? strategyList.value.find((s) => s.includes(name) || name.includes(s)) : undefined;
      targetStrategy.value = match ?? strategyList.value[0] ?? "";
    }
  } catch {
    // ignore
  }
});

const strategyOptions = computed(() =>
  strategyList.value.map((s) => ({ label: s, value: s }))
);

// --- Add to strategy ---

function openAddRule(feature: FeatureResult | DirectionFeature) {
  if (!resolvedStrategyName.value) {
    toast.add({ title: "Kein Strategie-Name verfügbar", color: "error" });
    return;
  }

  const effectSign = feature.effect_size;
  // Negative effect = wins have lower values → use "<"
  // Positive effect = wins have higher values → use ">"
  const op = effectSign < 0 ? "<" : ">";
  const threshold = (feature.win_mean + feature.loss_mean) / 2;

  let directions: ("long" | "short")[];
  if (activeTab.value === "long") directions = ["long"];
  else if (activeTab.value === "short") directions = ["short"];
  else directions = ["long", "short"];

  ruleForm.value = {
    feature: feature.feature,
    indicator: (feature as FeatureResult).indicator || "",
    op,
    value: parseFloat(threshold.toFixed(4)),
    directions,
  };
  saveSuccess.value = null;
  saveError.value = null;
}

function closeAddRule() {
  ruleForm.value = null;
}

async function saveRule() {
  if (!ruleForm.value || !targetStrategy.value) return;

  saving.value = true;
  saveError.value = null;

  try {
    // Fetch current strategy
    const strategy = await $fetch<Record<string, any>>(
      `/api/strategy/strategies/${targetStrategy.value}`,
    );

    // Ensure signal_rules structure exists
    if (!strategy.signal_rules) {
      strategy.signal_rules = {};
    }

    const condition = {
      type: "value_check",
      column: ruleForm.value.feature,
      op: ruleForm.value.op,
      value: ruleForm.value.value,
    };

    for (const dir of ruleForm.value.directions) {
      if (!strategy.signal_rules[dir]) {
        strategy.signal_rules[dir] = { operator: "AND", conditions: [] };
      }
      const rules = strategy.signal_rules[dir];
      // Avoid duplicate: check if same column+op already exists
      const exists = rules.conditions?.some(
        (c: any) => c.column === condition.column && c.op === condition.op,
      );
      if (!exists) {
        rules.conditions.push(condition);
      }
    }

    // Save back
    await $fetch(`/api/strategy/strategies/${targetStrategy.value}`, {
      method: "PUT",
      body: strategy,
    });

    const dirLabel = ruleForm.value.directions.join(" + ");
    toast.add({
      title: "Signal Rule hinzugefügt",
      description: `${ruleForm.value.feature} ${ruleForm.value.op} ${ruleForm.value.value} → ${dirLabel}`,
      color: "success",
    });
    ruleForm.value = null;
  } catch (e: any) {
    saveError.value = e?.data?.message || e?.message || "Fehler beim Speichern";
    toast.add({ title: "Fehler", description: saveError.value!, color: "error" });
  } finally {
    saving.value = false;
  }
}

async function addComboToStrategy(combo: CombinationResult) {
  if (!targetStrategy.value) {
    toast.add({ title: "Kein Strategie-Name verfügbar", color: "error" });
    return;
  }

  saving.value = true;
  try {
    const strategy = await $fetch<Record<string, any>>(
      `/api/strategy/strategies/${targetStrategy.value}`,
    );

    if (!strategy.signal_rules) strategy.signal_rules = {};

    const conditions = [
      { type: "value_check", column: combo.feature_a, op: combo.op_a, value: combo.threshold_a },
      { type: "value_check", column: combo.feature_b, op: combo.op_b, value: combo.threshold_b },
    ];

    for (const dir of ["long", "short"] as const) {
      if (!strategy.signal_rules[dir]) {
        strategy.signal_rules[dir] = { operator: "AND", conditions: [] };
      }
      for (const cond of conditions) {
        const exists = strategy.signal_rules[dir].conditions?.some(
          (c: any) => c.column === cond.column && c.op === cond.op,
        );
        if (!exists) {
          strategy.signal_rules[dir].conditions.push(cond);
        }
      }
    }

    await $fetch(`/api/strategy/strategies/${targetStrategy.value}`, {
      method: "PUT",
      body: strategy,
    });

    toast.add({
      title: "Kombination hinzugefügt",
      description: `${combo.feature_a} ${combo.op_a} ${combo.threshold_a} AND ${combo.feature_b} ${combo.op_b} ${combo.threshold_b}`,
      color: "success",
    });
  } catch (e: any) {
    toast.add({ title: "Fehler", description: e?.message || "Speichern fehlgeschlagen", color: "error" });
  } finally {
    saving.value = false;
  }
}

const opOptions = [
  { label: "<", value: "<" },
  { label: "<=", value: "<=" },
  { label: ">", value: ">" },
  { label: ">=", value: ">=" },
  { label: "==", value: "==" },
];
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-white">Feature Discovery</h3>
          <p class="text-sm text-gray-400 mt-1">
            Finde Indikatoren, die statistisch zwischen Gewinn- und Verlusttrades unterscheiden.
          </p>
        </div>
        <UButton
          :loading="loading"
          :disabled="loading"
          icon="i-heroicons-magnifying-glass"
          @click="runDiscovery"
        >
          {{ data ? 'Erneut scannen' : 'Discovery starten' }}
        </UButton>
      </div>
    </template>

    <!-- Streaming progress -->
    <div v-if="loading" class="space-y-4">
      <div class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-400">
            Berechne <span class="text-white font-mono">{{ progressIndicator }}</span>
          </span>
          <span class="text-gray-500">{{ progressStep }}/{{ progressTotal }} ({{ progressPct }}%)</span>
        </div>
        <div class="h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            class="h-full rounded-full bg-primary-500 transition-all duration-300"
            :style="{ width: `${progressPct}%` }"
          />
        </div>
      </div>

      <div v-if="initInfo" class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg bg-gray-800 p-3 text-center">
          <p class="text-xs text-gray-400">Trades</p>
          <p class="text-lg font-bold text-white">{{ initInfo.total_trades }}</p>
          <p class="text-xs text-gray-500">{{ initInfo.wins }}W / {{ initInfo.losses }}L</p>
        </div>
        <div class="rounded-lg bg-gray-800 p-3 text-center">
          <p class="text-xs text-gray-400">Indikatoren</p>
          <p class="text-lg font-bold text-white">{{ completedIndicators.length }}</p>
          <p class="text-xs text-gray-500">von {{ progressTotal }}</p>
        </div>
        <div class="rounded-lg bg-gray-800 p-3 text-center">
          <p class="text-xs text-gray-400">Aktuell</p>
          <p class="text-sm font-mono text-white truncate">{{ progressIndicator || '...' }}</p>
        </div>
        <div class="rounded-lg bg-gray-800 p-3 text-center">
          <p class="text-xs text-gray-400">Bars</p>
          <p class="text-lg font-bold text-white">{{ initInfo.bars.toLocaleString() }}</p>
        </div>
      </div>

      <!-- Completed indicators list -->
      <div v-if="completedIndicators.length" class="flex flex-wrap gap-1">
        <UBadge v-for="name in completedIndicators" :key="name" color="neutral" variant="subtle" size="xs">
          {{ name }}
        </UBadge>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-8 text-center text-red-400">
      {{ error }}
    </div>

    <!-- Final Results -->
    <div v-else-if="data" class="space-y-4">
      <!-- Summary -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-lg bg-gray-800 p-3 text-center">
          <p class="text-xs text-gray-400">Trades analysiert</p>
          <p class="text-lg font-bold text-white">{{ data.total_trades }}</p>
          <p class="text-xs text-gray-500">{{ data.wins }}W / {{ data.losses }}L</p>
        </div>
        <div class="rounded-lg bg-gray-800 p-3 text-center">
          <p class="text-xs text-gray-400">Features getestet</p>
          <p class="text-lg font-bold text-white">{{ data.analyzed_features }}</p>
          <p class="text-xs text-gray-500">von {{ data.total_features }}</p>
        </div>
        <div class="rounded-lg bg-gray-800 p-3 text-center">
          <p class="text-xs text-gray-400">Signifikant (p&lt;0.05)</p>
          <p class="text-lg font-bold" :class="significantCount > 0 ? 'text-green-400' : 'text-gray-400'">
            {{ significantCount }}
          </p>
        </div>
        <div class="rounded-lg bg-gray-800 p-3 text-center">
          <p class="text-xs text-gray-400">Indikatoren</p>
          <p class="text-lg font-bold text-white">{{ data.indicators_computed.length }}</p>
        </div>
      </div>

      <!-- Tabs + Filter -->
      <div class="flex items-center justify-between">
        <UTabs v-model="activeTab" :items="tabItems" variant="link" />
        <label class="flex items-center gap-2 text-sm text-gray-400">
          <input v-model="showOnlySignificant" type="checkbox" class="rounded" />
          Nur signifikante
        </label>
      </div>

      <!-- All results table -->
      <div v-if="activeTab === 'all'" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-gray-400">
              <th class="px-3 py-2 text-left">#</th>
              <th class="px-3 py-2 text-left">Feature</th>
              <th class="px-3 py-2 text-right">Effect Size</th>
              <th class="px-3 py-2 text-right">Stärke</th>
              <th class="px-3 py-2 text-right">p-Wert</th>
              <th class="px-3 py-2 text-right">AUC</th>
              <th class="px-3 py-2 text-right">Win Ø</th>
              <th class="px-3 py-2 text-right">Loss Ø</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, idx) in filteredResults"
              :key="r.feature"
              class="border-b border-gray-800 group"
              :class="{ 'bg-green-900/10': r.significant }"
            >
              <td class="px-3 py-1.5 text-gray-500">{{ idx + 1 }}</td>
              <td class="px-3 py-1.5 font-mono text-xs text-white">
                {{ r.feature }}
                <span v-if="r.indicator" class="text-gray-600 ml-1">({{ r.indicator }})</span>
              </td>
              <td :class="['px-3 py-1.5 text-right font-mono', effectColor(r.effect_size)]">
                {{ fmt(r.effect_size) }}
              </td>
              <td :class="['px-3 py-1.5 text-right text-xs', effectColor(r.effect_size)]">
                {{ effectLabel(r.effect_size) }}
              </td>
              <td :class="['px-3 py-1.5 text-right font-mono', r.significant ? 'text-green-400' : 'text-gray-500']">
                {{ r.p_value < 0.001 ? '<0.001' : fmt(r.p_value, 4) }}
              </td>
              <td :class="['px-3 py-1.5 text-right font-mono', aucColor(r.auc)]">
                {{ fmt(r.auc, 3) }}
              </td>
              <td class="px-3 py-1.5 text-right font-mono text-gray-300">
                {{ fmt(r.win_mean, 3) }}
              </td>
              <td class="px-3 py-1.5 text-right font-mono text-gray-300">
                {{ fmt(r.loss_mean, 3) }}
              </td>
              <td class="px-1 py-1.5">
                <UButton
                  v-if="resolvedStrategyName"
                  icon="i-heroicons-plus"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  @click="openAddRule(r)"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!filteredResults.length" class="py-4 text-center text-gray-500">
          Keine {{ showOnlySignificant ? 'signifikanten ' : '' }}Ergebnisse.
        </p>
      </div>

      <!-- Combinations tab -->
      <div v-else-if="activeTab === 'combos'" class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-gray-400">
              <th class="px-3 py-2 text-left">#</th>
              <th class="px-3 py-2 text-left">Feature A</th>
              <th class="px-3 py-2 text-left">Feature B</th>
              <th class="px-3 py-2 text-right">WR Kombi</th>
              <th class="px-3 py-2 text-right">WR A</th>
              <th class="px-3 py-2 text-right">WR B</th>
              <th class="px-3 py-2 text-right">Basis WR</th>
              <th class="px-3 py-2 text-right">Synergie</th>
              <th class="px-3 py-2 text-right">Trades</th>
              <th class="px-3 py-2 text-right">p-Wert</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(c, idx) in filteredCombinations"
              :key="`${c.feature_a}-${c.feature_b}`"
              class="border-b border-gray-800 group"
              :class="{ 'bg-green-900/10': c.significant }"
            >
              <td class="px-3 py-1.5 text-gray-500">{{ idx + 1 }}</td>
              <td class="px-3 py-1.5 font-mono text-xs text-white">
                {{ c.feature_a }} {{ c.op_a }} {{ c.threshold_a }}
                <span v-if="c.indicator_a" class="text-gray-600 ml-1">({{ c.indicator_a }})</span>
              </td>
              <td class="px-3 py-1.5 font-mono text-xs text-white">
                {{ c.feature_b }} {{ c.op_b }} {{ c.threshold_b }}
                <span v-if="c.indicator_b" class="text-gray-600 ml-1">({{ c.indicator_b }})</span>
              </td>
              <td class="px-3 py-1.5 text-right font-mono font-bold" :class="c.wr_combined > c.base_wr ? 'text-green-400' : 'text-red-400'">
                {{ (c.wr_combined * 100).toFixed(1) }}%
              </td>
              <td class="px-3 py-1.5 text-right font-mono text-gray-400">
                {{ (c.wr_a * 100).toFixed(1) }}%
              </td>
              <td class="px-3 py-1.5 text-right font-mono text-gray-400">
                {{ (c.wr_b * 100).toFixed(1) }}%
              </td>
              <td class="px-3 py-1.5 text-right font-mono text-gray-500">
                {{ (c.base_wr * 100).toFixed(1) }}%
              </td>
              <td class="px-3 py-1.5 text-right font-mono" :class="c.synergy > 0 ? 'text-green-400' : 'text-orange-400'">
                {{ c.synergy > 0 ? '+' : '' }}{{ (c.synergy * 100).toFixed(1) }}pp
              </td>
              <td class="px-3 py-1.5 text-right font-mono text-gray-300">
                {{ c.n_trades }}
              </td>
              <td :class="['px-3 py-1.5 text-right font-mono', c.significant ? 'text-green-400' : 'text-gray-500']">
                {{ c.p_value < 0.001 ? '<0.001' : c.p_value.toFixed(4) }}
              </td>
              <td class="px-1 py-1.5">
                <UButton
                  v-if="resolvedStrategyName"
                  icon="i-heroicons-plus"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  title="Beide Bedingungen zur Strategie hinzufügen"
                  :loading="saving"
                  @click="addComboToStrategy(c)"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!filteredCombinations.length" class="py-4 text-center text-gray-500">
          Keine {{ showOnlySignificant ? 'signifikanten ' : '' }}Kombinationen gefunden.
        </p>
      </div>

      <!-- Direction-specific results -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-700 text-gray-400">
              <th class="px-3 py-2 text-left">#</th>
              <th class="px-3 py-2 text-left">Feature</th>
              <th class="px-3 py-2 text-right">Effect Size</th>
              <th class="px-3 py-2 text-right">Stärke</th>
              <th class="px-3 py-2 text-right">p-Wert</th>
              <th class="px-3 py-2 text-right">Win Ø</th>
              <th class="px-3 py-2 text-right">Loss Ø</th>
              <th class="w-10"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, idx) in filteredDirectionResults"
              :key="r.feature"
              class="border-b border-gray-800 group"
              :class="{ 'bg-green-900/10': r.significant }"
            >
              <td class="px-3 py-1.5 text-gray-500">{{ idx + 1 }}</td>
              <td class="px-3 py-1.5 font-mono text-xs text-white">
                {{ r.feature }}
                <span v-if="r.indicator" class="text-gray-600 ml-1">({{ r.indicator }})</span>
              </td>
              <td :class="['px-3 py-1.5 text-right font-mono', effectColor(r.effect_size)]">
                {{ fmt(r.effect_size) }}
              </td>
              <td :class="['px-3 py-1.5 text-right text-xs', effectColor(r.effect_size)]">
                {{ effectLabel(r.effect_size) }}
              </td>
              <td :class="['px-3 py-1.5 text-right font-mono', r.significant ? 'text-green-400' : 'text-gray-500']">
                {{ r.p_value < 0.001 ? '<0.001' : fmt(r.p_value, 4) }}
              </td>
              <td class="px-3 py-1.5 text-right font-mono text-gray-300">
                {{ fmt(r.win_mean, 3) }}
              </td>
              <td class="px-3 py-1.5 text-right font-mono text-gray-300">
                {{ fmt(r.loss_mean, 3) }}
              </td>
              <td class="px-1 py-1.5">
                <UButton
                  v-if="resolvedStrategyName"
                  icon="i-heroicons-plus"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  @click="openAddRule(r)"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!filteredDirectionResults.length" class="py-4 text-center text-gray-500">
          Keine {{ showOnlySignificant ? 'signifikanten ' : '' }}Ergebnisse für {{ activeTab === 'long' ? 'Long' : 'Short' }}.
        </p>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="py-8 text-center text-gray-500">
      Klicke "Discovery starten" um alle verfügbaren Indikatoren gegen die Trades zu testen.
    </div>

    <!-- Add Rule Modal -->
    <UModal :open="!!ruleForm" @update:open="(v: boolean) => { if (!v) ruleForm = null; }">
      <template #header>
        <h3 class="text-lg font-semibold text-white">Signal Rule hinzufügen</h3>
      </template>

      <template #body>
        <div v-if="ruleForm" class="space-y-4">
          <!-- Target strategy selector -->
          <div>
            <label class="block text-xs text-gray-400 mb-1">Ziel-Strategie</label>
            <USelect
              v-model="targetStrategy"
              :items="strategyOptions"
              value-key="value"
              class="w-full"
            />
          </div>

          <!-- Feature (read-only) -->
          <div>
            <label class="block text-xs text-gray-400 mb-1">Feature</label>
            <div class="font-mono text-sm text-white bg-gray-800 px-3 py-2 rounded">
              {{ ruleForm.feature }}
              <span v-if="ruleForm.indicator" class="text-gray-500 ml-1">({{ ruleForm.indicator }})</span>
            </div>
          </div>

          <!-- Operator + Value -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs text-gray-400 mb-1">Operator</label>
              <USelect v-model="ruleForm.op" :items="opOptions" value-key="value" class="w-full" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Schwellwert</label>
              <UInput v-model.number="ruleForm.value" type="number" step="any" class="w-full font-mono" />
            </div>
          </div>

          <!-- Directions -->
          <div>
            <label class="block text-xs text-gray-400 mb-1">Richtung</label>
            <div class="flex gap-3">
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value="long"
                  :checked="ruleForm.directions.includes('long')"
                  class="rounded"
                  @change="(e: Event) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    if (checked && !ruleForm!.directions.includes('long')) ruleForm!.directions.push('long');
                    else ruleForm!.directions = ruleForm!.directions.filter(d => d !== 'long');
                  }"
                />
                <span class="text-green-400">Long</span>
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  value="short"
                  :checked="ruleForm.directions.includes('short')"
                  class="rounded"
                  @change="(e: Event) => {
                    const checked = (e.target as HTMLInputElement).checked;
                    if (checked && !ruleForm!.directions.includes('short')) ruleForm!.directions.push('short');
                    else ruleForm!.directions = ruleForm!.directions.filter(d => d !== 'short');
                  }"
                />
                <span class="text-red-400">Short</span>
              </label>
            </div>
          </div>

          <!-- Preview -->
          <div class="bg-gray-900 rounded p-3 text-xs font-mono text-gray-300">
            <span class="text-gray-500">signal_rules.</span><span
              v-for="dir in ruleForm.directions"
              :key="dir"
              :class="dir === 'long' ? 'text-green-400' : 'text-red-400'"
            >{{ dir }}<span v-if="ruleForm.directions.length > 1 && dir === ruleForm.directions[0]" class="text-gray-500"> + </span></span>
            <br />
            {{ ruleForm.feature }} {{ ruleForm.op }} {{ ruleForm.value }}
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="ruleForm = null">Abbrechen</UButton>
          <UButton
            :loading="saving"
            :disabled="!ruleForm?.directions.length"
            @click="saveRule"
          >
            Hinzufügen
          </UButton>
        </div>
      </template>
    </UModal>
  </UCard>
</template>
