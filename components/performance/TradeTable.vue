<script setup lang="ts">
import type { TableColumn } from "@nuxt/ui";
import type { TradeRecord } from "~/types/performance";
import { formatNumber } from "~/types/dashboard";

interface IndexedTrade extends TradeRecord {
  _index: number;
  _cumPnl: number;
}

const props = defineProps<{
  trades: TradeRecord[];
}>();

const page = ref(1);
const pageSize = ref(50);

const tradesWithCumPnl = computed<IndexedTrade[]>(() => {
  let cum = 0;
  return props.trades.map((t, i) => {
    cum += t.pnl;
    return { ...t, _index: i + 1, _cumPnl: cum };
  });
});

const paginatedTrades = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return tradesWithCumPnl.value.slice(start, start + pageSize.value);
});

const pageCount = computed(() =>
  Math.ceil(props.trades.length / pageSize.value),
);

const hasInitialRisk = computed(() =>
  props.trades.some((t) => t.initialRisk != null),
);

const hasTimestamp = computed(() =>
  props.trades.some((t) => t.timestamp !== ""),
);

const columns = computed<TableColumn<IndexedTrade>[]>(() => {
  const cols: TableColumn<IndexedTrade>[] = [
    { accessorKey: "_index", header: "#" },
  ];

  if (hasTimestamp.value) {
    cols.push({ accessorKey: "timestamp", header: "Periode" });
  }

  cols.push(
    { accessorKey: "symbol", header: "Symbol" },
    { accessorKey: "result", header: "Status" },
  );

  if (hasInitialRisk.value) {
    cols.push({ accessorKey: "initialRisk", header: "Initial Risk" });
  }

  cols.push(
    { accessorKey: "pnl", header: "Net P&L" },
    { accessorKey: "_cumPnl", header: "Kumulativ" },
  );

  return cols;
});
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold text-white">Trade Log</h3>
        <span class="text-sm text-gray-400">
          {{ (page - 1) * pageSize + 1 }}-{{
            Math.min(page * pageSize, trades.length)
          }}
          von {{ trades.length }} Trades
        </span>
      </div>
    </template>

    <UTable :columns="columns" :data="paginatedTrades">
      <template #_index-cell="{ row }">
        <span class="text-xs text-gray-500">{{ row.original._index }}</span>
      </template>
      <template #timestamp-cell="{ row }">
        <span class="font-mono text-xs text-gray-400">
          {{ row.original.timestamp }}
        </span>
      </template>
      <template #symbol-cell="{ row }">
        <span class="font-mono text-sm font-semibold text-white">
          {{ row.original.symbol }}
        </span>
      </template>
      <template #result-cell="{ row }">
        <UBadge
          :color="row.original.result === 'win' ? 'success' : 'error'"
          variant="subtle"
          size="xs"
        >
          {{ row.original.result === "win" ? "WIN" : "LOSS" }}
        </UBadge>
      </template>
      <template #initialRisk-cell="{ row }">
        <span
          v-if="row.original.initialRisk != null"
          class="font-mono text-sm text-gray-300"
        >
          {{ formatNumber(row.original.initialRisk, 0) }}x
        </span>
        <span v-else class="text-gray-600">–</span>
      </template>
      <template #pnl-cell="{ row }">
        <span
          :class="[
            'font-mono text-sm font-medium',
            row.original.pnl > 0
              ? 'text-green-500'
              : row.original.pnl < 0
                ? 'text-red-500'
                : 'text-gray-400',
          ]"
        >
          {{ row.original.pnl > 0 ? "+" : ""
          }}{{ formatNumber(row.original.pnl ?? 0, 2) }}
        </span>
      </template>
      <template #_cumPnl-cell="{ row }">
        <span
          :class="[
            'font-mono text-xs',
            row.original._cumPnl > 0
              ? 'text-green-400'
              : row.original._cumPnl < 0
                ? 'text-red-400'
                : 'text-gray-500',
          ]"
        >
          {{ row.original._cumPnl > 0 ? "+" : ""
          }}{{ formatNumber(row.original._cumPnl, 2) }}
        </span>
      </template>
    </UTable>

    <template v-if="pageCount > 1" #footer>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-sm text-gray-400">
          <span>Trades pro Seite:</span>
          <USelect
            v-model="pageSize"
            :items="[25, 50, 100]"
            size="xs"
            class="w-18"
            @update:model-value="page = 1"
          />
        </div>
        <UPagination
          v-model:page="page"
          :total="trades.length"
          :items-per-page="pageSize"
        />
      </div>
    </template>
  </UCard>
</template>
