<script setup lang="ts">
const props = defineProps<{
  open: boolean;
  strategyName: string;
  datasource?: string;
  availableAssets: string[];
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

// ── Types ──

interface TradeEntry {
  entry_time?: string;
  exit_time?: string;
  entry_price?: number;
  exit_price?: number;
  direction?: "LONG" | "SHORT";
  result?: string;
  pnl_raw?: number;
  signal?: string;
}

interface PreviewResponse {
  symbol: string;
  timeframe: string;
  total_bars: number;
  trades: TradeEntry[];
  tp_used?: number;
  sl_used?: number;
}

// ── State ──

type PanelStatus = "idle" | "running" | "done" | "error";

const selectedAsset = ref(props.availableAssets[0] ?? "");
const lastNBars = ref(10000);
const panelStatus = ref<PanelStatus>("idle");
const trades = ref<TradeEntry[]>([]);
const errorMessage = ref("");
const previewMeta = ref<{ symbol?: string; timeframe?: string; totalBars?: number; tp?: number; sl?: number }>({});

// Keep selectedAsset in sync when the available list changes
watch(
  () => props.availableAssets,
  (assets) => {
    if (assets.length > 0 && !selectedAsset.value) {
      selectedAsset.value = assets[0]!;
    }
  },
  { immediate: true },
);

// ── Computed ──

const effectiveAsset = computed(() => selectedAsset.value);

const assetItems = computed(() =>
  props.availableAssets.map((a) => ({ label: a, value: a })),
);

const longCount = computed(
  () => trades.value.filter((t) => t.direction === "LONG").length,
);
const shortCount = computed(
  () => trades.value.filter((t) => t.direction === "SHORT").length,
);

// ── Helpers ──

function parseUTC(s: string): number {
  if (s.includes("Z") || s.includes("+") || /\-\d{2}:\d{2}$/.test(s)) {
    return new Date(s).getTime();
  }
  return new Date(s + "Z").getTime();
}

const { set: setPreviewTrades } = usePreviewTrades();
const store = useStrategyConfigStore();
const { plugins } = storeToRefs(usePluginStore());

function openInChart() {
  const markers = trades.value
    .filter((t: TradeEntry) => t.entry_time && t.entry_price != null)
    .map((t: TradeEntry) => ({
      entryTime: parseUTC(t.entry_time!),
      exitTime: t.exit_time ? parseUTC(t.exit_time) : parseUTC(t.entry_time!),
      entryPrice: t.entry_price!,
      exitPrice: t.exit_price ?? t.entry_price!,
      direction: (t.direction ?? "LONG") as "LONG" | "SHORT",
      result: 0,
      pnlRaw: t.pnl_raw ?? 0,
    }));

  setPreviewTrades({ strategyName: props.strategyName, markers });

  // Resolve pipeline indicator names to FQN for chart URL restore
  const pipelineEntries = store.config?.pipeline?.indicators ?? [];
  const indicators = pipelineEntries
    .map((e: { name: string; params: Record<string, unknown> }) => {
      const plugin = plugins.value?.find((p: { name: string; fqn: string; defaults: Record<string, unknown> }) => p.name === e.name);
      if (!plugin) return null;
      return { fqn: plugin.fqn, params: { ...plugin.defaults, ...e.params }, columns: [], isSignal: false };
    })
    .filter(Boolean);

  navigateTo({
    path: "/chart",
    query: {
      source: props.datasource,
      symbol: previewMeta.value.symbol,
      timeframe: previewMeta.value.timeframe,
      ...(indicators.length > 0 ? { indicators: JSON.stringify(indicators) } : {}),
    },
  });
}

// ── Preview logic ──

async function startPreview() {
  const asset = effectiveAsset.value;
  if (!asset) return;

  panelStatus.value = "running";
  trades.value = [];
  errorMessage.value = "";
  previewMeta.value = {};

  try {
    const res = await $fetch<PreviewResponse>(
      "/api/strategy/preview",
      {
        method: "POST",
        body: {
          strategy_name: props.strategyName,
          asset,
          last_n_bars: lastNBars.value || undefined,
        },
      },
    );

    trades.value = (res.trades ?? []).sort((a, b) => {
      if (!a.entry_time || !b.entry_time) return 0;
      return parseUTC(a.entry_time) - parseUTC(b.entry_time);
    });

    previewMeta.value = {
      symbol: res.symbol,
      timeframe: res.timeframe,
      totalBars: res.total_bars,
      tp: res.tp_used,
      sl: res.sl_used,
    };

    panelStatus.value = "done";
  } catch (e: unknown) {
    panelStatus.value = "error";
    const err = e as { statusMessage?: string; message?: string; data?: { detail?: string } };
    errorMessage.value =
      err?.data?.detail ?? err?.statusMessage ?? err?.message ?? "Vorschau konnte nicht gestartet werden";
  }
}
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <div>
        <h3 class="text-lg font-semibold text-white">Pipeline-Vorschau</h3>
        <p class="text-xs text-gray-500 mt-0.5">{{ strategyName }}</p>
      </div>
    </template>

    <template #body>
      <div class="space-y-5 p-1">

        <!-- Asset -->
        <UFormField label="Asset">
          <USelect
            v-if="availableAssets.length > 0"
            v-model="selectedAsset"
            :items="assetItems"
            value-key="value"
            :disabled="panelStatus === 'running'"
            class="w-full"
          />
          <p v-else class="text-xs text-gray-500">
            Keine Assets konfiguriert. Bitte zuerst im Assets-Tab Assets hinzufügen.
          </p>
        </UFormField>

        <!-- Bars limit -->
        <UFormField label="Letzte N Bars">
          <UInput
            v-model.number="lastNBars"
            type="number"
            :min="1000"
            :step="1000"
            :disabled="panelStatus === 'running'"
            class="w-full"
          />
        </UFormField>

        <!-- Action -->
        <UButton
          :loading="panelStatus === 'running'"
          :disabled="!effectiveAsset || panelStatus === 'running'"
          icon="i-lucide-play"
          @click="startPreview"
        >
          Vorschau starten
        </UButton>

        <!-- Progress -->
        <div v-if="panelStatus === 'running'" class="space-y-1.5">
          <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-blue-500 rounded-full animate-pulse"
              style="width: 100%"
            />
          </div>
          <p class="text-xs text-gray-400">
            Signale werden berechnet…
          </p>
        </div>

        <!-- Error -->
        <template v-if="panelStatus === 'error'">
          <div class="rounded-md bg-red-900/30 border border-red-700/40 p-3">
            <p class="text-sm text-red-300">{{ errorMessage }}</p>
          </div>
        </template>

        <!-- Results -->
        <template v-if="panelStatus === 'done'">
          <!-- Meta info -->
          <div v-if="previewMeta.timeframe" class="text-xs text-gray-500">
            {{ previewMeta.totalBars?.toLocaleString() }} Bars
            <span v-if="previewMeta.tp"> · TP {{ previewMeta.tp }} / SL {{ previewMeta.sl }}</span>
          </div>

          <!-- Stats row -->
          <div class="flex gap-3 text-sm">
            <div class="bg-gray-800/60 rounded px-3 py-2 min-w-[4rem] text-center">
              <p class="text-gray-400 text-xs mb-0.5">Gesamt</p>
              <p class="text-white font-semibold">{{ trades.length }}</p>
            </div>
            <div
              class="bg-green-900/20 border border-green-700/30 rounded px-3 py-2 min-w-[4rem] text-center"
            >
              <p class="text-gray-400 text-xs mb-0.5">Long ▲</p>
              <p class="text-green-400 font-semibold">{{ longCount }}</p>
            </div>
            <div
              class="bg-red-900/20 border border-red-700/30 rounded px-3 py-2 min-w-[4rem] text-center"
            >
              <p class="text-gray-400 text-xs mb-0.5">Short ▼</p>
              <p class="text-red-400 font-semibold">{{ shortCount }}</p>
            </div>
          </div>

          <!-- No signals -->
          <p v-if="trades.length === 0" class="text-sm text-gray-400">
            Keine Einstiegssignale gefunden.
          </p>

          <!-- Show in chart -->
          <UButton
            v-if="trades.length > 0 && previewMeta.symbol"
            icon="i-lucide-line-chart"
            variant="soft"
            block
            @click="openInChart"
          >
            Im Chart anzeigen
          </UButton>
        </template>

      </div>
    </template>
  </USlideover>
</template>
