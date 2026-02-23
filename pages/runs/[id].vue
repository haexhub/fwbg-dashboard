<script setup lang="ts">
import { statusColor } from "~/types/strategy";

const route = useRoute();
const runId = computed(() => route.params.id as string);

const { detail, performance, loading, error, load } = useRunPerformance(
  runId.value,
);

onMounted(() => {
  load();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <NuxtLink to="/runs">
          <UButton icon="i-heroicons-arrow-left" variant="ghost" size="sm" />
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
      <!-- TradeZella-style Summary Widgets -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <PerformanceCumulativePnl
          :net-pnl="performance.netPnl"
          :total-trades="performance.totalTrades"
          :equity-curve="performance.equityCurve"
        />
        <PerformanceProfitFactorGauge
          :profit-factor="performance.profitFactor"
        />
        <PerformanceWinRateRing
          :win-rate="performance.winRate"
          :total-trades="performance.totalTrades"
        />
        <PerformanceMaxDrawdownGauge
          :max-drawdown="performance.maxDrawdown"
          :max-drawdown-pct="performance.maxDrawdownPct"
        />
        <PerformanceAvgWinLoss
          :avg-win="performance.avgWin"
          :avg-loss="performance.avgLoss"
        />
      </div>

      <!-- Secondary KPI Cards -->
      <PerformanceStatCards :data="performance" />

      <!-- Equity · Drawdown · Profit per Trade (shared X axis) -->
      <PerformanceEquityPanel
        :simulation="performance.equitySimulation"
        :profit-per-trade="performance.profitPerTrade"
      />

      <!-- Score Radar + P&L Bar + Trade Distribution -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PerformanceScoreRadar :data="performance" />
        <PerformancePnlBarChart :assets="performance.assetBreakdown" />
        <PerformanceTradeDistribution :data="performance" />
      </div>

      <!-- Trade Log -->
      <PerformanceTradeTable :trades="performance.trades" />

      <!-- Asset Table -->
      <PerformanceAssetTable :assets="performance.assetBreakdown" :run-id="runId" />
    </template>
  </div>
</template>
