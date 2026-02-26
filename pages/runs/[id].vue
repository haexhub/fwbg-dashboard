<script setup lang="ts">
import { statusColor } from "~/types/strategy";
import { aggregatePerformance } from "~/composables/useRunPerformance";

const route = useRoute();
const runId = computed(() => route.params.id as string);

const { detail, gridDetails, performance, loading, error, load } =
  useRunPerformance(runId.value);

onMounted(() => {
  load();
});

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
          v-if="detail"
          :color="statusColor(detail.status)"
          variant="subtle"
        >
          {{ detail.status }}
        </UBadge>
      </div>
    </div>

    <!-- Strategy Info -->
    <div
      v-if="detail?.strategy"
      class="flex items-center gap-3 text-sm text-gray-400"
    >
      <span class="font-medium text-white">{{
        detail.strategy.name
      }}</span>
      <span v-if="detail.strategy.description">
        — {{ detail.strategy.description }}
      </span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="py-16 text-center text-gray-400">
      Lade Run-Daten...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="py-16 text-center text-red-400">
      {{ error }}
    </div>

    <!-- No data -->
    <div
      v-else-if="!performance"
      class="py-16 text-center text-gray-400"
    >
      Keine Performance-Daten verfügbar.
    </div>

    <!-- Dashboard -->
    <template v-else>
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
        <PerformanceAssetTable v-if="!isSingleAsset" :assets="activePerformance.assetBreakdown" :run-id="runId" />
      </template>
    </template>
  </div>
</template>
