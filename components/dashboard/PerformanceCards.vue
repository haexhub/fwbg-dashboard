<script setup lang="ts">
import type { Performance } from "~/types/dashboard";
import { formatNumber, formatPnL } from "~/types/dashboard";

defineProps<{
  performance: Performance | null;
}>();
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <!-- Win Rate -->
    <UCard>
      <p class="text-sm text-gray-400">Win Rate</p>
      <p class="text-2xl font-bold text-white">
        {{ formatNumber(performance?.winRate || 0, 1) }}%
      </p>
      <p class="text-xs text-gray-500">
        {{ performance?.closedTrades || 0 }} Trades geschlossen
      </p>
    </UCard>

    <!-- Total P&L -->
    <UCard>
      <p class="text-sm text-gray-400">Realisierter G/V</p>
      <p
        :class="[
          'text-2xl font-bold',
          (performance?.totalPnl || 0) >= 0 ? 'text-green-500' : 'text-red-500',
        ]"
      >
        {{ formatPnL(performance?.totalPnl || 0, "EUR") }}
      </p>
      <p class="text-xs text-gray-500">
        Max Drawdown: {{ formatNumber(performance?.maxDrawdown || 0) }} €
      </p>
    </UCard>
  </div>
</template>
