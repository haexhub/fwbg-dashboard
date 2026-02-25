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
  result?: number;
  pnl_raw?: number;
}

interface ProgressResponse {
  status?: string;
  progress?: number; // 0–1
  message?: string;
  current_asset?: string;
}

// ── State ──

type PanelStatus = "idle" | "running" | "done" | "error";

const selectedAsset = ref(props.availableAssets[0] ?? "");
const daysLimit = ref(60);
const panelStatus = ref<PanelStatus>("idle");
const runId = ref<string | null>(null);
const progressPct = ref(0);
const progressMessage = ref("");
const trades = ref<TradeEntry[]>([]);
const errorMessage = ref("");

let pollTimer: ReturnType<typeof setInterval> | null = null;

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

onUnmounted(() => stopPolling());

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

function formatTime(ts?: string): string {
  if (!ts) return "-";
  return new Date(parseUTC(ts)).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stopPolling() {
  if (pollTimer != null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ── Preview logic ──

async function pollProgress() {
  if (!runId.value) return;
  try {
    const res = await $fetch<ProgressResponse>(
      `/api/runs/${runId.value}/progress`,
    );
    progressPct.value = Math.round((res.progress ?? 0) * 100);
    progressMessage.value = res.message ?? res.current_asset ?? "";
    const s = res.status ?? "running";
    if (s === "completed") {
      stopPolling();
      await loadTrades();
      panelStatus.value = "done";
    } else if (s === "failed" || s === "cancelled") {
      stopPolling();
      errorMessage.value = `Run ${s}`;
      panelStatus.value = "error";
    }
  } catch (e: unknown) {
    stopPolling();
    const err = e as { statusMessage?: string; message?: string };
    errorMessage.value =
      err?.statusMessage ?? err?.message ?? "Fortschritt konnte nicht abgerufen werden";
    panelStatus.value = "error";
  }
}

async function loadTrades() {
  if (!runId.value || !effectiveAsset.value) return;
  try {
    const res = await $fetch<{ trades: TradeEntry[] }>(
      `/api/runs/${runId.value}/trades/${effectiveAsset.value}`,
    );
    trades.value = (res.trades ?? []).sort((a, b) => {
      if (!a.entry_time || !b.entry_time) return 0;
      return parseUTC(a.entry_time) - parseUTC(b.entry_time);
    });
  } catch {
    trades.value = [];
  }
}

async function startPreview() {
  const asset = effectiveAsset.value;
  if (!asset) return;

  stopPolling();
  panelStatus.value = "running";
  runId.value = null;
  trades.value = [];
  errorMessage.value = "";
  progressPct.value = 0;
  progressMessage.value = "";

  try {
    const res = await $fetch<{ run_id?: string; job_id?: string }>(
      "/api/strategy/preview",
      {
        method: "POST",
        body: {
          strategy_name: props.strategyName,
          asset,
          days_limit: daysLimit.value,
        },
      },
    );
    runId.value = res.run_id ?? res.job_id ?? null;
    if (!runId.value) throw new Error("Keine Run-ID vom Backend erhalten");

    // Immediate check + recurring poll
    await pollProgress();
    if (panelStatus.value === "running") {
      pollTimer = setInterval(pollProgress, 2000);
    }
  } catch (e: unknown) {
    panelStatus.value = "error";
    const err = e as { statusMessage?: string; message?: string };
    errorMessage.value =
      err?.statusMessage ?? err?.message ?? "Vorschau konnte nicht gestartet werden";
  }
}

function openInChart() {
  if (!runId.value || !effectiveAsset.value) return;
  const params = new URLSearchParams({ run: runId.value, symbol: effectiveAsset.value });
  if (props.datasource) params.set("source", props.datasource);
  window.open(`/chart?${params}`, "_blank");
}
</script>

<template>
  <USlideover :open="open" @update:open="emit('update:open', $event)">
    <template #header>
      <div>
        <h3 class="text-lg font-semibold text-white">Pipeline-Vorschau</h3>
        <p class="text-xs text-gray-500 mt-0.5">
          Erste 60 Tage &middot; {{ strategyName }}
        </p>
      </div>
    </template>

    <template #body>
      <div class="space-y-5 p-1">

        <!-- Asset + Days -->
        <div class="flex gap-3">
          <UFormField label="Asset" class="flex-1">
            <USelect
              v-if="availableAssets.length > 0"
              v-model="selectedAsset"
              :items="assetItems"
              value-key="value"
              :disabled="panelStatus === 'running'"
              class="w-full"
            />
            <p v-else class="text-xs text-gray-500">
              Keine Assets konfiguriert. Bitte zuerst im Assets-Tab Asset-Klassen anlegen.
            </p>
          </UFormField>
          <UFormField label="Tage" class="w-24">
            <UInput
              v-model.number="daysLimit"
              type="number"
              :min="1"
              :disabled="panelStatus === 'running'"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Action -->
        <UButton
          :loading="panelStatus === 'running'"
          :disabled="!effectiveAsset || panelStatus === 'running'"
          icon="i-lucide-play"
          @click="startPreview"
        >
          Vorschau starten
        </UButton>

        <!-- Progress bar -->
        <div v-if="panelStatus === 'running'" class="space-y-1.5">
          <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              class="h-full bg-blue-500 rounded-full transition-all duration-300"
              :style="{ width: progressPct > 0 ? `${progressPct}%` : '100%' }"
              :class="progressPct === 0 ? 'animate-pulse' : ''"
            />
          </div>
          <p class="text-xs text-gray-400">
            {{ progressMessage || "Signale werden berechnet…" }}
          </p>
        </div>

        <!-- Error -->
        <div
          v-if="panelStatus === 'error'"
          class="rounded-md bg-red-900/30 border border-red-700/40 p-3"
        >
          <p class="text-sm text-red-300">{{ errorMessage }}</p>
        </div>

        <!-- Results -->
        <template v-if="panelStatus === 'done'">
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
            Keine Einstiegssignale in den ersten 60 Tagen gefunden.
          </p>

          <!-- Entry signals table -->
          <div v-else class="overflow-y-auto max-h-[55vh] rounded border border-gray-800">
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-gray-900 z-10">
                <tr class="text-gray-500 text-left">
                  <th class="px-3 py-2 font-normal">Einstieg</th>
                  <th class="px-3 py-2 font-normal">Richtung</th>
                  <th class="px-3 py-2 font-normal text-right">Kurs</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-800/60">
                <tr
                  v-for="(trade, i) in trades"
                  :key="i"
                  class="hover:bg-gray-800/40 transition-colors"
                >
                  <td class="px-3 py-1.5 text-gray-300 font-mono">
                    {{ formatTime(trade.entry_time) }}
                  </td>
                  <td class="px-3 py-1.5">
                    <span
                      :class="
                        trade.direction === 'LONG'
                          ? 'text-green-400'
                          : 'text-red-400'
                      "
                      class="font-medium"
                    >
                      {{ trade.direction === "LONG" ? "▲ Long" : "▼ Short" }}
                    </span>
                  </td>
                  <td class="px-3 py-1.5 text-right text-gray-300 font-mono">
                    {{ trade.entry_price?.toFixed(5) ?? "-" }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Open in chart -->
          <UButton
            icon="i-lucide-external-link"
            variant="outline"
            class="w-full justify-center"
            @click="openInChart"
          >
            Im Chart anzeigen
          </UButton>
        </template>

      </div>
    </template>
  </USlideover>
</template>
