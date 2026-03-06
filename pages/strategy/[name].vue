<script setup lang="ts">
import { onKeyStroke } from "@vueuse/core";
import type { ChartSource } from "~/types/chart";

definePageMeta({ layout: "builder" });

const route = useRoute();
const strategyName = computed(() => route.params.name as string);

const store = useStrategyConfigStore();
const { config, isDirty, canUndo, canRedo } = storeToRefs(store);
const { load, saveAndCommit, saveAs, resetToSaved, undo, redo } = store;
const pluginStore = usePluginStore();
const { plugins } = storeToRefs(pluginStore);

// Load both — blocks SSR so children have data
await Promise.all([pluginStore.load(), load(strategyName.value)]);

const saving = ref(false);
const saveError = ref<string | null>(null);
const toast = useToast();

// Run modal
const runModalOpen = ref(false);

// ── Commit modal (save to current file + git commit) ──
const commitModalOpen = ref(false);
const commitMessage = ref("");

function openCommitModal() {
  commitMessage.value = "";
  saveError.value = null;
  commitModalOpen.value = true;
}

async function handleCommit() {
  saving.value = true;
  saveError.value = null;
  try {
    await saveAndCommit(commitMessage.value.trim());
    commitModalOpen.value = false;
    toast.add({ title: "Gespeichert", description: commitMessage.value || "Änderungen committed", color: "success" });
  } catch (e: unknown) {
    saveError.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

// ── Save As modal (create new config file) ──
const saveAsModalOpen = ref(false);
const saveAsName = ref("");
const saveAsError = ref<string | null>(null);

function openSaveAsModal() {
  saveAsName.value = store.filename;
  saveAsError.value = null;
  saveAsModalOpen.value = true;
}

async function handleSaveAs() {
  saving.value = true;
  saveAsError.value = null;
  try {
    const newFilename = await saveAs(saveAsName.value.trim());
    saveAsModalOpen.value = false;
    navigateTo(`/strategy/${newFilename}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    saveAsError.value = msg.includes("409") || msg.includes("already exists")
      ? "Eine Strategie mit diesem Namen existiert bereits."
      : msg;
  } finally {
    saving.value = false;
  }
}

// ── History panel ──
const historyOpen = ref(false);

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
  const indicators: Array<{ fqn: string; params: Record<string, unknown>; columns: string[]; isSignal?: boolean }> = [];
  for (const e of pipelineEntries as Array<{ name: string; params: Record<string, unknown> }>) {
    const plugin = plugins.value?.find((p: { name: string; fqn: string; defaults: Record<string, unknown> }) => p.name === e.name);
    if (!plugin) continue;
    const p = { ...plugin.defaults, ...e.params };
    indicators.push({ fqn: plugin.fqn, params: p, columns: [] });
    indicators.push({ fqn: plugin.fqn, params: p, columns: [], isSignal: true });
  }

  navigateTo({
    path: "/chart",
    query: {
      source: config.value?.datasource,
      symbol: sym,
      timeframe: config.value?.timeframe,
      strategy: strategyName.value,
      ...(indicators.length > 0
        ? { indicators: JSON.stringify(indicators) }
        : {}),
      ...(config.value?.assets?.drop_flat_bars ? { dropFlatBars: "1" } : {}),
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
          <!-- Save / History -->
          <div class="flex items-center">
            <UButton
              icon="i-heroicons-check"
              :loading="saving"
              :disabled="!isDirty || saving"
              class="rounded-r-none"
              @click="openCommitModal"
            >
              Speichern
            </UButton>
            <UDropdownMenu
              :items="[[
                { label: 'Kopie speichern unter…', icon: 'i-heroicons-document-duplicate', onSelect: openSaveAsModal },
                { label: 'Versionsverlauf', icon: 'i-heroicons-clock', onSelect: () => historyOpen = true },
              ]]"
            >
              <UButton icon="i-heroicons-chevron-down" :disabled="saving" class="rounded-l-none border-l border-l-white/20 px-1.5" />
            </UDropdownMenu>
          </div>
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
          <UButton
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

    <!-- Commit Modal -->
    <UModal v-model:open="commitModalOpen">
      <template #header>
        <h3 class="text-base font-semibold text-white">Änderungen speichern</h3>
      </template>
      <template #body>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Commit-Nachricht (optional)</label>
            <UInput
              v-model="commitMessage"
              placeholder="z.B. TP auf 8 erhöht, SL beibehalten"
              class="w-full"
              autofocus
              @keyup.enter="handleCommit"
            />
          </div>
          <p v-if="saveError" class="text-sm text-red-400">{{ saveError }}</p>
          <p class="text-xs text-gray-500">
            Speichert <span class="font-mono text-gray-300">{{ store.filename }}</span>
            und erstellt einen neuen Git-Commit.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="commitModalOpen = false">Abbrechen</UButton>
          <UButton :loading="saving" @click="handleCommit">Speichern</UButton>
        </div>
      </template>
    </UModal>

    <!-- Save As Modal -->
    <UModal v-model:open="saveAsModalOpen">
      <template #header>
        <h3 class="text-base font-semibold text-white">Kopie speichern unter…</h3>
      </template>
      <template #body>
        <div class="space-y-3">
          <div>
            <label class="block text-xs text-gray-400 mb-1">Neuer Name (Dateiname)</label>
            <UInput
              v-model="saveAsName"
              placeholder="meine-strategie"
              class="w-full font-mono"
              @keyup.enter="handleSaveAs"
            />
          </div>
          <p v-if="saveAsError" class="text-sm text-red-400">{{ saveAsError }}</p>
          <p class="text-xs text-gray-500">
            Erstellt eine neue Konfigurationsdatei. Die aktuelle Datei
            <span class="font-mono text-gray-300">{{ store.filename }}</span>
            bleibt unverändert.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="saveAsModalOpen = false">Abbrechen</UButton>
          <UButton :loading="saving" :disabled="!saveAsName.trim()" @click="handleSaveAs">
            Speichern
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- Run Start Modal -->
    <RunsRunStartModal
      v-if="strategyName"
      :open="runModalOpen"
      :strategy-name="strategyName"
      @update:open="runModalOpen = $event"
      @started="handleRunStarted"
    />

    <!-- Version History Panel -->
    <StrategyVersionHistoryPanel
      v-if="strategyName"
      v-model:open="historyOpen"
      :strategy-name="strategyName"
      @restore="(c) => { store.config = c as any; }"
    />
  </div>
</template>
