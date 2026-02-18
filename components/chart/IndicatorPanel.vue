<script setup lang="ts">
import type { PluginInfo, ParamSchema } from "~/types/strategy";
import type { ActiveIndicator, IndicatorResponse } from "~/types/chart";
import { LINE_COLORS } from "~/composables/useChartIndicators";

const props = defineProps<{
  open: boolean;
  plugins: PluginInfo[];
  activeIndicators: ActiveIndicator[];
  source: string;
  symbol: string;
  timeframe: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  add: [plugin: PluginInfo, params: Record<string, unknown>, columns: string[], colors: Record<string, string>];
  remove: [id: string];
}>();

// Search filter
const search = ref("");
const filteredPlugins = computed(() => {
  if (!search.value) return props.plugins;
  const q = search.value.toLowerCase();
  return props.plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.fqn.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q)
  );
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

const configSchema = computed<Record<string, ParamSchema>>(() => {
  return configPlugin.value?.param_schema ?? {};
});

const configParamNames = computed(() => Object.keys(configSchema.value));

const configTabs = computed(() => [
  { label: "Parameters", value: "parameters", icon: "i-heroicons-adjustments-horizontal" },
  {
    label: "Plot",
    value: "plot",
    icon: "i-heroicons-chart-bar",
    badge: columnsLoaded.value ? `${selectedColumns.value.length}/${availableColumns.value.length}` : undefined,
  },
]);

function startConfig(plugin: PluginInfo) {
  configPlugin.value = plugin;
  configParams.value = { ...plugin.defaults };
  configTab.value = "parameters";
  availableColumns.value = [];
  selectedColumns.value = [];
  columnsLoaded.value = false;
  fetchColumns();
}

function cancelConfig() {
  configPlugin.value = null;
  columnsLoaded.value = false;
}

async function fetchColumns() {
  if (!configPlugin.value) return;
  columnsLoading.value = true;
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
    availableColumns.value = response.plot_columns?.length
      ? response.plot_columns
      : response.columns;
    selectedColumns.value = [...availableColumns.value];
    // Assign default colors from palette
    const colors: Record<string, string> = {};
    for (let i = 0; i < availableColumns.value.length; i++) {
      colors[availableColumns.value[i]!] = LINE_COLORS[i % LINE_COLORS.length]!;
    }
    columnColors.value = colors;
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

function stripPrefix(columns: string[]): Record<string, string> {
  if (columns.length <= 1) {
    return Object.fromEntries(columns.map((c) => [c, c]));
  }
  const parts = columns.map((c) => c.split("_"));
  let commonLen = 0;
  for (let i = 0; i < parts[0]!.length - 1; i++) {
    if (parts.every((p) => p[i] === parts[0]![i])) {
      commonLen = i + 1;
    } else {
      break;
    }
  }
  return Object.fromEntries(
    columns.map((c) => [
      c,
      commonLen > 0 ? c.split("_").slice(commonLen).join("_") : c,
    ])
  );
}

const columnLabels = computed(() => stripPrefix(availableColumns.value));

const adding = ref(false);
async function confirmAdd() {
  if (!configPlugin.value || selectedColumns.value.length === 0) return;
  adding.value = true;
  try {
    // Build color map for selected columns only
    const colors: Record<string, string> = {};
    for (const col of selectedColumns.value) {
      colors[col] = columnColors.value[col] ?? "#2196F3";
    }
    emit("add", configPlugin.value, { ...configParams.value }, [...selectedColumns.value], colors);
    configPlugin.value = null;
    columnsLoaded.value = false;
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
            size="xs"
            @click="cancelConfig"
          />
          <div>
            <h4 class="font-medium text-white">{{ configPlugin.name }}</h4>
            <p v-if="configPlugin.description" class="text-xs text-gray-400">
              {{ configPlugin.description }}
            </p>
          </div>
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

          <template v-else-if="columnsLoaded && availableColumns.length > 0">
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs text-gray-500">
                {{ selectedColumns.length }} of {{ availableColumns.length }} selected
              </span>
              <div class="flex gap-1">
                <UButton
                  variant="ghost"
                  size="xs"
                  @click="selectedColumns = [...availableColumns]"
                >
                  All
                </UButton>
                <UButton
                  variant="ghost"
                  size="xs"
                  @click="selectedColumns = []"
                >
                  None
                </UButton>
              </div>
            </div>
            <div class="space-y-0.5">
              <div
                v-for="col in availableColumns"
                :key="col"
                class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-800/50 cursor-pointer"
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
                  class="w-6 h-6 rounded cursor-pointer border-0 bg-transparent shrink-0"
                  @input="columnColors[col] = ($event.target as HTMLInputElement).value"
                  @click.stop
                />
              </div>
            </div>
          </template>
        </div>

        <!-- Add button (always visible) -->
        <UButton
          :loading="adding"
          :disabled="!columnsLoaded || selectedColumns.length === 0"
          class="w-full mt-6"
          @click="confirmAdd"
        >
          <template v-if="columnsLoaded">
            Add {{ selectedColumns.length }} column{{ selectedColumns.length !== 1 ? 's' : '' }} to Chart
          </template>
          <template v-else>
            Loading...
          </template>
        </UButton>
      </template>

      <!-- Browse mode -->
      <template v-else>
        <!-- Active indicators -->
        <div v-if="activeIndicators.length > 0" class="mb-6">
          <h4 class="text-sm font-medium text-gray-400 mb-2">Active</h4>
          <div class="space-y-1">
            <div
              v-for="ind in activeIndicators"
              :key="ind.id"
              class="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-800/50"
            >
              <div>
                <span class="text-sm text-white">{{ ind.name }}</span>
                <span class="text-xs text-gray-500 ml-2">{{ ind.columns.length }} cols</span>
              </div>
              <UButton
                icon="i-heroicons-x-mark"
                variant="ghost"
                size="xs"
                color="error"
                @click="emit('remove', ind.id)"
              />
            </div>
          </div>
        </div>

        <!-- Search -->
        <UInput
          v-model="search"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search indicators..."
          size="sm"
          class="mb-4"
        />

        <!-- Available plugins -->
        <div class="space-y-1">
          <div
            v-for="plugin in filteredPlugins"
            :key="plugin.fqn"
            class="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
            @click="startConfig(plugin)"
          >
            <div class="min-w-0 flex-1">
              <div class="text-sm text-white truncate">{{ plugin.name }}</div>
              <div
                v-if="plugin.description"
                class="text-xs text-gray-500 truncate"
              >
                {{ plugin.description }}
              </div>
            </div>
            <UButton
              icon="i-heroicons-plus"
              variant="ghost"
              size="xs"
              @click.stop="startConfig(plugin)"
            />
          </div>

          <div
            v-if="filteredPlugins.length === 0"
            class="text-gray-400 text-sm py-4 text-center"
          >
            No indicators found.
          </div>
        </div>
      </template>
    </template>
  </USlideover>
</template>
