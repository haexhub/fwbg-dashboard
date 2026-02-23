<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { AssetPerformance } from "~/types/performance";
import { formatNumber } from "~/types/dashboard";

defineProps<{
  assets: AssetPerformance[];
  runId?: string;
}>();

const columns: TableColumn<AssetPerformance>[] = [
  { accessorKey: "symbol", header: "Symbol" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "trades", header: "Trades" },
  { accessorKey: "winRate", header: "Win Rate" },
  { accessorKey: "pnl", header: "P&L" },
  { accessorKey: "sharpeRatio", header: "Sharpe" },
  { accessorKey: "calmarRatio", header: "Calmar" },
  { accessorKey: "profitFactor", header: "PF" },
];
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-semibold text-white">
        Asset Performance ({{ assets.length }})
      </h3>
    </template>

    <UTable :columns="columns" :data="assets">
      <template #symbol-cell="{ row }">
        <div class="flex items-center gap-2">
          <span class="font-mono text-sm text-white">
            {{ row.original.symbol }}
          </span>
          <NuxtLink
            v-if="runId"
            :to="`/chart?run=${runId}&symbol=${row.original.symbol}`"
            title="Im Chart anzeigen"
          >
            <UButton
              icon="i-heroicons-chart-bar-square"
              size="2xs"
              variant="ghost"
              color="neutral"
            />
          </NuxtLink>
        </div>
      </template>
      <template #status-cell="{ row }">
        <UBadge
          :color="
            row.original.status === 'ok'
              ? 'success'
              : row.original.status === 'error'
                ? 'error'
                : 'warning'
          "
          variant="subtle"
          size="xs"
        >
          {{ row.original.status }}
        </UBadge>
      </template>
      <template #winRate-cell="{ row }">
        <span
          :class="[
            'text-sm',
            row.original.winRate >= 50 ? 'text-green-500' : 'text-red-500',
          ]"
        >
          {{ formatNumber(row.original.winRate, 1) }}%
        </span>
      </template>
      <template #pnl-cell="{ row }">
        <span
          :class="[
            'font-mono text-sm',
            row.original.pnl > 0
              ? 'text-green-500'
              : row.original.pnl < 0
                ? 'text-red-500'
                : 'text-gray-400',
          ]"
        >
          {{ row.original.pnl > 0 ? "+" : "" }}{{ formatNumber(row.original.pnl, 3) }}
        </span>
      </template>
      <template #sharpeRatio-cell="{ row }">
        <span class="text-sm text-gray-300">
          {{ row.original.sharpeRatio != null ? formatNumber(row.original.sharpeRatio, 2) : "-" }}
        </span>
      </template>
      <template #calmarRatio-cell="{ row }">
        <span class="text-sm text-gray-300">
          {{ row.original.calmarRatio != null ? formatNumber(row.original.calmarRatio, 2) : "-" }}
        </span>
      </template>
      <template #profitFactor-cell="{ row }">
        <span class="text-sm text-gray-300">
          {{ row.original.profitFactor != null ? formatNumber(row.original.profitFactor, 2) : "-" }}
        </span>
      </template>
    </UTable>
  </UCard>
</template>
