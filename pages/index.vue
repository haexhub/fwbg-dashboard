<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";

interface Trade {
  timestamp: string;
  epic: string;
  signal: string;
  size: number;
  pnl: number;
}

const { data: status, refresh: refreshStatus } = await useFetch("/api/status");
const { data: performance } = await useFetch("/api/performance");
const { data: trades, refresh: refreshTrades } = await useFetch("/api/trades", {
  query: { limit: 20 },
});
const { data: logs, refresh: refreshLogs } = await useFetch("/api/logs", {
  query: { lines: 50 },
});

// Auto-refresh every 30 seconds
const refreshAll = () => {
  refreshStatus();
  refreshTrades();
  refreshLogs();
};

onMounted(() => {
  const interval = setInterval(refreshAll, 30000);
  onUnmounted(() => clearInterval(interval));
});

const formatEpic = (epic: string) => {
  // CS.D.EURUSD.CEAM.IP -> EUR/USD
  const match = epic.match(/CS\.D\.(\w{3})(\w{3})/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return epic;
};

const columns: TableColumn<Trade>[] = [
  { accessorKey: "timestamp", header: "Zeit" },
  {
    accessorKey: "epic",
    header: "Pair",
    cell: ({ row }) => formatEpic(row.original.epic),
  },
  { accessorKey: "signal", header: "Signal" },
  { accessorKey: "size", header: "Size" },
  { accessorKey: "pnl", header: "P&L" },
];
</script>

<template>
  <div class="min-h-screen bg-gray-950 p-6">
    <div class="max-w-7xl mx-auto space-y-6">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h1 class="text-2xl font-bold text-white">FWBG Trading Dashboard</h1>
        <UButton icon="i-heroicons-arrow-path" @click="refreshAll">
          Refresh
        </UButton>
      </div>

      <!-- Status Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <!-- Bot Status -->
        <UCard>
          <div class="flex items-center gap-3">
            <div
              :class="[
                'w-3 h-3 rounded-full',
                status?.isAlive ? 'bg-green-500 animate-pulse' : 'bg-red-500',
              ]"
            />
            <div>
              <p class="text-sm text-gray-400">Bot Status</p>
              <p class="text-lg font-semibold text-white">
                {{ status?.isAlive ? "Online" : "Offline" }}
              </p>
              <p class="text-xs text-gray-500">
                {{ status?.account_mode?.toUpperCase() }} Mode
              </p>
            </div>
          </div>
        </UCard>

        <!-- Open Positions -->
        <UCard>
          <p class="text-sm text-gray-400">Offene Positionen</p>
          <p class="text-2xl font-bold text-white">
            {{ status?.active_pairs_count || 0 }}
          </p>
          <p class="text-xs text-gray-500">
            {{ status?.active_epics?.map(formatEpic).join(", ") || "-" }}
          </p>
        </UCard>

        <!-- Win Rate -->
        <UCard>
          <p class="text-sm text-gray-400">Win Rate</p>
          <p class="text-2xl font-bold text-white">
            {{ performance?.winRate?.toFixed(1) || 0 }}%
          </p>
          <p class="text-xs text-gray-500">
            {{ performance?.closedTrades || 0 }} Trades geschlossen
          </p>
        </UCard>

        <!-- Total P&L -->
        <UCard>
          <p class="text-sm text-gray-400">Gesamt P&L</p>
          <p
            :class="[
              'text-2xl font-bold',
              (performance?.totalPnl || 0) >= 0
                ? 'text-green-500'
                : 'text-red-500',
            ]"
          >
            {{ (performance?.totalPnl || 0) >= 0 ? "+" : ""
            }}{{ performance?.totalPnl?.toFixed(2) || "0.00" }} €
          </p>
          <p class="text-xs text-gray-500">
            Max Drawdown: {{ performance?.maxDrawdown?.toFixed(2) || "0.00" }} €
          </p>
        </UCard>
      </div>

      <!-- Main Content -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Trade History -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-white">Trade History</h2>
          </template>

          <UTable :columns="columns" :data="(trades?.trades as Trade[]) || []">
            <template #epic-cell="{ row }">
              {{ formatEpic(row.original.epic) }}
            </template>
            <template #signal-cell="{ row }">
              <UBadge :color="row.original.signal === 'BUY' ? 'success' : 'error'">
                {{ row.original.signal }}
              </UBadge>
            </template>
            <template #pnl-cell="{ row }">
              <span
                :class="[
                  row.original.pnl > 0
                    ? 'text-green-500'
                    : row.original.pnl < 0
                      ? 'text-red-500'
                      : 'text-gray-400',
                ]"
              >
                {{ row.original.pnl === 0 ? "Open" : `${row.original.pnl > 0 ? "+" : ""}${row.original.pnl.toFixed(2)} €` }}
              </span>
            </template>
          </UTable>
        </UCard>

        <!-- Logs -->
        <UCard>
          <template #header>
            <h2 class="text-lg font-semibold text-white">Bot Logs</h2>
          </template>

          <div
            class="h-96 overflow-y-auto bg-gray-900 rounded p-3 font-mono text-xs"
          >
            <div
              v-for="(line, i) in logs?.logs"
              :key="i"
              :class="[
                'py-0.5',
                line.includes('ERROR')
                  ? 'text-red-400'
                  : line.includes('WARNING')
                    ? 'text-yellow-400'
                    : 'text-gray-300',
              ]"
            >
              {{ line }}
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
