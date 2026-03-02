<script setup lang="ts">
import type { PluginInfo, ParamSchema } from "~/types/strategy";
import type { ActiveIndicator, IndicatorResponse } from "~/types/chart";
import { LINE_COLORS } from "~/composables/useChartIndicators";

const props = defineProps<{
  open: boolean;
  plugins: PluginInfo[];
  source: string;
  symbol: string;
  timeframe: string;
  editIndicator?: ActiveIndicator | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  add: [plugin: PluginInfo, params: Record<string, unknown>, columns: string[], colors: Record<string, string>, isMainOverlay: boolean];
  "add-signal": [plugin: PluginInfo, params: Record<string, unknown>, columns: string[], colors: Record<string, string>];
  "add-all-deps": [plugin: PluginInfo];
  update: [indicatorId: string, plugin: PluginInfo, params: Record<string, unknown>, columns: string[], colors: Record<string, string>, isMainOverlay: boolean];
  "update-signal": [indicatorId: string, plugin: PluginInfo, params: Record<string, unknown>, columns: string[], colors: Record<string, string>];
}>();

// ── Plugin type classification from API metadata ──
function getPluginType(plugin: PluginInfo): "indicator" | "signal" | "both" {
  const hasSig = (plugin.signal_columns?.length ?? 0) > 0;
  const hasPlot = (plugin.plot_columns?.length ?? 0) > 0;
  if (hasSig && hasPlot) return "both";
  if (hasSig) return "signal";
  return "indicator";
}

// ── Type filter ──
const typeFilter = ref<"" | "indicator" | "signal">("");

// ── Browse entries: one entry per plugin ──
interface BrowseEntry {
  id: string;
  label: string;
  plugin: PluginInfo;
  pluginType: "indicator" | "signal" | "both";
}

const browseEntries = computed<BrowseEntry[]>(() => {
  return props.plugins.map((plugin) => ({
    id: plugin.fqn,
    label: plugin.name,
    plugin,
    pluginType: getPluginType(plugin),
  }));
});

// Sort entries alphabetically by label
const sortedEntries = computed(() =>
  [...browseEntries.value].sort((a, b) => a.label.localeCompare(b.label))
);

const search = ref("");
const groupFilter = ref("all");

// Collect unique groups from available plugins
const availableGroups = computed(() => {
  const groups = new Set<string>();
  for (const plugin of props.plugins) {
    groups.add(plugin.group ?? "custom");
  }
  return [...groups].sort();
});

const GROUP_LABELS: Record<string, string> = {
  custom: "Custom",
  price_action: "Price Action",
  regime: "Regime",
  session: "Session",
  structure: "Structure",
};

const groupFilterOptions = computed(() => [
  { label: "Alle Gruppen", value: "all" },
  ...availableGroups.value.map((g: string) => ({
    label: GROUP_LABELS[g] ?? g.charAt(0).toUpperCase() + g.slice(1).replace(/_/g, " "),
    value: g,
  })),
]);

const filteredEntries = computed(() => {
  let entries = sortedEntries.value;
  if (typeFilter.value) {
    entries = entries.filter((e) => {
      if (typeFilter.value === "signal") return e.pluginType === "signal" || e.pluginType === "both";
      if (typeFilter.value === "indicator") return e.pluginType === "indicator" || e.pluginType === "both";
      return true;
    });
  }
  if (groupFilter.value && groupFilter.value !== "all") {
    entries = entries.filter((e: BrowseEntry) => (e.plugin.group ?? "custom") === groupFilter.value);
  }
  if (search.value) {
    const q = search.value.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.plugin.name.toLowerCase().includes(q) ||
        e.plugin.fqn.toLowerCase().includes(q)
    );
  }
  return entries;
});


// ── Config mode ──
const configPlugin = ref<PluginInfo | null>(null);
const configParams = ref<Record<string, unknown>>({});
const configTab = ref("parameters");

// Column picker state
const availableColumns = ref<string[]>([]);
const selectedColumns = ref<string[]>([]);
const columnColors = ref<Record<string, string>>({});
const columnsLoading = ref(false);
const columnsLoaded = ref(false);

// Signal column state
const signalColumns = ref<string[]>([]);
const selectedSignals = ref<string[]>([]);
const signalColors = ref<Record<string, string>>({});

const configSchema = computed<Record<string, ParamSchema>>(() => {
  return configPlugin.value?.param_schema ?? {};
});

const configParamNames = computed(() => Object.keys(configSchema.value));

const configTabs = computed(() => [
  {
    label: "Columns",
    value: "plot",
    icon: "i-heroicons-chart-bar",
    badge: columnsLoaded.value ? `${totalSelected.value}/${availableColumns.value.length + signalColumns.value.length}` : undefined,
  },
  { label: "Parameters", value: "parameters", icon: "i-heroicons-adjustments-horizontal" },
]);

// Edit mode: tracks the indicator being edited (null = add mode)
const editingIndicatorId = ref<string | null>(null);

function startConfig(entry: BrowseEntry) {
  editingIndicatorId.value = null;
  configPlugin.value = entry.plugin;
  configParams.value = { ...entry.plugin.defaults };
  configTab.value = "plot";
  availableColumns.value = [];
  selectedColumns.value = [];
  signalColumns.value = [];
  selectedSignals.value = [];
  columnsLoaded.value = false;
  fetchColumns();
}

// Watch editIndicator prop to auto-enter edit config mode
watch(() => props.editIndicator, (ind: ActiveIndicator | null | undefined) => {
  if (!ind) return;
  const plugin = props.plugins.find((p: PluginInfo) => p.fqn === ind.fqn);
  if (!plugin) return;

  editingIndicatorId.value = ind.id;
  configPlugin.value = plugin;
  configParams.value = { ...ind.params };
  configTab.value = "plot";
  availableColumns.value = [];
  selectedColumns.value = [];
  signalColumns.value = [];
  selectedSignals.value = [];
  columnsLoaded.value = false;
  fetchColumns();
});

function cancelConfig() {
  configPlugin.value = null;
  editingIndicatorId.value = null;
  columnsLoaded.value = false;
}

// Track params used for last fetch to detect changes
const lastFetchedParams = ref<string>("");

// Auto-refetch columns when switching to Columns tab if params changed
watch(configTab, (tab: string) => {
  if (tab === "plot" && configPlugin.value && columnsLoaded.value) {
    const currentParams = JSON.stringify(configParams.value);
    if (currentParams !== lastFetchedParams.value) {
      fetchColumns();
    }
  }
});

async function fetchColumns() {
  if (!configPlugin.value) return;
  columnsLoading.value = true;
  lastFetchedParams.value = JSON.stringify(configParams.value);
  try {
    const response = await $fetch<IndicatorResponse>(
      "/api/chart/indicator",
      {
        method: "POST",
        body: {
          symbol: props.symbol,
          timeframe: props.timeframe,
          source: props.source,
          fqn: configPlugin.value.fqn,
          params: { ...configParams.value },
          limit: 500,
        },
      }
    );
    availableColumns.value = response.plot_columns ?? [];
    signalColumns.value = response.signal_columns ?? [];
    // In edit mode: pre-select only the indicator's existing columns
    const editCols = editingIndicatorId.value ? props.editIndicator?.columns ?? [] : null;
    if (editCols) {
      const isSignalEdit = props.editIndicator?.isSignal;
      selectedColumns.value = isSignalEdit ? [] : availableColumns.value.filter((c: string) => editCols.includes(c));
      selectedSignals.value = isSignalEdit ? signalColumns.value.filter((c: string) => editCols.includes(c)) : [];
    } else {
      selectedColumns.value = [...availableColumns.value];
      selectedSignals.value = [...signalColumns.value];
    }
    // Assign default colors from palette
    const colors: Record<string, string> = {};
    for (let i = 0; i < availableColumns.value.length; i++) {
      colors[availableColumns.value[i]!] = LINE_COLORS[i % LINE_COLORS.length]!;
    }
    columnColors.value = colors;
    // Signal colors: green for long/buy, red for short/sell, blue default
    const sigColors: Record<string, string> = {};
    const SIGNAL_COLORS = ["#4CAF50", "#E91E63", "#2196F3", "#FF9800", "#00BCD4", "#9C27B0"];
    for (let i = 0; i < signalColumns.value.length; i++) {
      sigColors[signalColumns.value[i]!] = SIGNAL_COLORS[i % SIGNAL_COLORS.length]!;
    }
    signalColors.value = sigColors;
    columnsLoaded.value = true;
  } catch (e) {
    console.error("Failed to fetch columns:", e);
  } finally {
    columnsLoading.value = false;
  }
}

function toggleColumn(col: string) {
  const idx = selectedColumns.value.indexOf(col);
  if (idx >= 0) {
    selectedColumns.value.splice(idx, 1);
  } else {
    selectedColumns.value.push(col);
  }
}

function toggleSignal(col: string) {
  const idx = selectedSignals.value.indexOf(col);
  if (idx >= 0) {
    selectedSignals.value.splice(idx, 1);
  } else {
    selectedSignals.value.push(col);
  }
}

// Strip the common plugin prefix from all columns
function findCommonPrefixLen(columns: string[]): number {
  if (columns.length <= 1) return 0;
  const parts = columns.map((c) => c.split("_"));
  let commonLen = 0;
  for (let i = 0; i < parts[0]!.length - 1; i++) {
    if (parts.every((p) => p[i] === parts[0]![i])) {
      commonLen = i + 1;
    } else {
      break;
    }
  }
  return commonLen;
}

function stripPrefix(col: string, prefixLen: number): string {
  if (prefixLen === 0) return col;
  return col.split("_").slice(prefixLen).join("_");
}

// Group columns by their first token after prefix stripping
interface ColumnGroup {
  key: string;
  label: string;
  columns: string[];
}

function buildGroups(cols: string[]): ColumnGroup[] {
  if (cols.length === 0) return [];
  const prefixLen = findCommonPrefixLen(cols);
  const groups = new Map<string, string[]>();
  for (const col of cols) {
    const stripped = stripPrefix(col, prefixLen);
    const firstToken = stripped.split("_")[0]!;
    if (!groups.has(firstToken)) groups.set(firstToken, []);
    groups.get(firstToken)!.push(col);
  }
  return Array.from(groups.entries()).map(([key, columns]) => ({
    key,
    label: key.toUpperCase(),
    columns,
  }));
}

function buildLabels(cols: string[]): Record<string, string> {
  const prefixLen = findCommonPrefixLen(cols);
  return Object.fromEntries(cols.map((c) => [c, stripPrefix(c, prefixLen)]));
}

const columnGroups = computed(() => buildGroups(availableColumns.value));
const signalGroups = computed(() => buildGroups(signalColumns.value));

const groupLabels = computed<Record<string, string>>(() => {
  const labels = configPlugin.value?.column_group_labels ?? {};
  const result: Record<string, string> = {};
  for (const group of [...columnGroups.value, ...signalGroups.value]) {
    result[group.key] = labels[group.key] ?? group.label;
  }
  return result;
});

const columnLabels = computed(() => buildLabels(availableColumns.value));
const signalColumnLabels = computed(() => buildLabels(signalColumns.value));

// Group selection helpers (work for both plot and signal groups)
function isGroupAllSelected(group: ColumnGroup, selected: string[]): boolean {
  return group.columns.every((c) => selected.includes(c));
}

function isGroupPartiallySelected(group: ColumnGroup, selected: string[]): boolean {
  const count = group.columns.filter((c) => selected.includes(c)).length;
  return count > 0 && count < group.columns.length;
}

function toggleGroup(group: ColumnGroup) {
  if (isGroupAllSelected(group, selectedColumns.value)) {
    selectedColumns.value = selectedColumns.value.filter(
      (c) => !group.columns.includes(c)
    );
  } else {
    const toAdd = group.columns.filter((c) => !selectedColumns.value.includes(c));
    selectedColumns.value.push(...toAdd);
  }
}

function toggleSignalGroup(group: ColumnGroup) {
  if (isGroupAllSelected(group, selectedSignals.value)) {
    selectedSignals.value = selectedSignals.value.filter(
      (c: string) => !group.columns.includes(c)
    );
  } else {
    const toAdd = group.columns.filter((c) => !selectedSignals.value.includes(c));
    selectedSignals.value.push(...toAdd);
  }
}

function colorInputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

// Overlay on main chart toggle
const isMainOverlay = ref(false);

const adding = ref(false);
const totalSelected = computed(() => selectedColumns.value.length + selectedSignals.value.length);

const confirmButtonLabel = computed(() => {
  const cols = selectedColumns.value.length;
  const sigs = selectedSignals.value.length;
  const verb = editingIndicatorId.value ? "Update" : "Add";
  if (cols > 0 && sigs > 0) return `${verb} ${cols} columns + ${sigs} signals`;
  if (sigs > 0) return `${verb} ${sigs} signal${sigs !== 1 ? "s" : ""}`;
  return `${verb} ${cols} column${cols !== 1 ? "s" : ""}`;
});

async function confirmAdd() {
  if (!configPlugin.value || totalSelected.value === 0) return;
  adding.value = true;
  try {
    if (editingIndicatorId.value) {
      // Edit mode: emit update for the existing indicator
      const id = editingIndicatorId.value;
      if (selectedColumns.value.length > 0) {
        const colors: Record<string, string> = {};
        for (const col of selectedColumns.value) {
          colors[col] = columnColors.value[col] ?? "#2196F3";
        }
        emit("update", id, configPlugin.value, { ...configParams.value }, [...selectedColumns.value], colors, isMainOverlay.value);
      }
      if (selectedSignals.value.length > 0) {
        const colors: Record<string, string> = {};
        for (const col of selectedSignals.value) {
          colors[col] = signalColors.value[col] ?? "#4CAF50";
        }
        emit("update-signal", id, configPlugin.value, { ...configParams.value }, [...selectedSignals.value], colors);
      }
    } else {
      // Add mode
      if (selectedColumns.value.length > 0) {
        const colors: Record<string, string> = {};
        for (const col of selectedColumns.value) {
          colors[col] = columnColors.value[col] ?? "#2196F3";
        }
        emit("add", configPlugin.value, { ...configParams.value }, [...selectedColumns.value], colors, isMainOverlay.value);
      }
      if (selectedSignals.value.length > 0) {
        const colors: Record<string, string> = {};
        for (const col of selectedSignals.value) {
          colors[col] = signalColors.value[col] ?? "#4CAF50";
        }
        emit("add-signal", configPlugin.value, { ...configParams.value }, [...selectedSignals.value], colors);
      }
    }
    configPlugin.value = null;
    editingIndicatorId.value = null;
    columnsLoaded.value = false;
    isMainOverlay.value = false;
  } finally {
    adding.value = false;
  }
}
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <h3 class="text-lg font-semibold text-white">Indicators</h3>
    </template>

    <template #body>
      <!-- Config mode -->
      <template v-if="configPlugin">
        <div class="mb-4 flex items-center gap-2">
          <UButton
            icon="i-heroicons-arrow-left"
            variant="ghost"
            @click="cancelConfig"
          />
          <h4 class="font-medium text-white">
            {{ configPlugin.name }}
            <span v-if="editingIndicatorId" class="text-xs text-gray-400 font-normal ml-1">(bearbeiten)</span>
          </h4>
        </div>

        <!-- Tabs: Parameters | Plot -->
        <UTabs
          v-model="configTab"
          :items="configTabs"
          :content="false"
          class="mb-4"
        />

        <!-- Tab: Parameters -->
        <div v-if="configTab === 'parameters'">
          <div v-if="configParamNames.length" class="space-y-4">
            <StrategyParamField
              v-for="name in configParamNames"
              :key="name"
              :name="name"
              :schema="configSchema[name]!"
              :model-value="configParams[name]"
              @update:model-value="configParams[name] = $event"
            />
          </div>
          <div v-else class="text-gray-400 text-sm py-4">
            No configurable parameters.
          </div>
        </div>

        <!-- Tab: Plot columns -->
        <div v-if="configTab === 'plot'">
          <div v-if="columnsLoading" class="flex items-center gap-2 text-gray-400 text-sm py-4">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin" />
            Loading columns...
          </div>

          <div v-else-if="columnsLoaded && availableColumns.length === 0 && signalColumns.length === 0" class="py-4">
            <div class="text-center mb-4">
              <UIcon name="i-heroicons-exclamation-triangle" class="text-amber-500 text-2xl mb-2" />
              <p class="text-sm text-gray-300">Keine Daten verfügbar.</p>
              <p class="text-xs text-gray-400 mt-1">
                Dieses Plugin benötigt andere Indikatoren als Input und kann nicht isoliert berechnet werden.
              </p>
            </div>
            <div v-if="configPlugin?.feature_columns?.length" class="text-left">
              <p class="text-xs text-gray-400 mb-1.5">Erwartete Spalten ({{ configPlugin.feature_columns.length }}):</p>
              <div class="text-xs text-gray-300 font-mono max-h-48 overflow-y-auto space-y-0.5 bg-gray-900/50 rounded-md p-2">
                <div v-for="col in configPlugin.feature_columns" :key="col">{{ col }}</div>
              </div>
            </div>
            <UButton
              class="w-full mt-4"
              variant="soft"
              icon="i-heroicons-puzzle-piece"
              @click="emit('add-all-deps', configPlugin!); cancelConfig()"
            >
              Alle Indikator-Plugins hinzufügen
            </UButton>
          </div>

          <template v-else-if="columnsLoaded && (availableColumns.length > 0 || signalColumns.length > 0)">
            <!-- Global select all/none -->
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs text-gray-500">
                {{ totalSelected }} / {{ availableColumns.length + signalColumns.length }}
              </span>
              <div class="flex gap-1">
                <UButton
                  variant="ghost"
                  @click="selectedColumns = [...availableColumns]; selectedSignals = [...signalColumns]"
                >
                  All
                </UButton>
                <UButton
                  variant="ghost"
                  @click="selectedColumns = []; selectedSignals = []"
                >
                  None
                </UButton>
              </div>
            </div>

            <!-- Plot columns (only if plot columns exist) -->
            <template v-if="availableColumns.length > 0">
            <!-- Grouped columns -->
            <div class="space-y-2">
              <div v-for="group in columnGroups" :key="group.key">
                <!-- Group header -->
                <div
                  class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/50 cursor-pointer"
                  @click="toggleGroup(group)"
                >
                  <UCheckbox
                    :model-value="isGroupAllSelected(group, selectedColumns)"
                    :indeterminate="isGroupPartiallySelected(group, selectedColumns)"
                    @click.stop
                    @update:model-value="toggleGroup(group)"
                  />
                  <span class="text-xs font-semibold text-gray-400 tracking-wider flex-1">
                    {{ groupLabels[group.key] }}
                  </span>
                  <span class="text-xs text-gray-600">
                    {{ group.columns.filter(c => selectedColumns.includes(c)).length }}/{{ group.columns.length }}
                  </span>
                </div>
                <!-- Group columns -->
                <div class="ml-4 space-y-0">
                  <div
                    v-for="col in group.columns"
                    :key="col"
                    class="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-800/50 cursor-pointer"
                    @click="toggleColumn(col)"
                  >
                    <UCheckbox
                      :model-value="selectedColumns.includes(col)"
                      @click.stop
                      @update:model-value="toggleColumn(col)"
                    />
                    <span class="text-sm text-gray-300 font-mono flex-1">
                      {{ columnLabels[col] }}
                    </span>
                    <input
                      type="color"
                      :value="columnColors[col]"
                      class="w-5 h-5 rounded cursor-pointer border-0 bg-transparent shrink-0"
                      @input="columnColors[col] = colorInputValue($event)"
                      @click.stop
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Overlay toggle -->
            <div class="mt-4 pt-3 border-t border-gray-800/50">
              <label class="flex items-center gap-2 cursor-pointer">
                <UCheckbox v-model="isMainOverlay" />
                <span class="text-sm text-gray-300">Auf Hauptchart</span>
              </label>
              <p class="text-xs text-gray-500 mt-1 ml-6">
                Overlay auf dem Candlestick-Chart statt eigenem Pane
              </p>
            </div>
            </template>

            <!-- Signal columns section -->
            <div v-if="signalColumns.length > 0" class="mt-4 pt-3 border-t border-gray-800/50">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-signal" class="text-amber-500" />
                  <span class="text-xs font-semibold text-gray-400 tracking-wider">SIGNALS</span>
                </div>
                <span class="text-xs text-gray-600">
                  {{ selectedSignals.length }} / {{ signalColumns.length }}
                </span>
              </div>

              <div class="space-y-2">
                <div v-for="group in signalGroups" :key="group.key">
                  <!-- Signal group header -->
                  <div
                    class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/50 cursor-pointer"
                    @click="toggleSignalGroup(group)"
                  >
                    <UCheckbox
                      :model-value="isGroupAllSelected(group, selectedSignals)"
                      :indeterminate="isGroupPartiallySelected(group, selectedSignals)"
                      @click.stop
                      @update:model-value="toggleSignalGroup(group)"
                    />
                    <span class="text-xs font-semibold text-gray-400 tracking-wider flex-1">
                      {{ groupLabels[group.key] }}
                    </span>
                    <span class="text-xs text-gray-600">
                      {{ group.columns.filter(c => selectedSignals.includes(c)).length }}/{{ group.columns.length }}
                    </span>
                  </div>
                  <!-- Signal group columns -->
                  <div class="ml-4 space-y-0">
                    <div
                      v-for="col in group.columns"
                      :key="col"
                      class="flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-800/50 cursor-pointer"
                      @click="toggleSignal(col)"
                    >
                      <UCheckbox
                        :model-value="selectedSignals.includes(col)"
                        @click.stop
                        @update:model-value="toggleSignal(col)"
                      />
                      <span class="text-sm text-gray-300 font-mono flex-1">
                        {{ signalColumnLabels[col] }}
                      </span>
                      <input
                        type="color"
                        :value="signalColors[col]"
                        class="w-5 h-5 rounded cursor-pointer border-0 bg-transparent shrink-0"
                        @input="signalColors[col] = colorInputValue($event)"
                        @click.stop
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- Browse mode -->
      <template v-else>
        <!-- Search -->
        <div class="mb-3">
          <UInput
            v-model="search"
            icon="i-heroicons-magnifying-glass"
            placeholder="Suchen..."
            class="w-full"
          >
            <template v-if="search" #trailing>
              <UButton
                icon="i-heroicons-x-mark"
                variant="link"
                color="neutral"
                size="xs"
                @click="search = ''"
              />
            </template>
          </UInput>
        </div>

        <!-- Filters row -->
        <div class="flex gap-2 mb-3">
          <!-- Type filter chips -->
          <div class="flex gap-1.5">
            <UButton
              :variant="typeFilter === '' ? 'solid' : 'ghost'"
              @click="typeFilter = ''"
            >
              Alle
            </UButton>
            <UButton
              :variant="typeFilter === 'indicator' ? 'solid' : 'ghost'"
              @click="typeFilter = 'indicator'"
            >
              <UIcon name="i-lucide-line-chart" class="mr-1" />
              IND
            </UButton>
            <UButton
              :variant="typeFilter === 'signal' ? 'solid' : 'ghost'"
              @click="typeFilter = 'signal'"
            >
              <UIcon name="i-lucide-zap" class="mr-1" />
              SIG
            </UButton>
          </div>

          <!-- Group filter -->
          <USelect
            v-if="availableGroups.length > 1"
            v-model="groupFilter"
            :items="groupFilterOptions"
            value-key="value"
            class="ml-auto"
          />
        </div>

        <!-- Indicator list -->
        <div class="space-y-0.5">
          <div
            v-for="entry in filteredEntries"
            :key="entry.id"
            class="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
            @click="startConfig(entry)"
          >
            <div class="flex-1 min-w-0">
              <span class="text-sm text-white">{{ entry.label }}</span>
              <p v-if="entry.plugin.description" class="text-xs text-gray-500 truncate">
                {{ entry.plugin.description }}
              </p>
            </div>
            <span
              v-if="entry.pluginType === 'signal' || entry.pluginType === 'both'"
              class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 shrink-0"
            >
              SIG
            </span>
            <span
              v-if="entry.pluginType === 'indicator' || entry.pluginType === 'both'"
              class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 shrink-0"
            >
              IND
            </span>
          </div>

          <div
            v-if="filteredEntries.length === 0"
            class="text-gray-400 text-sm py-4 text-center"
          >
            Keine Indikatoren gefunden.
          </div>
        </div>
      </template>
    </template>

    <template v-if="configPlugin" #footer>
      <UButton
        :loading="adding"
        :disabled="!columnsLoaded || totalSelected === 0"
        class="w-full"
        @click="confirmAdd"
      >
        <template v-if="columnsLoaded">
          {{ confirmButtonLabel }}
        </template>
        <template v-else>
          Loading...
        </template>
      </UButton>
    </template>
  </USlideover>
</template>
