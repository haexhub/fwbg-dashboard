<script setup lang="ts">
import { onKeyStroke } from "@vueuse/core";
import type { ChartSource } from "~/types/chart";

definePageMeta({ layout: "builder" });

const route = useRoute();
const strategyName = computed(() => route.params.name as string);

const store = useStrategyConfigStore();
const { config, isDirty, canUndo, canRedo } = storeToRefs(store);
const { load, save, resetToSaved, undo, redo } = store;
const pluginStore = usePluginStore();
const { plugins } = storeToRefs(pluginStore);
pluginStore.load();

// Load strategy — blocks SSR so children have data
await load(strategyName.value);

const saving = ref(false);

async function handleSave() {
  saving.value = true;
  try {
    await save();
  } finally {
    saving.value = false;
  }
}

// Run modal
const runModalOpen = ref(false);

// Preview panel
const previewPanelOpen = ref(false);
const previewAssets = computed<string[]>(() => config.value?.assets?.filter ?? []);
const isSignalModel = computed(() => config.value?.model?.type === "signal");

// ── Open in Chart ──
const { data: chartSources } = useFetch<ChartSource[]>("/api/chart/sources", {
  default: () => [],
});

const chartSymbols = computed(() => {
  const ds = config.value?.datasource;
  if (!ds) return [];
  const src = chartSources.value.find((s: ChartSource) => s.name === ds);
  if (!src) return [];

  const filterSet = config.value?.assets?.filter?.length
    ? new Set(config.value.assets.filter)
    : null;
  const excludeSet = config.value?.assets?.exclude?.length
    ? new Set(config.value.assets.exclude)
    : null;

  return src.symbols.filter((s: { symbol: string; asset_class?: string }) => {
    if (filterSet && !filterSet.has(s.symbol)) return false;
    if (excludeSet && excludeSet.has(s.symbol)) return false;
    return true;
  });
});

const chartMenuItems = computed(() => {
  const groups = new Map<string, { label: string; onSelect: () => void }[]>();
  for (const sym of chartSymbols.value) {
    const cls = sym.asset_class ?? "Other";
    if (!groups.has(cls)) groups.set(cls, []);
    groups.get(cls)!.push({
      label: sym.symbol,
      onSelect: () => openInChart(sym.symbol),
    });
  }
  return [...groups.values()];
});

function openInChart(sym: string) {
  const pipelineEntries = config.value?.pipeline?.indicators ?? [];
  const indicators = pipelineEntries
    .map((e: { name: string; params: Record<string, unknown>; is_signal?: boolean }) => {
      const plugin = plugins.value?.find((p: { name: string; fqn: string; defaults: Record<string, unknown> }) => p.name === e.name);
      if (!plugin) return null;
      return {
        fqn: plugin.fqn,
        params: { ...plugin.defaults, ...e.params },
        columns: [],
        isSignal: !!e.is_signal,
      };
    })
    .filter(Boolean);

  navigateTo({
    path: "/chart",
    query: {
      source: config.value?.datasource,
      symbol: sym,
      timeframe: config.value?.timeframe,
      ...(indicators.length > 0
        ? { indicators: JSON.stringify(indicators) }
        : {}),
    },
  });
}

function handleRunStarted(_jobId: string) {
  navigateTo("/runs");
}

// Tab navigation
const tabs = [
  { label: "Übersicht", to: `/strategy/${strategyName.value}` },
  { label: "Pipeline", to: `/strategy/${strategyName.value}/pipeline` },
  { label: "Model", to: `/strategy/${strategyName.value}/model` },
  { label: "Optimization", to: `/strategy/${strategyName.value}/optimization` },
  { label: "Assets", to: `/strategy/${strategyName.value}/grids` },
  { label: "Validation", to: `/strategy/${strategyName.value}/validation` },
  { label: "Filters", to: `/strategy/${strategyName.value}/filters` },
  { label: "Resources", to: `/strategy/${strategyName.value}/resources` },
];

// ── Keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y) ──
const isFormEl = (t: EventTarget | null) =>
  ["INPUT", "TEXTAREA", "SELECT"].includes((t as HTMLElement)?.tagName);
const isMod = (e: KeyboardEvent) => e.ctrlKey || e.metaKey;

onKeyStroke("z", (e) => {
  if (!isMod(e) || e.shiftKey || isFormEl(e.target)) return;
  e.preventDefault();
  undo();
});

onKeyStroke("z", (e) => {
  if (!isMod(e) || !e.shiftKey || isFormEl(e.target)) return;
  e.preventDefault();
  redo();
});

onKeyStroke("y", (e) => {
  if (!isMod(e) || isFormEl(e.target)) return;
  e.preventDefault();
  redo();
});
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- Header Bar -->
    <div class="flex items-center justify-between pb-3 shrink-0">
      <div class="flex items-center gap-4">
        <NuxtLink to="/strategy">
          <UButton icon="i-heroicons-arrow-left" variant="ghost" />
        </NuxtLink>
        <h2 class="text-xl font-semibold text-white">
          {{ config?.name ?? strategyName }}
        </h2>
        <UBadge v-if="isDirty" color="warning" variant="subtle" size="xs">
          unsaved
        </UBadge>
      </div>
      <ClientOnly>
        <div class="flex gap-3">
          <!-- Undo / Redo -->
          <div class="flex gap-1">
            <span data-testid="undo-btn">
              <UButton
                icon="i-heroicons-arrow-uturn-left"
                variant="ghost"
                :disabled="!canUndo"
                @click="undo"
              />
            </span>
            <span data-testid="redo-btn">
              <UButton
                icon="i-heroicons-arrow-uturn-right"
                variant="ghost"
                :disabled="!canRedo"
                @click="redo"
              />
            </span>
          </div>
          <!-- Reset -->
          <span data-testid="reset-btn">
            <UButton
              icon="i-heroicons-x-mark"
              variant="ghost"
              color="warning"
              :disabled="!isDirty"
              @click="resetToSaved"
            >
              Reset
            </UButton>
          </span>
          <!-- Save / Chart / Run -->
          <UButton
            icon="i-heroicons-check"
            :loading="saving"
            :disabled="!isDirty || saving"
            @click="handleSave"
          >
            Save
          </UButton>
          <!-- Open in Chart -->
          <UDropdownMenu
            v-if="chartSymbols.length > 1"
            :items="chartMenuItems"
          >
            <UButton
              icon="i-lucide-line-chart"
              variant="ghost"
            >
              Chart
            </UButton>
          </UDropdownMenu>
          <UButton
            v-else-if="chartSymbols.length === 1"
            icon="i-lucide-line-chart"
            variant="ghost"
            @click="openInChart(chartSymbols[0]?.symbol ?? '')"
          >
            Chart
          </UButton>
          <template v-if="isSignalModel">
            <UTooltip
              v-if="isDirty"
              text="Bitte zuerst alle Änderungen speichern"
            >
              <UButton
                icon="i-lucide-eye"
                variant="ghost"
                disabled
              >
                Vorschau
              </UButton>
            </UTooltip>
            <UButton
              v-else
              icon="i-lucide-eye"
              variant="ghost"
              :disabled="!config"
              @click="previewPanelOpen = true"
            >
              Vorschau
            </UButton>
          </template>
          <UTooltip
            v-if="isDirty"
            text="Bitte zuerst alle Änderungen speichern"
          >
            <UButton
              icon="i-heroicons-play"
              color="success"
              variant="soft"
              disabled
            >
              Run
            </UButton>
          </UTooltip>
          <UButton
            v-else
            icon="i-heroicons-play"
            color="success"
            variant="soft"
            :disabled="!config"
            @click="runModalOpen = true"
          >
            Run
          </UButton>
        </div>
      </ClientOnly>
    </div>

    <!-- Tab Navigation -->
    <nav class="flex border-b border-gray-800 pb-2 mb-0 shrink-0">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        :class="[
          'flex-1 text-center py-1.5 text-sm rounded-md transition-colors whitespace-nowrap',
          route.path === tab.to
            ? 'bg-gray-700 text-white'
            : 'text-gray-400 hover:text-white hover:bg-gray-800',
        ]"
      >
        {{ tab.label }}
      </NuxtLink>
    </nav>

    <!-- Loading state -->
    <div
      v-if="!config"
      class="flex-1 flex items-center justify-center text-gray-400"
    >
      Loading strategy...
    </div>

    <!-- Child pages -->
    <div v-else class="flex-1 min-h-0">
      <NuxtPage />
    </div>

    <!-- Preview Panel -->
    <StrategyPreviewPanel
      v-if="config"
      v-model:open="previewPanelOpen"
      :strategy-name="strategyName"
      :datasource="config.datasource"
      :available-assets="previewAssets"
    />

    <!-- Run Start Modal -->
    <RunsRunStartModal
      :open="runModalOpen"
      :strategy-name="strategyName"
      @update:open="runModalOpen = $event"
      @started="handleRunStarted"
    />
  </div>
</template>
