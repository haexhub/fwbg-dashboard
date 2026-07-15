<script setup lang="ts">
import type { PerformanceData } from "~/types/performance";
import { formatNumber } from "~/types/dashboard";

defineProps<{
  data: PerformanceData;
}>();
</script>

<template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    <!-- Rendite p.a. -->
    <UCard>
      <div class="text-center">
        <p class="text-sm text-gray-400">Rendite p.a.</p>
        <p
          v-if="data.annualReturn != null"
          :class="[
            'text-2xl font-bold',
            data.annualReturn >= 0 ? 'text-green-500' : 'text-red-500',
          ]"
        >
          {{ data.annualReturn >= 0 ? "+" : ""
          }}{{ formatNumber(data.annualReturn, 1) }}%
        </p>
        <p v-else class="text-2xl font-bold text-gray-600">n/a</p>
        <p class="text-xs text-gray-500">
          {{ data.annualReturn != null ? "Jährliche Rendite" : "Keine Zeitdaten" }}
        </p>
      </div>
    </UCard>

    <!-- Deflated Sharpe Ratio (falls back to plain Sharpe when the global
         trial census isn't available, e.g. fwbg-agents unreachable or no
         trial history yet) -->
    <UCard>
      <div class="text-center">
        <p class="text-sm text-gray-400">
          {{ data.dsr != null ? "Deflated Sharpe" : "Sharpe Ratio" }}
        </p>
        <p
          v-if="data.dsr != null"
          :class="[
            'text-2xl font-bold',
            data.dsr >= 0.95 ? 'text-green-500' : 'text-white',
          ]"
        >
          {{ formatNumber(data.dsr, 3) }}
        </p>
        <p
          v-else
          :class="[
            'text-2xl font-bold',
            (data.sharpeRatio ?? 0) >= 1 ? 'text-green-500' : 'text-white',
          ]"
        >
          {{
            data.sharpeRatio != null ? formatNumber(data.sharpeRatio, 2) : "-"
          }}
        </p>
        <p class="text-xs text-gray-500">
          {{
            data.dsr != null
              ? `Ggü. ${data.nTrials} Trials deflationiert`
              : "Risikoadjustiert"
          }}
        </p>
      </div>
    </UCard>

    <!-- Calmar Ratio -->
    <UCard>
      <div class="text-center">
        <p class="text-sm text-gray-400">Calmar Ratio</p>
        <p
          :class="[
            'text-2xl font-bold',
            (data.calmarRatio ?? 0) >= 1 ? 'text-green-500' : 'text-white',
          ]"
        >
          {{
            data.calmarRatio != null ? formatNumber(data.calmarRatio, 2) : "-"
          }}
        </p>
        <p class="text-xs text-gray-500">Return / Max DD</p>
      </div>
    </UCard>

    <!-- Total Trades -->
    <UCard>
      <div class="text-center">
        <p class="text-sm text-gray-400">Trades</p>
        <p class="text-2xl font-bold text-white">
          {{ data.totalTrades }}
        </p>
        <p class="text-xs text-gray-500">
          {{ data.assetBreakdown.length }} Assets
        </p>
      </div>
    </UCard>
  </div>
</template>
