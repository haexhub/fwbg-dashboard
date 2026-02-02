<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { Trade } from "~/types/dashboard";
import { formatEpic } from "~/types/dashboard";

const props = defineProps<{
  trades: Trade[];
  showAccountColumn: boolean;
}>();

const baseColumns: TableColumn<Trade>[] = [
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

const columns = computed(() => {
  if (!props.showAccountColumn) return baseColumns;
  return [
    baseColumns[0],
    { accessorKey: "accountName", header: "Account" },
    ...baseColumns.slice(1),
  ] as TableColumn<Trade>[];
});
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="text-lg font-semibold text-white">Trade History</h2>
    </template>

    <UTable :columns="columns" :data="trades">
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
          {{
            row.original.pnl === 0
              ? "Open"
              : `${row.original.pnl > 0 ? "+" : ""}${row.original.pnl.toFixed(2)} €`
          }}
        </span>
      </template>
    </UTable>
  </UCard>
</template>
