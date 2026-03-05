<script setup lang="ts">
import { statusColor } from "~/types/strategy";
import { aggregatePerformance } from "~/composables/useRunPerformance";

const route = useRoute();
const runId = computed(() => route.params.id as string);

// Performance data (completed runs)
const { detail, gridDetails, performance, load } =
  useRunPerformance(runId.value);

// Progress data (active runs)
const {
  progress,
  logs,
  isTerminal,
  assetList,
  availableSymbols,
  logLevelFilter,
  logSymbolFilter,
  init: initProgress,
} = useRunProgress(runId.value);

// ── View mode state machine ──
const viewMode = computed<
  "loading" | "progress" | "performance" | "failed"
>(() => {
  const status = progress.value?.status ?? detail.value?.status;

  if (status === "initializing" || status === "running") return "progress";
  if (status === "failed") return "failed";
  if (status === "completed" && performance.value) return "performance";

  return "loading";
});

const displayStatus = computed(
  () => progress.value?.status ?? detail.value?.status,
);

const strategyName = computed(
  () => progress.value?.strategy_name ?? detail.value?.strategy?.name,
);

// When run completes, load performance data
watch(isTerminal, (terminal) => {
  if (terminal && progress.value?.status === "completed") {
    load();
  }
});

onMounted(async () => {
  await initProgress();

  // If already completed, load performance data right away
  if (isTerminal.value) {
    load();
  }
});

// ── Performance tab logic (existing) ──
const selectedTab = ref("all");

const tabItems = computed(() => {
  const items = [{ label: "Gesamt", value: "all" }];
  for (const d of gridDetails.value) {
    items.push({ label: d.symbol, value: d.symbol });
  }
  return items;
});

const activePerformance = computed(() => {
  if (!gridDetails.value.length) return null;
  if (selectedTab.value === "all") return performance.value;
  const filtered = gridDetails.value.filter(
    (d) => d.symbol === selectedTab.value,
  );
  if (!filtered.length) return null;
  return aggregatePerformance(filtered);
});

const isSingleAsset = computed(() => selectedTab.value !== "all");
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/runs">
          <UButton icon="i-heroicons-arrow-left" variant="ghost" />
        </NuxtLink>
        <h2 class="text-xl font-semibold text-white font-mono">
          {{ runId }}
        </h2>
        <UBadge
          v-if="displayStatus"
          :color="statusColor(displayStatus)"
          variant="subtle"
        >
          {{ displayStatus }}
        </UBadge>
      </div>
    </div>

    <!-- Strategy Info -->
    <div
      v-if="strategyName"
      class="flex items-center gap-3 text-sm text-gray-400"
    >
      <span class="font-medium text-white">{{ strategyName }}</span>
      <span v-if="detail?.strategy?.description">
        — {{ detail.strategy.description }}
      </span>
    </div>

    <!-- Active run: progress view -->
    <template v-if="viewMode === 'progress' && progress">
      <div class="space-y-4">
        <RunsProgressOverview :progress="progress" />
        <RunsAssetProgressTable :assets="assetList" />
        <RunsLogViewer
          :logs="logs"
          :available-symbols="availableSymbols"
          v-model:level-filter="logLevelFilter"
          v-model:symbol-filter="logSymbolFilter"
        />
      </div>
    </template>

    <!-- Failed run -->
    <template v-else-if="viewMode === 'failed' && progress">
      <div class="space-y-4">
        <RunsProgressOverview :progress="progress" />
        <RunsLogViewer
          :logs="logs"
          :available-symbols="availableSymbols"
          v-model:level-filter="logLevelFilter"
          v-model:symbol-filter="logSymbolFilter"
        />
      </div>
    </template>

    <!-- Loading -->
    <div v-else-if="viewMode === 'loading'" class="py-16 text-center text-gray-400">
      Lade Run-Daten...
    </div>

    <!-- Completed run: performance dashboard -->
    <template v-else-if="viewMode === 'performance'">
      <!-- Asset Tabs -->
      <UTabs
        v-if="tabItems.length > 2"
        v-model="selectedTab"
        :items="tabItems"
        variant="link"
      />

      <template v-if="activePerformance">
        <!-- TradeZella-style Summary Widgets -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <PerformanceCumulativePnl
            :net-pnl="activePerformance.netPnl"
            :total-trades="activePerformance.totalTrades"
            :equity-curve="activePerformance.equityCurve"
          />
          <PerformanceProfitFactorGauge
            :profit-factor="activePerformance.profitFactor"
          />
          <PerformanceWinRateRing
            :win-rate="activePerformance.winRate"
            :total-trades="activePerformance.totalTrades"
          />
          <PerformanceMaxDrawdownGauge
            :max-drawdown="activePerformance.maxDrawdown"
            :max-drawdown-pct="activePerformance.maxDrawdownPct"
          />
          <PerformanceAvgWinLoss
            :avg-win="activePerformance.avgWin"
            :avg-loss="activePerformance.avgLoss"
          />
        </div>

        <!-- Secondary KPI Cards -->
        <PerformanceStatCards :data="activePerformance" />

        <!-- Equity · Drawdown · Profit per Trade (shared X axis) -->
        <PerformanceEquityPanel
          :simulation="activePerformance.equitySimulation"
          :profit-per-trade="activePerformance.profitPerTrade"
        />

        <!-- Score Radar + P&L Bar + Trade Distribution -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PerformanceScoreRadar :data="activePerformance" />
          <PerformancePnlBarChart v-if="!isSingleAsset" :assets="activePerformance.assetBreakdown" />
          <PerformanceTradeDistribution :data="activePerformance" />
        </div>

        <!-- Trade Log -->
        <PerformanceTradeTable :trades="activePerformance.trades" />

        <!-- Asset Table -->
        <PerformanceAssetTable v-if="!isSingleAsset" :assets="activePerformance.assetBreakdown" :run-id="runId" :run-detail="detail" />
      </template>
    </template>
  </div>
</template>
