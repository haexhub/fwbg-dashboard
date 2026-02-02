<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { Position } from "~/types/dashboard";
import { formatEpic, formatPnL } from "~/types/dashboard";

defineProps<{
  positions: Position[];
  wsConnected: boolean;
}>();

const columns: TableColumn<Position>[] = [
  {
    accessorKey: "epic",
    header: "Pair",
    cell: ({ row }) => formatEpic(row.original.epic),
  },
  { accessorKey: "direction", header: "Richtung" },
  { accessorKey: "size", header: "Größe" },
  {
    accessorKey: "openLevel",
    header: "Eröffnung",
    cell: ({ row }) => row.original.openLevel.toFixed(5),
  },
  {
    accessorKey: "currentLevel",
    header: "Aktuell",
    cell: ({ row }) => row.original.currentLevel.toFixed(5),
  },
  {
    accessorKey: "stopLevel",
    header: "Stop",
    cell: ({ row }) => row.original.stopLevel?.toFixed(5) || "-",
  },
  {
    accessorKey: "limitLevel",
    header: "Limit",
    cell: ({ row }) => row.original.limitLevel?.toFixed(5) || "-",
  },
  { accessorKey: "profitLoss", header: "G/V" },
];
</script>

<template>
  <UCard v-if="positions.length > 0">
    <template #header>
      <div class="flex items-center gap-2">
        <h2 class="text-lg font-semibold text-white">Offene Positionen</h2>
        <div
          v-if="wsConnected"
          class="w-2 h-2 rounded-full bg-green-500 animate-pulse"
          title="Live"
        />
      </div>
    </template>

    <UTable :columns="columns" :data="positions">
      <template #direction-cell="{ row }">
        <UBadge :color="row.original.direction === 'BUY' ? 'success' : 'error'">
          {{ row.original.direction }}
        </UBadge>
      </template>
      <template #profitLoss-cell="{ row }">
        <span
          :class="[
            'font-semibold',
            row.original.profitLoss > 0
              ? 'text-green-500'
              : row.original.profitLoss < 0
                ? 'text-red-500'
                : 'text-gray-400',
          ]"
        >
          {{ formatPnL(row.original.profitLoss, row.original.currency) }}
        </span>
      </template>
    </UTable>
  </UCard>
</template>
